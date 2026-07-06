/**
 * The single entry/exit path for every CLI command.
 *
 * `defineCommand` wraps a handler so that — for every command, without
 * exception — we resolve the common args the same way, pick the right UI
 * backend once, mount it, run the body, and tear it down. Errors surface
 * through one uniform path: a thrown `NotLoggedInError`/`ApiError`/`Error`
 * becomes a single styled `ui.error(...)` line and a non-zero exit code, so
 * commands can just `throw` instead of hand-rolling try/catch + console.error.
 *
 * The renderer is chosen here (TTY → Ink, otherwise plain) so a command never
 * has to know or care which backend it's talking to.
 */
import { resolve } from "node:path";
import type { Arguments } from "yargs";
import { selectRenderer } from "@/ui";
import type { Renderer } from "@/ui/types";
import { isNonInteractive } from "@/util/env";
import { ApiError, NotLoggedInError } from "@/core/api/client";

export interface CommandContext {
  /** Raw parsed args, for command-specific flags. */
  argv: Arguments;
  /** The active UI backend for this run. Same singleton as `@/ui`'s `ui`. */
  ui: Renderer;
  /** Absolute install/working directory (`--install-dir`, default cwd). */
  installDir: string;
  /** `--json` requested — emit machine-readable output, skip decorative UI. */
  json: boolean;
  /** `--dry-run` requested — plan without mutating. */
  dryRun: boolean;
  /** Plain (non-interactive) backend in use — no rich prompts/animation. */
  plain: boolean;
}

export type CommandHandler = (ctx: CommandContext) => void | Promise<void>;

/**
 * Turn a handler into a yargs command function with the shared lifecycle
 * (renderer selection, mount/unmount, uniform error handling) applied.
 */
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
      // Ink throttles its writer (~32ms). A fully-synchronous command (e.g.
      // `whoami`) would otherwise unmount before the final frame flushes and
      // print nothing. Give the interactive backend a beat to paint.
      if (!plain) await new Promise((resolve) => setTimeout(resolve, 50));
      ui.stop();
    }
  };
}

/** Collapse any thrown value into one styled error line. */
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
