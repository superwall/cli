import { loadBundledSkill } from "@/core/skills/bundled";
import type { WizardAction } from "./types";

export const integrateAction: WizardAction = {
  id: "integrate",
  title: "Integrate the SDK",
  hint: "Install + configure the Superwall SDK",
  runningLabel: "Starting the integration",
  successLabel: "Integration complete",
  requiresIntegration: false,
  requiresOrgKey: false,
  outputMode: "silent",
  readOnly: false,
  allowedTools: ["Read", "Write", "Edit", "Glob", "Grep", "Bash"],
  skill: (ctx) =>
    [
      ctx.app.framework.promptSnippet({ installDir: ctx.app.path, details: ctx.app.details }),
      "",
      loadBundledSkill("superwall-integrate"),
      "",
      "Emit a [STATUS] before each step. Do not write a long summary. End with '[STATUS] Done'.",
    ].join("\n"),
};
