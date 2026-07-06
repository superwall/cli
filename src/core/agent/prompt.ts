import { DASHBOARD_URL } from "@/constants";
import type { ActionContext, WizardAction } from "@/core/actions";

/**
 * A clean, self-contained version of the action prompt for the user to paste
 * into their own coding agent. Same content, minus the wizard-internal
 * `[STATUS]` progress protocol (irrelevant outside our headless runner).
 */
export function buildCopyPrompt(action: WizardAction, ctx: ActionContext): string {
  return buildActionPrompt(action, ctx)
    .split("\n")
    .filter((line) => !line.includes("[STATUS]"))
    .join("\n")
    .trimEnd();
}

/** Assemble the prompt for an action: project context + the action's skill body. */
export function buildActionPrompt(action: WizardAction, ctx: ActionContext): string {
  return [
    `# ${action.title} — ${ctx.app.framework.name}`,
    "",
    "## Project context",
    `- Platform: ${ctx.app.framework.name}${ctx.app.details ? ` (${ctx.app.details})` : ""}`,
    `- App directory: ${ctx.app.path}`,
    ctx.apiKey ? `- Public API key (SDK init): ${ctx.apiKey}` : "- Public API key: (not provided)",
    `- SDK installed: ${ctx.existing.sdkInstalled ? "yes" : "no"} · configure() present: ${ctx.existing.configureFound ? "yes" : "no"}`,
    `- Docs: ${ctx.app.framework.docsUrl}`,
    `- Dashboard (for the user, not you): ${DASHBOARD_URL}`,
    "",
    "## Task",
    action.skill(ctx),
  ].join("\n");
}
