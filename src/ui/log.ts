import pc from "picocolors";
import { THEME, fg } from "./theme";

/** Brand/primary accent applied to a string (truecolor). */
export function brand(text: string): string {
  return fg(THEME.primary, text);
}

export const dim = pc.dim;
export const bold = pc.bold;
export const green = pc.green;
export const red = pc.red;
export const yellow = pc.yellow;

/** A compact banner for the intro screen. */
export function banner(version: string): string {
  return `${brand(bold("◆ Superwall"))} ${dim("wizard")} ${dim(`v${version}`)}`;
}

/** Plain-text report: drop [STATUS] lines and trim surrounding blanks (for saving). */
export function stripReport(raw: string): string {
  const lines = raw
    .replace(/\r/g, "")
    .split("\n")
    .filter((l) => !/^\s*\[STATUS\]/i.test(l));
  while (lines.length && !lines[0]!.trim()) lines.shift();
  while (lines.length && !lines[lines.length - 1]!.trim()) lines.pop();
  return lines.join("\n");
}

/**
 * Render a markdown-ish report into clean, styled terminal lines:
 * headers → bold accent, **bold** → bold, `code` → accent.
 */
export function renderReport(raw: string): string[] {
  return stripReport(raw).split("\n").map(styleMarkdownLine);
}

/**
 * Style a (possibly multi-line) string of markdown-ish text: headers → bold
 * accent, **bold** → bold, `code` → accent. The plain renderer uses this so
 * inline formatting matches the Ink backend's `Inline` component.
 */
export function styleMarkdown(text: string): string {
  return text.split("\n").map(styleMarkdownLine).join("\n");
}

function styleMarkdownLine(line: string): string {
  const header = line.match(/^\s*(#{1,6})\s+(.*)$/);
  if (header) return brand(bold(header[2]!));
  let out = line.replace(/\*\*(.+?)\*\*/g, (_m, t: string) => bold(t));
  out = out.replace(/`([^`]+)`/g, (_m, t: string) => brand(t));
  return out;
}
