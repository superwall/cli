import { loadBundledSkill } from "@/core/skills/bundled";
import type { WizardAction } from "./types";

export const migrateAction: WizardAction = {
  id: "migrate",
  title: "Migrate to Superwall",
  hint: "Move products, entitlements & paywalls off your current provider",
  runningLabel: "Migrating to Superwall",
  successLabel: "Migration complete",
  requiresIntegration: false,
  requiresOrgKey: false,
  outputMode: "report",
  readOnly: false,
  allowedTools: ["Read", "Write", "Edit", "Glob", "Grep", "Bash"],
  skill: (ctx) => {
    const provider = ctx.billingProvider ?? "the current billing provider";
    const paywallsOnly = ctx.migrateIntent === "paywalls";
    return [
      `Migrate this app from ${provider} to Superwall — ${paywallsOnly ? `paywalls only, keep ${provider} for billing` : "full migration"}.`,
      "",
      loadBundledSkill("superwall-migrate"),
      "",
      "## Report",
      "Short-line markdown: the mapping (provider→Superwall), what you created (ids), what code changed, and any manual steps left.",
      "",
      "Emit a [STATUS] before each step.",
    ].join("\n");
  },
};
