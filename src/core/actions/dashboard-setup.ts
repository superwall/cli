import type { WizardAction } from "./types";

export const dashboardSetupAction: WizardAction = {
  id: "dashboard-setup",
  title: "Set up the dashboard",
  hint: "Create a campaign + placement so paywalls present",
  runningLabel: "Setting up the dashboard",
  successLabel: "Dashboard configured",
  requiresIntegration: false,
  requiresOrgKey: true,
  outputMode: "report",
  readOnly: false, // needs network for the REST API, even though it edits no files
  allowedTools: ["Read", "Glob", "Grep", "Bash"],
  skill: (ctx) =>
    [
      "Set up this app's Superwall dashboard so its placements actually present paywalls.",
      "A registered placement does nothing until a campaign routes it to a paywall.",
      "",
      "Use the globally-installed `superwall` CLI for every dashboard change — it is already",
      "authenticated. Every subcommand takes `--json`. Scope to a specific app with `--app <id>`.",
      "",
      "Steps:",
      `1. Run \`superwall apps list --json\` and find the app whose public_api_key is ${ctx.apiKey || "(the app you're working on)"}; note its id for \`--app\`.`,
      "2. Ensure an entitlement exists: `superwall entitlements list --json`, else `superwall entitlements create pro --json`.",
      "3. Find the placements registered in this app's code (the register(...) calls).",
      "4. For each placement, ensure a campaign carries it: `superwall campaigns list --json`, create with",
      "   `superwall campaigns create <description> --json`, then `superwall campaigns placement <campaignId> <placement> --json`.",
      "5. NEVER delete or destructively change existing campaigns, paywalls, or products.",
      "",
      "## Report",
      "Short-line markdown: what already existed, what you created (with campaign/placement/paywall ids),",
      "and any manual step left for the user (design the paywall, attach products, etc.).",
    ].join("\n"),
};
