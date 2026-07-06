import { ui } from "@/ui";
import { defineCommand } from "@/command";
import { detectDrivers } from "@/core/drivers";
import { scanProject } from "@/core/detection/scan";
import { detectExisting } from "@/core/detection/existing";
import { apiKeyFromEnv } from "@/util/env";

/**
 * `superwall doctor` — report the integration's health.
 *
 * v1: deterministic checks only. The cross-system checks from the brainstorm
 * (placement in code ↔ campaign, product ids ↔ App Store Connect) land here as
 * the product grows.
 */
export const runDoctor = defineCommand(async (ctx) => {
  ui.intro("Superwall doctor");

  const spin = ui.spinner();
  spin.start("Checking your setup");
  const drivers = await detectDrivers();
  const scan = await scanProject(ctx.installDir);
  spin.stop("Checks complete");

  check(drivers.length > 0, `Coding agent: ${drivers.map((d) => d.info.displayName).join(", ") || "none"}`);

  const top = scan.apps[0];
  if (!top && scan.comingSoon[0]) {
    check(false, `Project: ${scan.comingSoon[0].framework.name} (web — coming soon)`);
  } else {
    check(!!top, top ? `Project: ${top.framework.name}${top.details ? ` (${top.details})` : ""}` : "Project: not detected");
  }

  if (top) {
    const existing = detectExisting(top);
    check(existing.sdkInstalled, `SDK installed: ${existing.sdkInstalled ? "yes" : "no"}`);
    check(existing.configureFound, `configure() present: ${existing.configureFound ? "yes" : "no"}`);
    check(!!existing.apiKey, existing.apiKey ? `API key in project: ${existing.apiKey}` : "API key in project: none");
  }

  if (apiKeyFromEnv()) check(true, "API key: found in environment");

  ui.note("Coming soon: placement ↔ campaign and product ↔ App Store Connect checks.", "Roadmap");
  ui.outro("");
});

/** A single health line: green tick when healthy, amber warning when not. */
function check(ok: boolean, text: string): void {
  if (ok) ui.success(text);
  else ui.warn(text);
}
