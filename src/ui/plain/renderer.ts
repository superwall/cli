import { bold, brand, dim, green, red, styleMarkdown, yellow } from "@/ui/log";
import type { MultiSelectOpts, Renderer, SelectOpts, Spinner, TextOpts } from "../types";

function out(line: string): void {
  process.stdout.write(line + "\n");
}
function err(line: string): void {
  process.stderr.write(line + "\n");
}

function block(text: string, prefix = dim("│ ")): void {
  for (const line of styleMarkdown(text).split("\n")) out(prefix + line);
}

export const plainRenderer: Renderer = {
  start: () => {},
  stop: () => {},

  intro: (t) => out(brand(bold(`◆ ${styleMarkdown(t)}`))),
  step: (t) => out(`${brand("◇")} ${styleMarkdown(t)}`),
  info: (t) => out(`${brand("●")} ${styleMarkdown(t)}`),
  success: (t) => out(`${green("◆")} ${styleMarkdown(t)}`),
  warn: (t) => out(`${yellow("▲")} ${styleMarkdown(t)}`),
  error: (t) => err(`${red("■")} ${styleMarkdown(t)}`),

  note: (t, title) => {
    if (title) out(`${brand("◇")} ${styleMarkdown(title)}`);
    block(t);
  },
  report: (t) => block(t),
  list: (o) => {
    if (o.items.length === 0) {
      out(dim("│ ") + dim(o.empty ?? "None."));
      return;
    }
    o.items.forEach((it, i) => {
      const tail = [it.badge, it.meta].filter(Boolean).map(dim).join("  ");
      out(`${brand("●")} ${it.label}${tail ? "  " + tail : ""}`);
      for (const c of it.children ?? []) {
        // "│ " (one space) so child text aligns under the parent label.
        out(dim("│ ") + dim([c.badge, c.label, c.meta].filter(Boolean).join("  ")));
      }
      // Connector between rows only — no dangling gutter after the last.
      if (i < o.items.length - 1) out(dim("│"));
    });
  },
  outro: (t) => {
    if (t) out(`${dim("└")} ${styleMarkdown(t)}`);
  },

  spinner(): Spinner {
    return {
      start: (m) => out(`${dim("→")} ${styleMarkdown(m)}…`),
      message: () => {},
      stop: (m) => out(`${green("✓")} ${styleMarkdown(m)}`),
    };
  },

  async select(o: SelectOpts) {
    const initial = o.options.find((x) => x.value === o.initialValue && !x.disabled);
    const chosen = initial ?? o.options.find((x) => !x.disabled) ?? null;
    if (chosen) out(`${dim("?")} ${styleMarkdown(o.message)} ${dim("→")} ${chosen.label}`);
    return chosen?.value ?? null;
  },
  async multiselect(o: MultiSelectOpts) {
    return o.initialValues ?? o.options.map((x) => x.value);
  },
  async confirm(o) {
    return o.initial ?? true;
  },
  async text(o: TextOpts) {
    // Nothing to type into; hand back the (validated) empty default.
    return o.validate?.("") ? null : "";
  },
};
