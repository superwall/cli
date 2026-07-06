import { ui } from "@/ui";
import type { CommandContext } from "@/command";

/** Data output: raw JSON to stdout for agents/pipes; a timeline block for humans. */
export function emitJson(ctx: CommandContext, data: unknown): void {
  const json = JSON.stringify(data, null, 2);
  if (ctx.plain) process.stdout.write(json + "\n");
  else ui.report(json);
}

/** Run an API call with a spinner — but only in interactive mode, so it never
 *  pollutes a plain/JSON stdout stream that a pipe or agent is parsing. */
export async function apiCall<T>(ctx: CommandContext, label: string, work: () => Promise<T>): Promise<T> {
  if (ctx.plain) return work();
  const spin = ui.spinner();
  spin.start(label);
  try {
    const result = await work();
    spin.stop(label);
    return result;
  } catch (e) {
    spin.stop("Failed");
    throw e;
  }
}
