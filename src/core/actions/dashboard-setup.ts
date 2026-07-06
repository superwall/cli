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
      "Use the installed `superwall` skill (its `scripts/sw-api.sh` wrapper) for every REST call — it is",
      "authenticated via the org-scoped SUPERWALL_API_KEY. If that skill or key is missing, STOP and say so.",
      "",
      "Steps:",
      `1. Run \`sw-api.sh bootstrap\` and find the application whose public_api_key is ${ctx.apiKey || "(the app you're working on)"}.`,
      "2. Ensure an entitlement exists (e.g. 'pro').",
      "3. Find the placements registered in this app's code (the register(...) calls).",
      "4. For each placement, ensure a campaign exists that has it, with an audience matching everyone and a paywall attached. Create what's missing via the API.",
      "5. NEVER delete or destructively change existing campaigns, paywalls, or products.",
      "",
      "## Report",
      "Short-line markdown: what already existed, what you created (with campaign/placement/paywall ids),",
      "and any manual step left for the user (design the paywall, attach products, etc.).",
    ].join("\n"),
};
