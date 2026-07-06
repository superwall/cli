/**
 * Brand theme — values mirror the Superwall design system
 * (packages/tailwind/src/styles.ts in the pwn monorepo). Single source of
 * truth for color across the whole CLI.
 */
export const THEME = {
  /** accent_light — bright cyan; the primary accent (titles, symbols, code). */
  primary: "#74FFF1",
  /** accent — muted teal; secondary/info. */
  accent: "#5DC6BD",
  /** alert — warnings + errors. */
  alert: "#FF7474",
  /** grayscale_lightest — muted text / tree bars. */
  muted: "#979797",
  /** accent_dark — text drawn on top of the primary color. */
  onPrimary: "#203133",
  /** grayscale_darkest — surface (terminal owns the real bg; for reference). */
  background: "#13151A",
} as const;

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Wrap text in a 24-bit foreground color. */
export function fg(hex: string, text: string): string {
  const [r, g, b] = hexToRgb(hex);
  return `\x1b[38;2;${r};${g};${b}m${text}\x1b[39m`;
}

/** Wrap text in a 24-bit background color. */
export function bg(hex: string, text: string): string {
  const [r, g, b] = hexToRgb(hex);
  return `\x1b[48;2;${r};${g};${b}m${text}\x1b[49m`;
}
