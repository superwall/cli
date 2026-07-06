import { loadBundledSkill } from "@/core/skills/bundled";
import type { WizardAction } from "./types";

export const placementsReviewAction: WizardAction = {
  id: "placements-review",
  title: "Review placements",
  hint: "Audit every register() call + positioning",
  runningLabel: "Reviewing placements",
  successLabel: "Placement review complete",
  requiresIntegration: true,
  requiresOrgKey: false,
  outputMode: "report",
  readOnly: true,
  allowedTools: ["Read", "Glob", "Grep", "Bash"],
  skill: (ctx) =>
    [
      "Audit this app's Superwall placement usage. DO NOT modify any files.",
      "",
      ctx.campaigns
        ? `## Current Superwall campaigns & placements\n${ctx.campaigns}\n\nCross-reference these with the app's register() calls: flag placements in code that aren't on any campaign, and campaigns with no matching trigger in code.\n`
        : "",
      loadBundledSkill("superwall-placements"),
      "",
      "## Report",
      "Produce a concise final report with SHORT lines (wrap ~80 chars), as markdown bullets:",
      "- Placements found — one line each: `name — file:line — context`.",
      "- Issues — each with a one-line fix.",
      "- Suggested missing placements.",
      "- Final line: overall health (good / needs work).",
    ].join("\n"),
};
