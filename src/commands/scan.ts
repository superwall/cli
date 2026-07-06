import { ui } from "@/ui";
import { withSpinner } from "@/ui/spinner";
import { defineCommand } from "@/command";
import { SUPPORTED_LABEL } from "@/core/project/frameworks";
import { scanProject } from "@/core/project/scan";
import { detectExisting } from "@/core/project/existing";

export const runScan = defineCommand(async (ctx) => {
  const { installDir, json } = ctx;
  const result = json ? await scanProject(installDir) : await withSpinner("Scanning project", () => scanProject(installDir));

  const enriched = result.apps.map((app) => ({ app, existing: detectExisting(app) }));

  if (json) {
    process.stdout.write(
      JSON.stringify(
        {
          root: result.root,
          isMonorepo: result.isMonorepo,
          skipped: result.skipped,
          apps: enriched.map(({ app, existing }) => ({
            name: app.name,
            relPath: app.relPath,
            integration: app.integration,
            details: app.details,
            score: app.score,
            existing,
          })),
          comingSoon: result.comingSoon.map((a) => ({
            name: a.name,
            relPath: a.relPath,
            integration: a.integration,
            details: a.details,
          })),
        },
        null,
        2,
      ) + "\n",
    );
    return;
  }

  ui.intro("Superwall scan");
  if (enriched.length === 0 && result.comingSoon.length === 0) {
    ui.warn(`No ${SUPPORTED_LABEL} app found here.`);
    if (result.skipped.length) ui.info(`Skipped: ${result.skipped.join(", ")}`);
    ui.outro("");
    return;
  }

  ui.info(`${result.isMonorepo ? "Monorepo" : "Project"} · ${enriched.length} app(s)`);
  for (const { app, existing } of enriched) {
    const tags: string[] = [];
    if (existing.fullyIntegrated) tags.push("✓ Superwall set up");
    else if (existing.sdkInstalled) tags.push("partial");
    if (existing.apiKey) tags.push(existing.apiKey);
    ui.step(
      `\`${app.name}\` ${app.relPath}\n  ${app.framework.name}` +
        (app.details ? ` · ${app.details}` : "") +
        (tags.length ? `  [${tags.join(" · ")}]` : ""),
    );
  }
  for (const a of result.comingSoon) {
    ui.step(`${a.name} ${a.relPath}\n  ${a.framework.name}${a.details ? ` · ${a.details}` : ""} [coming soon]`);
  }
  if (result.skipped.length) ui.info(`Skipped (not paywall targets): ${result.skipped.join(", ")}`);
  ui.outro("");
});
