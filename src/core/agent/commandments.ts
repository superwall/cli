const COMMANDMENTS = [
  "You are integrating Superwall into the user's app. Make the smallest set of edits that achieves a working, verifiable integration. Do not refactor unrelated code or reformat files.",

  "Never invent or guess a Superwall API key. Use the exact public key provided in the prompt. Never write any API key directly into source that would be committed as a secret — prefer an environment variable or the platform's standard config mechanism, except where the public Superwall key is conventionally inlined (e.g. iOS configure()).",

  "Before editing any file, read it first. Match the file's existing style and conventions.",

  "Detect the package manager from the project (lockfiles, config) rather than assuming npm/yarn/pnpm/pod/spm.",

  "Emit a one-line progress update prefixed with '[STATUS] ' before EVERY step, including before running any shell command (e.g. '[STATUS] Installing the Superwall package', '[STATUS] Building to verify'). The user only sees these [STATUS] lines — they do NOT see your tool calls, bash commands, or other prose — so keep a fresh, human-readable [STATUS] flowing the whole way through. Never go more than one tool call without a [STATUS] update.",

  "Follow the Task section's output instructions exactly: for an implementation task, do NOT write a long summary — end with '[STATUS] Done'; for a review/report task, end with the concise report it asks for.",

  "If you cannot complete the integration safely (ambiguous project, missing entry point, would require destructive changes), stop and explain what you need instead of guessing.",
].join("\n\n");

export function getCommandments(): string {
  return COMMANDMENTS;
}
