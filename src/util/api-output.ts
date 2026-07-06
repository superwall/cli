import { ui } from "@/ui";
import type { CommandContext } from "@/command";

export function emitJson(ctx: CommandContext, data: unknown): void {
  const json = JSON.stringify(data, null, 2);
  if (ctx.plain) process.stdout.write(json + "\n");
  else ui.report(json);
}

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
