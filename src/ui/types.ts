/**
 * The single UI contract every command speaks to.
 *
 * Two backends implement it: the rich Ink renderer (interactive TTY) and the
 * plain line renderer (agents, SSH, CI, `--json`, `--no-ui`). Commands never
 * import a backend directly — they call the `ui` facade in `@/ui`, which routes
 * to whichever backend was selected for the run. Keep this interface small and
 * presentation-only; anything a command needs must go through here so both
 * backends stay in lock-step.
 */

export interface Opt {
  value: string;
  label: string;
  hint?: string;
  /** Shown but not selectable (cursor skips it, rendered dim). */
  disabled?: boolean;
}

export interface SelectOpts {
  message: string;
  options: Opt[];
  initialValue?: string;
  /** Dim key hint under the prompt, e.g. "esc back". */
  footer?: string;
  /**
   * Don't commit this prompt to the permanent timeline on resolve — it lives
   * only in the live region. Lets a multi-step flow replace a step in place
   * (real back navigation) instead of appending a new line each time.
   */
  transient?: boolean;
}

export interface MultiSelectOpts {
  message: string;
  options: Opt[];
  initialValues?: string[];
}

export interface TextOpts {
  message: string;
  placeholder?: string;
  validate?: (v: string) => string | undefined;
  /** Dim key hint under the prompt, e.g. "esc back". */
  footer?: string;
  /** Don't commit to the permanent timeline on resolve (see SelectOpts). */
  transient?: boolean;
}

/**
 * One entry in a `list`. `label` is the primary (bright) text; `badge` and
 * `meta` are secondary (dimmed) — a platform tag / role and an id, say. Nest
 * `children` for sub-rows (a project's apps), which render fully dimmed.
 */
export interface ListItem {
  label: string;
  badge?: string;
  meta?: string;
  children?: ListItem[];
}

export interface ListOpts {
  items: ListItem[];
  /** Shown when `items` is empty. */
  empty?: string;
}

/** A single-line progress widget. `stop` resolves it into the timeline. */
export interface Spinner {
  start: (message: string) => void;
  message: (message: string) => void;
  stop: (message: string) => void;
}

/**
 * Everything a command can render. Prompt methods resolve to `null` when the
 * user cancels (Esc) or when a non-interactive backend has no answer to give.
 */
export interface Renderer {
  /** Mount the renderer. Called once per command by the lifecycle wrapper. */
  start: () => void;
  /** Unmount and release the terminal. Called once per command. */
  stop: () => void;

  intro: (text: string) => void;
  step: (text: string) => void;
  info: (text: string) => void;
  success: (text: string) => void;
  warn: (text: string) => void;
  error: (text: string) => void;
  note: (text: string, title?: string) => void;
  report: (text: string) => void;
  /** A structured, optionally-nested list — names primary, ids/tags dimmed. */
  list: (o: ListOpts) => void;
  outro: (text: string) => void;

  spinner: () => Spinner;
  select: (o: SelectOpts) => Promise<string | null>;
  multiselect: (o: MultiSelectOpts) => Promise<string[] | null>;
  confirm: (o: { message: string; initial?: boolean }) => Promise<boolean | null>;
  text: (o: TextOpts) => Promise<string | null>;
}
