import { loadBundledSkill } from "@/core/skills/bundled";
import type { WizardAction } from "./types";

export const placementsImplementAction: WizardAction = {
  id: "placements-implement",
  title: "Implement placements",
  hint: "Add register() calls at the right feature gates",
  runningLabel: "Implementing placements",
  successLabel: "Placements implemented",
  requiresIntegration: true,
  requiresOrgKey: false,
  outputMode: "silent",
  readOnly: false,
  allowedTools: ["Read", "Write", "Edit", "Glob", "Grep", "Bash"],
  skill: (ctx) =>
    [
      ctx.priorReport
        ? `A prior placement review was run for this app. Act on its findings:\n\n${ctx.priorReport}\n\n---\n`
        : "",
      "Implement Superwall placements at the right feature-gate points in this app,",
      "and make sure each is routed through a campaign.",
      "",
      ctx.campaigns ? `## Current Superwall campaigns & placements\n${ctx.campaigns}\n` : "",
      loadBundledSkill("superwall-placements"),
      "",
      "Keep edits minimal and idiomatic — do not reformat or refactor unrelated code. If a build command exists, build to verify.",
      "Emit a [STATUS] before each step. Do not write a long summary. End with '[STATUS] Done'.",
    ].join("\n"),
};
