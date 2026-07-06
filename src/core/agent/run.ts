import type { AgentDriver, AgentEvent, AgentResult } from "@/core/drivers";
import type { ActionContext, WizardAction } from "@/core/actions";
import { getCommandments } from "./commandments";
import { buildActionPrompt } from "./prompt";

export interface RunActionOptions {
  driver: AgentDriver;
  action: WizardAction;
  ctx: ActionContext;
  onEvent?: (event: AgentEvent) => void;
  signal?: AbortSignal;
}

/** Drive the chosen agent through one internal action (integrate, review, etc.). */
export async function runAction(opts: RunActionOptions): Promise<AgentResult> {
  const prompt = buildActionPrompt(opts.action, opts.ctx);
  return opts.driver.run({
    prompt,
    cwd: opts.ctx.app.path,
    systemAppend: getCommandments(),
    allowedTools: opts.action.allowedTools,
    readOnly: opts.action.readOnly,
    onEvent: opts.onEvent,
    signal: opts.signal,
  });
}
