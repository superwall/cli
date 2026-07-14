import { DASHBOARD_URL, VERSION } from "@/constants";
import { ui } from "@/ui";
import { withSpinner } from "@/ui/spinner";
import {
  defineCommand,
  type CommandContext,
  type DefinedCommand,
} from "@/command";
import { loadReport } from "@/core/state/reports";
import { detectDrivers } from "@/core/agent/drivers";
import { detectExisting } from "@/core/project/existing";
import { detectBilling } from "@/core/project/billing";
import { resolveAccount } from "@/core/account";
import {
  resolveAppBinding,
  resolveScopeFromKey,
  platformForIntegration,
} from "@/core/account/bind";
import { loadSession } from "@/core/auth/storage";
import { SuperwallApi } from "@/core/api/client";
import { discoverPublicApiKey } from "@/core/api/discover";
import { platformLabel, type Scope } from "@/core/api/resources";
import {
  runProductsStage,
  runPaywallStage,
  runVerifyStage,
  type StageCtx,
} from "@/core/dashboard/stages";
import { runFallback } from "@/core/agent/fallback";
import {
  actionById,
  type ActionContext,
  type ActionId,
} from "@/core/agent/actions";
import {
  chooseAction,
  ensureAgentDriverReady,
  performLoginWithUi,
  pickApp,
  stage,
} from "./integrate/app";
import {
  copyIntegrationPrompt,
  finish,
  installAgentSkills,
  printPlan,
  runActionWithUI,
} from "./integrate/agent";
import { runCampaignsAndPlacements } from "./integrate/campaigns";

export const runIntegrate = defineCommand({
  name: "integrate",
  auth: "optional",
  run: runPipeline,
});

export function runActionCommand(action: ActionId): DefinedCommand<"optional"> {
  return defineCommand({
    name: action,
    auth: "optional",
    run: (ctx) => runFlow(ctx, action),
  });
}

async function runPipeline(ctx: CommandContext): Promise<void> {
  const { installDir, dryRun, argv } = ctx;
  ui.intro(`Superwall v${VERSION}`);

  const drivers = await withSpinner("Checking your setup", () =>
    detectDrivers(),
  );
  if (drivers.length === 0) {
    ui.warn("No coding agent found.");
    await runFallback(installDir);
    return;
  }
  // `--driver claude|codex|superwall` forces a specific backend (bench/A-B); default = first detected.
  const wanted = argv.driver as string | undefined;
  const picked = wanted
    ? drivers.find((d) => d.driver.id === wanted)
    : drivers[0];
  if (wanted && !picked) {
    throw new Error(
      `Driver "${wanted}" not available. Detected: ${drivers.map((d) => d.driver.id).join(", ") || "none"}.`,
    );
  }
  const driver = picked!.driver;
  const fallbackDrivers = wanted
    ? []
    : drivers
        .filter((candidate) => candidate !== picked)
        .map((candidate) => candidate.driver);

  const app = await pickApp(installDir, ctx.interactive);
  if (!app) return;

  const existing = detectExisting(app);
  if (existing.fullyIntegrated)
    ui.success(`Superwall is already set up in \`${app.name}\`.`);
  else if (existing.sdkInstalled)
    ui.info(`Partial Superwall setup found in \`${app.name}\`.`);

  const billing = detectBilling(app);
  if (billing.revenueCat && ctx.interactive) {
    const intent = await ui.select({
      message: "You're using `RevenueCat`. What do you want Superwall for?",
      options: [
        {
          value: "paywalls",
          label: "Paywalls only - keep RevenueCat for billing",
        },
        { value: "migrate", label: "Fully migrate to Superwall" },
        { value: "later", label: "Decide later" },
      ],
      initialValue: "paywalls",
    });
    if (intent === null) return;
    ui.info(`RevenueCat: \`${intent}\``);
  }

  // Login is lazy: local agents can run without it, while the bundled
  // Superwall Agent needs OAuth because its hosted grant is user-scoped.
  let session = loadSession();
  if (session?.apiKey) process.env.SUPERWALL_API_KEY = session.apiKey;

  // Resolve the app scope in the background so the dashboard stages don't wait on it mid-flow.
  let scopePromise: ReturnType<typeof resolveScopeFromKey> | null = null;
  if (session && existing.apiKey) {
    scopePromise = resolveScopeFromKey(
      SuperwallApi.fromSession(),
      existing.apiKey,
    ).catch(() => null);
  }

  const ensureLogin = async (): Promise<boolean> => {
    if (session) return true;
    if (!ctx.interactive || dryRun) return false;
    const signedIn = await performLoginWithUi();
    if (!signedIn) return false;
    session = signedIn;
    if (session.apiKey) process.env.SUPERWALL_API_KEY = session.apiKey;
    return true;
  };

  let apiKey = existing.apiKey ?? "";
  let scope: Scope | null = null;
  let bundleId: string | undefined;
  if (!apiKey) {
    if (!ctx.interactive) {
      if (session) {
        const disc = await withSpinner("Finding your app", () =>
          discoverPublicApiKey(SuperwallApi.fromSession()),
        );
        if (disc) {
          apiKey = disc.apiKey;
          ui.info(
            `Using app \`${disc.app.name ?? disc.app.bundle_id ?? disc.app.id}\``,
          );
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
        scope = {
          projectId: bound.projectId,
          applicationId: bound.applicationId,
          appName: app.name,
        };
        bundleId = bound.app.bundle_id;
        ui.success(
          `Using \`${bound.app.name ?? bound.app.id}\` (${platformLabel(bound.app.platform)})`,
        );
      } catch (e) {
        ui.warn((e as Error).message);
      }
    }
  }
  if (!apiKey) {
    const account = await resolveAccount({
      existing,
      argv,
      interactive: ctx.interactive,
      ui: ctx.ui,
    });
    if (!account) return void ui.warn("Cancelled.");
    apiKey = account.apiKey;
  }
  const ctxAction: ActionContext = { app, apiKey, existing };
  const ensureAgentReady = () =>
    ensureAgentDriverReady(driver, ensureLogin, dryRun);

  ui.step("Step 1 · Integrate the SDK");
  if (existing.fullyIntegrated) {
    ui.info("SDK already integrated - skipped.");
  } else if (!dryRun) {
    const how = !ctx.interactive
      ? "now"
      : await ui.select({
          message: `Integrate the Superwall SDK into \`${app.name}\`?`,
          options: [
            { value: "now", label: "Integrate for me" },
            {
              value: "copy",
              label: "Copy the prompt",
              hint: "Run it in your own agent",
            },
          ],
          initialValue: "now",
        });
    if (how === null) return void ui.warn("Cancelled.");
    if (how === "copy") {
      await copyIntegrationPrompt(ctxAction);
      return void ui.outro(
        "Paste it into your agent, then run `superwall integrate` to continue.",
      );
    }
    if (!(await ensureAgentReady())) {
      if (ctx.interactive) {
        await copyIntegrationPrompt(ctxAction);
        ui.outro(
          "Paste it into your agent, or run `superwall login` and try again.",
        );
      }
      return;
    }
    await runActionWithUI(
      driver,
      fallbackDrivers,
      actionById["integrate"],
      ctxAction,
    );
    const spin = ui.spinner();
    spin.start("Installing Superwall skills for your agent");
    const ok = await installAgentSkills();
    spin.stop(ok ? "Superwall skills installed" : "Skill install skipped");
    if (!ok)
      throw new Error(
        "The integration completed, but the Superwall skills could not be installed.",
      );
  }

  // Dashboard stages run whenever we can resolve scope - interactively (after
  // app-binding) OR headless/CI when a session + app key are already present, so
  // `integrate` is fully non-interactive-capable (and benchable end-to-end).
  const canResolveHeadless = !ctx.interactive && !!apiKey && !!loadSession();
  if (
    !dryRun &&
    !scope &&
    (canResolveHeadless || (ctx.interactive && (await ensureLogin())))
  ) {
    const resolved = scopePromise
      ? await scopePromise
      : await withSpinner("Finding this app in Superwall", () =>
          resolveScopeFromKey(SuperwallApi.fromSession(), apiKey).catch(
            () => null,
          ),
        );
    if (resolved) {
      scope = resolved;
      bundleId = resolved.bundleId;
    }
  }
  if (scope) {
    const stageCtx: StageCtx = {
      api: SuperwallApi.fromSession(),
      scope,
      appName: app.name,
      bundleId,
      projectDir: app.path,
    };
    await stage("Step 2 · Products", () => runProductsStage(stageCtx));
    await stage("Step 3 · Campaigns & Placements", () =>
      runCampaignsAndPlacements(
        driver,
        fallbackDrivers,
        ctxAction,
        stageCtx,
        ensureAgentReady,
      ),
    );
    await stage("Step 4 · Paywall", () => runPaywallStage());
    await stage("Step 5 · Verify", () => runVerifyStage(stageCtx));
  } else if (!dryRun && ctx.interactive) {
    ui.step("Step 2 · Products, Campaigns, Paywall & Verify");
    ui.info(
      "Couldn't match this app in your Superwall org - set these up in the dashboard.",
    );
  }

  ui.outro(`Done.  ${DASHBOARD_URL}`);
}

async function runFlow(ctx: CommandContext, forced?: ActionId): Promise<void> {
  const { installDir, dryRun, argv } = ctx;
  ui.intro(`Superwall v${VERSION}`);

  const drivers = await withSpinner("Checking your setup", () =>
    detectDrivers(),
  );
  if (drivers.length === 0) {
    ui.warn("No coding agent found.");
    await runFallback(installDir);
    return;
  }
  const driver = drivers[0]!;
  const fallbackDrivers = drivers.slice(1).map((candidate) => candidate.driver);
  let session = loadSession();
  const ensureLogin = async (): Promise<boolean> => {
    if (session) return true;
    if (!ctx.interactive || dryRun) return false;
    const signedIn = await performLoginWithUi();
    if (!signedIn) return false;
    session = signedIn;
    if (session.apiKey) process.env.SUPERWALL_API_KEY = session.apiKey;
    return true;
  };

  const app = await pickApp(installDir, ctx.interactive);
  if (!app) return void ui.warn("Cancelled.");

  const existing = detectExisting(app);
  if (existing.fullyIntegrated)
    ui.success(`Superwall is already set up in \`${app.name}\`.`);
  else if (existing.sdkInstalled)
    ui.info(`Partial Superwall setup found in \`${app.name}\`.`);

  const choice = await chooseAction(forced, existing, app, ctx.interactive);
  if (!choice) return;
  const action = actionById[choice];

  if (
    action.requiresOrgKey &&
    !process.env.SUPERWALL_API_KEY &&
    !loadSession()
  ) {
    ui.warn(
      "That needs an authenticated session - run `superwall login` first (or set SUPERWALL_API_KEY).",
    );
    ui.outro("");
    return;
  }

  let apiKey = existing.apiKey ?? "";
  if (action.id === "integrate" || action.id === "dashboard-setup") {
    const account = await resolveAccount({
      existing,
      argv,
      interactive: ctx.interactive,
      ui: ctx.ui,
    });
    if (!account) return void ui.warn("Cancelled.");
    apiKey = account.apiKey;
  }

  const priorReport =
    action.id === "review-fix"
      ? loadReport(app.path, "review")
      : action.id === "placements-implement"
        ? loadReport(app.path, "placements-review")
        : undefined;
  const actionCtx: ActionContext = { app, apiKey, existing, priorReport };

  if (dryRun) {
    printPlan(driver.info.displayName, action, actionCtx);
    ui.outro("Dry run - no changes made.");
    return;
  }

  if (action.id === "integrate" && existing.fullyIntegrated) {
    ui.note(
      "SDK + configure() already present - no code changes made.",
      "Already integrated",
    );
  } else {
    if (!(await ensureAgentDriverReady(driver.driver, ensureLogin, dryRun)))
      return;
    await runActionWithUI(driver.driver, fallbackDrivers, action, actionCtx);
  }

  if (action.id === "integrate" && !existing.fullyIntegrated && !dryRun) {
    const spin = ui.spinner();
    spin.start("Installing Superwall skills for your agent");
    const ok = await installAgentSkills();
    spin.stop(ok ? "Superwall skills installed" : "Skill install skipped");
    if (!ok)
      throw new Error(
        "The integration completed, but the Superwall skills could not be installed.",
      );
  }
  finish(ctx, action);
}
