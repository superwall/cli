import { DASHBOARD_URL, VERSION } from "@/constants";
import { ui } from "@/ui";
import { defineCommand } from "@/command";
import { stripReport } from "@/ui/log";
import { isNonInteractive } from "@/util/env";
import { detectDrivers } from "@/core/agent/drivers";
import { scanProject } from "@/core/project/scan";
import { detectBilling } from "@/core/project/billing";
import { detectExisting } from "@/core/project/existing";
import { loadSession } from "@/core/auth/storage";
import { performLogin } from "@/core/auth/login";
import { runAction } from "@/core/agent/run";
import { saveReport } from "@/core/state/reports";
import { actionById, type ActionContext } from "@/core/agent/actions";

export const runMigrate = defineCommand(async (ctx) => {
  const { installDir, dryRun } = ctx;
  ui.intro(`Superwall migrate v${VERSION}`);

  const drivers = await detectDrivers();
  if (drivers.length === 0) {
    ui.error("No coding agent found (Claude Code or Codex).");
    ui.outro("");
    return;
  }
  const driver = drivers[0]!.driver;
  const fallbackDrivers = drivers.slice(1).map((candidate) => candidate.driver);

  const scan = await scanProject(installDir);
  const app = scan.apps[0];
  if (!app) {
    ui.error("No iOS / Expo / React Native / Flutter app found here.");
    ui.outro("");
    return;
  }
  ui.info(`Detected \`${app.framework.name}\`${app.details ? ` · \`${app.details}\`` : ""}`);

  const billing = detectBilling(app);
  const provider = billing.revenueCat
    ? "RevenueCat"
    : billing.adapty
      ? "Adapty"
      : billing.qonversion
        ? "Qonversion"
        : null;
  if (!provider) {
    ui.warn("No RevenueCat / Adapty / Qonversion detected — nothing to migrate.");
    ui.info("Starting fresh? Run `superwall integrate` to set up directly.");
    ui.outro("");
    return;
  }
  ui.info(`Found \`${provider}\``);

  let intent = "full";
  if (!isNonInteractive() && !dryRun) {
    const sel = await ui.select({
      message: `Migrate from ${provider} — how far?`,
      options: [
        { value: "full", label: "Full migration", hint: `replace ${provider} with Superwall` },
        { value: "paywalls", label: "Paywalls only", hint: `keep ${provider} for billing` },
      ],
      initialValue: "full",
    });
    if (sel === null) return void ui.warn("Cancelled.");
    intent = sel;
  }

  // Log in so the agent's `superwall` CLI calls are authenticated.
  let session = loadSession();
  if (!session && !isNonInteractive() && !dryRun) {
    const spin = ui.spinner();
    try {
      session = await performLogin({
        onVerify: ({ url, userCode }) => {
          ui.note(`If your browser didn't open, visit:\n\n${url}\n\nand enter the code  \`${userCode}\``, "Approve in your browser");
          spin.start("Waiting for you to approve in the browser");
        },
        onStatus: (m) => spin.message(m),
      });
      spin.stop("Logged in");
    } catch (e) {
      spin.stop("Login failed");
      ui.warn((e as Error).message);
    }
  }
  if (session) {
    ui.success(`Logged in as \`${session.userEmail ?? "you"}\`${session.orgName ? ` · \`${session.orgName}\`` : ""}`);
    if (session.apiKey) process.env.SUPERWALL_API_KEY = session.apiKey;
  }

  const existing = detectExisting(app);
  const actionCtx: ActionContext = {
    app,
    apiKey: existing.apiKey ?? "",
    existing,
    billingProvider: provider,
    migrateIntent: intent,
  };

  if (dryRun) {
    ui.note(
      [
        `Provider:  ${provider}`,
        `Mode:      ${intent}`,
        `App:       ${app.name} (${app.framework.name})`,
        `Path:      ${app.path}`,
      ].join("\n"),
      "Migration plan",
    );
    ui.outro("Dry run — no changes made.");
    return;
  }

  const spin = ui.spinner();
  spin.start(`Migrating from ${provider}`);
  const result = await runAction({
    driver,
    fallbackDrivers,
    action: actionById["migrate"],
    ctx: actionCtx,
    onEvent: (e) => {
      if (e.type === "status") spin.message(e.text);
    },
  });
  if (result.ok) {
    spin.stop("Migration complete");
    if (result.finalText) {
      const plain = stripReport(result.finalText);
      saveReport(app.path, "migrate", plain);
      ui.report(plain);
    }
  } else {
    spin.stop("Migration stopped early");
    if (result.finalText) ui.report(stripReport(result.finalText).slice(0, 1500));
  }
  ui.note(
    ["Design & attach products to your paywalls in the dashboard.", "Verify a purchase on device."]
      .map((s, i) => `${i + 1}. ${s}`)
      .join("\n"),
    "Next steps",
  );
  ui.outro(`Done.  ${DASHBOARD_URL}`);
});
