/**
 * The one UI entry point. Every command and helper imports `ui` from here —
 * never a backend directly — so output stays consistent and centrally routed.
 *
 * `selectRenderer` swaps the active backend once per run (the command lifecycle
 * wrapper calls it before `ui.start()`); `ui` is a stable singleton whose calls
 * always delegate to whichever backend is active. That indirection is what lets
 * the same command code render as a rich Ink timeline on a TTY and as plain
 * lines for an agent — decided in one place, not per call site.
 */
import { isNonInteractive } from "@/util/env";
import { inkRenderer } from "./ink/runtime";
import { plainRenderer } from "./plain/renderer";
import type { Renderer } from "./types";

let active: Renderer = plainRenderer;

/**
 * Choose the backend for this run. Defaults to plain when there's no
 * interactive TTY; pass `{ plain }` to force it (e.g. `--json` / `--no-ui`).
 */
export function selectRenderer(opts?: { plain?: boolean }): Renderer {
  const plain = opts?.plain ?? isNonInteractive();
  active = plain ? plainRenderer : inkRenderer;
  return active;
}

/** The currently-active backend (mostly for tests). */
export function currentRenderer(): Renderer {
  return active;
}

/** Stable facade — delegates to the active backend on every call. */
export const ui: Renderer = {
  start: () => active.start(),
  stop: () => active.stop(),
  intro: (t) => active.intro(t),
  step: (t) => active.step(t),
  info: (t) => active.info(t),
  success: (t) => active.success(t),
  warn: (t) => active.warn(t),
  error: (t) => active.error(t),
  note: (t, title) => active.note(t, title),
  report: (t) => active.report(t),
  list: (o) => active.list(o),
  outro: (t) => active.outro(t),
  spinner: () => active.spinner(),
  select: (o) => active.select(o),
  multiselect: (o) => active.multiselect(o),
  confirm: (o) => active.confirm(o),
  text: (o) => active.text(o),
};

export type { Renderer, Opt, SelectOpts, MultiSelectOpts, TextOpts, Spinner, ListItem, ListOpts } from "./types";
