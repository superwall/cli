import { isNonInteractive } from "@/util/env";
import { inkRenderer } from "./ink/runtime";
import { plainRenderer } from "./plain/renderer";
import type { Renderer } from "./types";

let active: Renderer = plainRenderer;

export function selectRenderer(opts?: { plain?: boolean }): Renderer {
  const plain = opts?.plain ?? isNonInteractive();
  active = plain ? plainRenderer : inkRenderer;
  return active;
}

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
