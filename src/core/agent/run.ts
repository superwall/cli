import type { AgentDriver, AgentEvent, AgentResult } from "./drivers";
import type { ActionContext, WizardAction } from "./actions";
import { buildActionPrompt, getCommandments } from "./prompt";

export interface RunActionOptions {
  driver: AgentDriver;
  action: WizardAction;
  ctx: ActionContext;
  onEvent?: (event: AgentEvent) => void;
  signal?: AbortSignal;
}

export async function runAction(opts: RunActionOptions): Promise<AgentResult> {
  return opts.driver.run({
    prompt: buildActionPrompt(opts.action, opts.ctx),
    cwd: opts.ctx.app.path,
    systemAppend: getCommandments(),
    allowedTools: opts.action.allowedTools,
    readOnly: opts.action.readOnly,
    onEvent: opts.onEvent,
    signal: opts.signal,
  });
}
