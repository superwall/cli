import { resolve } from "node:path";
import type { Arguments } from "yargs";
import { selectRenderer } from "@/ui";
import type { Renderer } from "@/ui/types";
import { isNonInteractive } from "@/util/env";
import { ApiError, NotLoggedInError } from "@/core/api/client";

export interface CommandContext {
  argv: Arguments;
  ui: Renderer;
  installDir: string;
  json: boolean;
  dryRun: boolean;
  plain: boolean;
}

export type CommandHandler = (ctx: CommandContext) => void | Promise<void>;

/** Wrap a handler with the shared lifecycle: renderer selection, mount/unmount, error handling. */
export function defineCommand(handler: CommandHandler): (argv: Arguments) => Promise<void> {
  return async (argv) => {
    const json = Boolean(argv.json);
    // `--no-ui` arrives as `argv.ui === false`; JSON and non-TTY force plain too.
    const plain = json || argv.ui === false || isNonInteractive();
    const installDir = resolve((argv.installDir as string | undefined) ?? process.cwd());
    const ui = selectRenderer({ plain });

    ui.start();
    try {
      await handler({ argv, ui, installDir, json, dryRun: Boolean(argv.dryRun), plain });
    } catch (e) {
      reportError(ui, e);
      process.exitCode = 1;
    } finally {
      // Ink throttles its writer ~32ms; let a synchronous command paint its final frame before unmount.
      if (!plain) await new Promise((resolve) => setTimeout(resolve, 50));
      ui.stop();
    }
  };
}

function reportError(ui: Renderer, e: unknown): void {
  if (e instanceof NotLoggedInError) {
    ui.error("Not logged in. Run `superwall login`.");
    return;
  }
  if (e instanceof ApiError) {
    ui.error(`${e.message}${e.body ? ` — ${e.body.slice(0, 300)}` : ""}`);
    return;
  }
  ui.error(e instanceof Error ? e.message : String(e));
}
