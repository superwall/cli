import { DASHBOARD_URL, VERSION } from "@/constants";
import { SUPPORTED_LABEL } from "@/core/project/frameworks";
import { stripReport } from "@/ui/log";
import { ui } from "@/ui";
import { withSpinner } from "@/ui/spinner";
import { defineCommand, type CommandContext } from "@/command";
import { isNonInteractive } from "@/util/env";
import { loadReport, saveReport } from "@/core/state/reports";
import { detectDrivers, type AgentDriver } from "@/core/agent/drivers";
import { scanProject, type DetectedApp } from "@/core/project/scan";
import { detectExisting, type ExistingIntegration } from "@/core/project/existing";
import { detectBilling } from "@/core/project/billing";
import { resolveAccount } from "@/core/account";
import { resolveAppBinding, resolveScopeFromKey, platformForIntegration } from "@/core/account/bind";
import { performLogin } from "@/core/auth/login";
import { loadSession } from "@/core/auth/storage";
import { SuperwallApi } from "@/core/api/client";
import { discoverPublicApiKey } from "@/core/api/discover";
import { listResource, platformLabel, rowName, titleCase, type Row, type Scope } from "@/core/api/resources";
import { installToolkit, installBundledSkills } from "@/core/agent/skills";
import { runProductsStage, runPaywallStage, runVerifyStage, type StageCtx } from "@/core/dashboard/stages";
import { runAction } from "@/core/agent/run";
import { buildCopyPrompt } from "@/core/agent/prompt";
import { copyToClipboard } from "@/util/clipboard";
import { runFallback } from "@/core/agent/fallback";
import { ACTIONS, actionById, type ActionContext, type ActionId, type WizardAction } from "@/core/agent/actions";

export const runIntegrate = defineCommand(runPipeline);

export function runActionCommand(action: ActionId): (argv: import("yargs").Arguments) => Promise<void> {
  return defineCommand((ctx) => runFlow(ctx, action));
}

async function runPipeline(ctx: CommandContext): Promise<void> {
  const { installDir, dryRun, argv } = ctx;
  ui.intro(`Superwall v${VERSION}`);

  const drivers = await withSpinner("Checking your setup", () => detectDrivers());
  if (drivers.length === 0) {
    ui.warn("No coding agent found (looked for Claude Code and Codex).");
    await runFallback(installDir);
    return;
  }
  const driver = drivers[0]!.driver;

  const app = await pickApp(installDir);
  if (!app) return;

  const existing = detectExisting(app);
  if (existing.fullyIntegrated) ui.success(`Superwall is already set up in \`${app.name}\`.`);
  else if (existing.sdkInstalled) ui.info(`Partial Superwall setup found in \`${app.name}\`.`);

  const billing = detectBilling(app);
  if (billing.revenueCat && !isNonInteractive()) {
    const intent = await ui.select({
      message: "You're using `RevenueCat`. What do you want Superwall for?",
      options: [
        { value: "paywalls", label: "Paywalls only — keep RevenueCat for billing" },
        { value: "migrate", label: "Fully migrate to Superwall" },
        { value: "later", label: "Decide later" },
      ],
      initialValue: "paywalls",
    });
    if (intent === null) return;
    ui.info(`RevenueCat: \`${intent}\``);
  }

  // Login is lazy: only the dashboard stages need the org session — never gate the SDK step on it.
  let session = loadSession();
  if (session?.apiKey) process.env.SUPERWALL_API_KEY = session.apiKey;

  // Resolve the app scope in the background so the dashboard stages don't wait on it mid-flow.
  let scopePromise: ReturnType<typeof resolveScopeFromKey> | null = null;
  if (session && existing.apiKey) {
    scopePromise = resolveScopeFromKey(SuperwallApi.fromSession(), existing.apiKey).catch(() => null);
  }

  const ensureLogin = async (): Promise<boolean> => {
    if (session) return true;
    if (isNonInteractive() || dryRun) return false;
    const spin = ui.spinner();
    try {
      session = await performLogin({
        onVerify: ({ url, userCode }) => {
          ui.note(`If your browser didn't open, visit:\n\n${url}\n\nand enter the code  \`${userCode}\``, "Approve in your browser");
          spin.start("Signing you in");
        },
        onStatus: (m) => spin.message(m),
        onSelectOrg: async (orgs) => {
          const sel = await ui.select({
            message: "Which organization?",
            options: orgs.map((o) => ({ value: String(o.id), label: o.name, hint: titleCase(o.role) })),
          });
          spin.start("Setting things up");
          return sel === null ? null : (orgs.find((o) => String(o.id) === sel) ?? null);
        },
      });
      spin.stop(`Signed in as ${session.userEmail ?? "you"}`);
      if (session.apiKey) process.env.SUPERWALL_API_KEY = session.apiKey;
      return true;
    } catch (e) {
      spin.stop("Sign-in failed");
      ui.warn((e as Error).message);
      return false;
    }
  };

  let apiKey = existing.apiKey ?? "";
  let scope: Scope | null = null;
  let bundleId: string | undefined;
  if (!apiKey) {
    if (isNonInteractive()) {
      if (session) {
        const disc = await withSpinner("Finding your app", () => discoverPublicApiKey(SuperwallApi.fromSession()));
        if (disc) {
          apiKey = disc.apiKey;
          ui.info(`Using app \`${disc.app.name ?? disc.app.bundle_id ?? disc.app.id}\``);
        }
      }
    } else if (await ensureLogin()) {
      try {
        const bound = await resolveAppBinding(SuperwallApi.fromSession(), {
          platform: platformForIntegration(app.integration),
          appName: app.name,
        });
        if (!bound) return void ui.warn("Cancelled.");
        apiKey = bound.apiKey;
        scope = { projectId: bound.projectId, applicationId: bound.applicationId, appName: app.name };
        bundleId = bound.app.bundle_id;
        ui.success(`Using \`${bound.app.name ?? bound.app.id}\` (${platformLabel(bound.app.platform)})`);
      } catch (e) {
        ui.warn((e as Error).message);
      }
    }
  }
  if (!apiKey) {
    const account = await resolveAccount({ existing, argv });
    if (!account) return void ui.warn("Cancelled.");
    apiKey = account.apiKey;
  }
  const ctxAction: ActionContext = { app, apiKey, existing };

  ui.step("Step 1 · Integrate the SDK");
  if (existing.fullyIntegrated) {
    ui.info("SDK already integrated — skipped.");
  } else if (!dryRun) {
    const how = isNonInteractive()
      ? "now"
      : await ui.select({
          message: `Integrate the Superwall SDK into \`${app.name}\`?`,
          options: [
            { value: "now", label: "Integrate for me" },
            { value: "copy", label: "Copy the prompt", hint: "Run it in your own agent" },
          ],
          initialValue: "now",
        });
    if (how === null) return void ui.warn("Cancelled.");
    if (how === "copy") {
      await copyIntegrationPrompt(ctxAction);
      return void ui.outro("Paste it into your agent, then run `superwall integrate` to continue.");
    }
    await runActionWithUI(driver, actionById["integrate"], ctxAction);
    const spin = ui.spinner();
    spin.start("Installing Superwall skills for your agent");
    const ok = await installAgentSkills();
    spin.stop(ok ? "Superwall skills installed" : "Skill install skipped");
  }

  if (!dryRun && !isNonInteractive() && !scope && (await ensureLogin())) {
    const resolved = scopePromise
      ? await scopePromise
      : await withSpinner("Finding this app in Superwall", () =>
          resolveScopeFromKey(SuperwallApi.fromSession(), apiKey).catch(() => null),
        );
    if (resolved) {
      scope = resolved;
      bundleId = resolved.bundleId;
    }
  }
  if (scope) {
    const stageCtx: StageCtx = { api: SuperwallApi.fromSession(), scope, appName: app.name, bundleId, projectDir: app.path };
    await stage("Step 2 · Products", () => runProductsStage(stageCtx));
    await stage("Step 3 · Campaigns & Placements", () => runCampaignsAndPlacements(driver, ctxAction, stageCtx));
    await stage("Step 4 · Paywall", () => runPaywallStage());
    await stage("Step 5 · Verify", () => runVerifyStage(stageCtx));
  } else if (!dryRun && !isNonInteractive()) {
    ui.step("Step 2 · Products, Campaigns, Paywall & Verify");
    ui.info("Couldn't match this app in your Superwall org — set these up in the dashboard.");
  }

  ui.outro(`Done.  ${DASHBOARD_URL}`);
}

async function runFlow(ctx: CommandContext, forced?: ActionId): Promise<void> {
  const { installDir, dryRun, argv } = ctx;
  ui.intro(`Superwall v${VERSION}`);

  const drivers = await withSpinner("Checking your setup", () => detectDrivers());
  if (drivers.length === 0) {
    ui.warn("No coding agent found (looked for Claude Code and Codex).");
    await runFallback(installDir);
    return;
  }
  const driver = drivers[0]!;

  const app = await pickApp(installDir);
  if (!app) return void ui.warn("Cancelled.");

  const existing = detectExisting(app);
  if (existing.fullyIntegrated) ui.success(`Superwall is already set up in \`${app.name}\`.`);
  else if (existing.sdkInstalled) ui.info(`Partial Superwall setup found in \`${app.name}\`.`);

  const choice = await chooseAction(forced, existing, app);
  if (!choice) return;
  const action = actionById[choice];

  if (action.requiresOrgKey && !process.env.SUPERWALL_API_KEY && !loadSession()) {
    ui.warn("That needs an authenticated session — run `superwall login` first (or set SUPERWALL_API_KEY).");
    ui.outro("");
    return;
  }

  let apiKey = existing.apiKey ?? "";
  if (action.id === "integrate" || action.id === "dashboard-setup") {
    const account = await resolveAccount({ existing, argv });
    if (!account) return void ui.warn("Cancelled.");
    apiKey = account.apiKey;
  }

  const priorReport =
    action.id === "placements-implement" ? loadReport(app.path, "placements-review") : undefined;
  const actionCtx: ActionContext = { app, apiKey, existing, priorReport };

  if (dryRun) {
    printPlan(driver.info.displayName, action, actionCtx);
    ui.outro("Dry run — no changes made.");
    return;
  }

  if (action.id === "integrate" && existing.fullyIntegrated) {
    ui.note("SDK + configure() already present — no code changes made.", "Already integrated");
  } else {
    await runActionWithUI(driver.driver, action, actionCtx);
  }

  if (action.id === "integrate" && !existing.fullyIntegrated && !dryRun) {
    const spin = ui.spinner();
    spin.start("Installing Superwall skills for your agent");
    const ok = await installAgentSkills();
    spin.stop(ok ? "Superwall skills installed" : "Skill install skipped");
  }
  finish(action);
}

async function pickApp(installDir: string): Promise<DetectedApp | null> {
  const scan = await withSpinner("Scanning your project", () => scanProject(installDir));
  if (scan.apps.length === 0) {
    if (scan.comingSoon.length) {
      const w = scan.comingSoon[0]!;
      ui.warn(`Detected a web app${w.details ? ` (\`${w.details}\`)` : ""} — Superwall web support is coming soon.`);
    } else {
      ui.error(`No ${SUPPORTED_LABEL} app found in this directory.`);
      if (scan.skipped.length) ui.info(`Skipped: ${scan.skipped.join(", ")}`);
    }
    return null;
  }
  if (scan.comingSoon.length) {
    ui.info(`Also found (web — coming soon): ${scan.comingSoon.map((a) => a.name).join(", ")}`);
  }
  if (scan.apps.length === 1 || isNonInteractive()) {
    const app = scan.apps[0]!;
    ui.info(
      `Detected \`${app.framework.name}\`` +
        (app.details ? ` · \`${app.details}\`` : "") +
        (app.relPath !== "." ? `  (${app.relPath})` : ""),
    );
    return app;
  }
  const choice = await ui.select({
    message: scan.isMonorepo ? "Found multiple apps — which one?" : "Which app?",
    options: scan.apps.map((a) => ({
      value: a.path,
      label: `${a.name} · ${a.framework.name}`,
      hint: a.relPath === "." ? undefined : a.relPath,
    })),
    initialValue: scan.apps[0]!.path,
  });
  if (choice === null) return null;
  return scan.apps.find((a) => a.path === choice) ?? scan.apps[0]!;
}

async function chooseAction(
  forced: ActionId | undefined,
  existing: ExistingIntegration,
  app: DetectedApp,
): Promise<ActionId | null> {
  if (forced) return forced;
  if (isNonInteractive()) return "integrate";

  if (!existing.sdkInstalled) {
    const yes = await ui.confirm({ message: `Integrate Superwall into \`${app.name}\`?` });
    if (yes === null) {
      ui.warn("Cancelled.");
      return null;
    }
    if (!yes) {
      ui.outro("No problem — run `superwall integrate` again anytime.");
      return null;
    }
    return "integrate";
  }

  const available = ACTIONS.filter((a) => {
    if (a.id === "integrate") return false;
    if (a.requiresOrgKey && !process.env.SUPERWALL_API_KEY) return false;
    return true;
  });
  const sel = await ui.select({
    message: "What do you want to do?",
    options: available.map((a) => ({ value: a.id, label: a.title, hint: a.hint })),
    initialValue: "placements-review",
  });
  return sel as ActionId | null;
}

// Paint the step header a beat before the body's spinner, else they flush as one lump.
async function stage(label: string, fn: () => Promise<void> | void): Promise<void> {
  ui.step(label);
  await new Promise((resolve) => setTimeout(resolve, 40));
  try {
    await fn();
  } catch {
    ui.error(`Couldn't finish ${label.replace(/^Step \d+ · /, "")} — you can set it up in the dashboard.`);
  }
}

async function installAgentSkills(): Promise<boolean> {
  const pub = await installToolkit();
  const bundled = await installBundledSkills();
  return pub.ok || bundled.ok;
}

async function copyIntegrationPrompt(ctx: ActionContext): Promise<void> {
  const prompt = buildCopyPrompt(actionById["integrate"], ctx);
  const copied = await copyToClipboard(prompt);
  if (copied) {
    ui.note("Paste it into your coding agent (Claude Code, Cursor, …) to integrate Superwall.", "Integration prompt copied to clipboard");
  } else {
    ui.note(prompt, "Integration prompt (copy it manually)");
  }
}

// A placement only presents a paywall once routed through a campaign, so set both up together.
async function runCampaignsAndPlacements(
  driver: AgentDriver,
  ctxAction: ActionContext,
  stageCtx: StageCtx,
): Promise<void> {
  const { api, scope } = stageCtx;

  const campaigns = await withSpinner("Checking campaigns", () => listResource(api, "campaigns", scope));
  if (campaigns.length) {
    ui.list({
      items: campaigns.map((c) => {
        const placements = placementsOf(c);
        return {
          label: rowName(c),
          meta: String(c.id ?? ""),
          children: placements.length
            ? placements.map((p) => ({ label: p.event_name ?? "", badge: p.enabled === false ? "off" : undefined }))
            : [{ label: "no placements yet" }],
        };
      }),
    });
  } else {
    ui.info("No campaigns yet.");
  }

  const review = await ui.confirm({ message: "Review your placements & campaigns now?" });
  if (!review) return;

  const context: ActionContext = { ...ctxAction, campaigns: campaignSummary(campaigns) };
  await runActionWithUI(driver, actionById["placements-review"], context);

  const apply = await ui.confirm({ message: "Apply the suggested changes?" });
  if (apply) {
    await runActionWithUI(driver, actionById["placements-implement"], {
      ...context,
      priorReport: loadReport(ctxAction.app.path, "placements-review"),
    });
  }
}

type CampaignPlacement = { event_name?: string; enabled?: boolean };
function placementsOf(campaign: Row): CampaignPlacement[] {
  return ((campaign as Record<string, unknown>).placements as CampaignPlacement[] | undefined) ?? [];
}

function campaignSummary(campaigns: Row[]): string {
  if (!campaigns.length) return "No campaigns exist yet — the app will likely need at least one.";
  return campaigns
    .map((c) => {
      const names = placementsOf(c)
        .map((p) => p.event_name)
        .filter(Boolean)
        .join(", ");
      return `- ${rowName(c)}: ${names || "(no placements)"}`;
    })
    .join("\n");
}

async function runActionWithUI(driver: AgentDriver, action: WizardAction, ctx: ActionContext): Promise<void> {
  const spin = ui.spinner();
  spin.start(action.runningLabel);
  const result = await runAction({
    driver,
    action,
    ctx,
    onEvent: (event) => {
      if (event.type === "status") spin.message(event.text);
    },
  });
  if (result.ok) {
    spin.stop(action.successLabel);
    if (action.outputMode === "report" && result.finalText) {
      const plain = stripReport(result.finalText);
      saveReport(ctx.app.path, action.id, plain);
      ui.report(plain);
    }
  } else {
    spin.stop("The agent stopped before finishing.");
    if (result.finalText) ui.report(stripReport(result.finalText).slice(0, 1500));
  }
}

function printPlan(agent: string, action: WizardAction, ctx: ActionContext): void {
  ui.note(
    [
      `Agent:    ${agent}`,
      `Action:   ${action.title}`,
      `App:      ${ctx.app.name} (${ctx.app.framework.name}${ctx.app.details ? `, ${ctx.app.details}` : ""})`,
      `Path:     ${ctx.app.path}`,
      `Key:      ${ctx.apiKey || "(none)"}`,
      `Mode:     ${action.readOnly ? "read-only" : "read-write"} · ${action.outputMode}`,
      `Prior:    ${ctx.priorReport ? "review report found" : "none"}`,
    ].join("\n"),
    "Plan",
  );
}

function finish(action: WizardAction): void {
  // `migrate` has its own command and never reaches here, hence Partial.
  const steps: Partial<Record<ActionId, string[]>> = {
    integrate: [
      "Set up the dashboard (campaign + paywall) so the placement presents something.",
      "Verify on device for placement 'campaign_trigger'.",
    ],
    "placements-review": ["Run 'Implement placements' to act on the findings."],
    "placements-implement": ["Set up the dashboard so the new placements present paywalls."],
    "dashboard-setup": ["Design the paywall and attach products in the dashboard.", "Verify on device."],
  };
  const next = steps[action.id] ?? [];
  if (next.length) ui.note(next.map((s, i) => `${i + 1}. ${s}`).join("\n"), "Next steps");
  ui.outro(`Done.  ${DASHBOARD_URL}`);
}
