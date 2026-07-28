import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { DASHBOARD_URL, VERSION } from "@/constants";
import { ui } from "@/ui";
import { defineCommand } from "@/command";
import { blocks } from "@/output";
import { stripReport } from "@/ui/log";
import { detectDrivers } from "@/core/agent/drivers";
import { scanProject } from "@/core/project/scan";
import { detectBilling } from "@/core/project/billing";
import { detectExisting } from "@/core/project/existing";
import { loadSession } from "@/core/auth/storage";
import { performLoginWithUi } from "./integrate/app";
import { runAction } from "@/core/agent/run";
import { saveReport } from "@/core/state/reports";
import { copyToClipboard } from "@/util/clipboard";
import { actionById, type ActionContext } from "@/core/agent/actions";

export const runMigrate = defineCommand({
  name: "migrate",
  auth: "optional",
  async run(ctx) {
    const { installDir, dryRun } = ctx;
    const plan = Boolean(ctx.argv.plan);
    ui.intro(`Superwall migrate v${VERSION}`);

    const drivers = await detectDrivers();
    if (drivers.length === 0) {
      throw new Error("No coding agent found (Claude Code or Codex).");
    }
    const driver = drivers[0]!.driver;
    const fallbackDrivers = drivers
      .slice(1)
      .map((candidate) => candidate.driver);

    const scan = await scanProject(installDir);
    const app = scan.apps[0];
    if (!app) {
      throw new Error("No iOS / Expo / React Native / Flutter app found here.");
    }
    ui.info(
      `Detected \`${app.framework.name}\`${app.details ? ` · \`${app.details}\`` : ""}`,
    );

    const billing = detectBilling(app);
    const provider = billing.revenueCat
      ? "RevenueCat"
      : billing.adapty
        ? "Adapty"
        : billing.qonversion
          ? "Qonversion"
          : null;
    if (!provider) {
      ui.warn(
        "No RevenueCat / Adapty / Qonversion detected - nothing to migrate.",
      );
      ui.info("Starting fresh? Run `superwall integrate` to set up directly.");
      ui.outro("");
      return;
    }
    ui.info(`Found \`${provider}\``);

    let mode = plan ? "plan" : "migrate";
    if (ctx.interactive && !dryRun) {
      const sel = await ui.select({
        message: `How do you want to migrate from ${provider}?`,
        options: [
          {
            value: "plan",
            label: "Plan first",
            hint: "write a reviewable plan you run yourself",
          },
          {
            value: "migrate",
            label: "Migrate now",
            hint: "let the agent do it end-to-end",
          },
        ],
        initialValue: "plan",
      });
      if (sel === null) return void ui.warn("Cancelled.");
      mode = sel;
    }

    let intent = "full";
    if (ctx.interactive && !dryRun) {
      const sel = await ui.select({
        message: `Migrate from ${provider} - how far?`,
        options: [
          {
            value: "full",
            label: "Full migration",
            hint: `replace ${provider} with Superwall`,
          },
          {
            value: "paywalls",
            label: "Paywalls only",
            hint: `keep ${provider} for billing`,
          },
        ],
        initialValue: "full",
      });
      if (sel === null) return void ui.warn("Cancelled.");
      intent = sel;
    }

    // Log in so the agent's `superwall` CLI calls are authenticated.
    let session = loadSession();
    if (session) {
      ui.success(
        `Logged in as \`${session.userEmail ?? "you"}\`${session.orgName ? ` · \`${session.orgName}\`` : ""}`,
      );
    } else if (ctx.interactive && !dryRun) {
      session = await performLoginWithUi();
    }
    if (session?.apiKey) process.env.SUPERWALL_API_KEY = session.apiKey;

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
          `Mode:      ${mode === "plan" ? "plan first" : "migrate now"}`,
          `Scope:     ${intent}`,
          `App:       ${app.name} (${app.framework.name})`,
          `Path:      ${app.path}`,
        ].join("\n"),
        "Migration plan",
      );
      ui.outro("Dry run - no changes made.");
      return;
    }

    if (mode === "plan") {
      const spin = ui.spinner();
      spin.start(`Planning migration from ${provider}`);
      const result = await runAction({
        driver,
        fallbackDrivers,
        action: actionById["migrate-plan"],
        ctx: actionCtx,
        onEvent: (e) => {
          if (e.type === "status") spin.message(e.text);
        },
      });
      if (!result.ok || !result.finalText) {
        spin.stop("Planning stopped early");
        if (result.finalText)
          ui.report(stripReport(result.finalText).slice(0, 1500));
        throw new Error("Migration plan did not complete.");
      }
      spin.stop("Migration plan ready");
      const planText = stripReport(result.finalText);
      writeFileSync(join(app.path, "sw-migration.md"), planText, "utf8");
      ui.report(planText);

      const runPrompt = "implement the plan at sw-migration.md";
      const copied = await copyToClipboard(runPrompt);
      if (copied) {
        ui.note(
          `\`${runPrompt}\` - paste it into Claude Code, Codex, Cursor, or another coding agent.`,
          "Copied to clipboard",
        );
      } else {
        ui.note(runPrompt, "Copy this into your agent to run the migration");
      }

      ctx.output.render(
        blocks.nextSteps([
          "Review `sw-migration.md`.",
          "Paste `implement the plan at sw-migration.md` into your agent to execute.",
        ]),
        blocks.outro(`Done.  ${DASHBOARD_URL}`),
      );
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
      if (result.finalText)
        ui.report(stripReport(result.finalText).slice(0, 1500));
      throw new Error("Migration did not complete.");
    }
    ctx.output.render(
      blocks.nextSteps([
        "Design & attach products to your paywalls in the dashboard.",
        "Verify a purchase on device.",
      ]),
      blocks.outro(`Done.  ${DASHBOARD_URL}`),
    );
  },
});
