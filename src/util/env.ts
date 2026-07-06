import { ENV_API_KEY } from "@/constants";

/** Read a Superwall public API key from the environment, if present. */
export function apiKeyFromEnv(): string | undefined {
  const v = process.env[ENV_API_KEY];
  return v && v.trim() ? v.trim() : undefined;
}

/** True when there is no interactive TTY (CI, piped input, some IDE shells). */
export function isNonInteractive(): boolean {
  return !process.stdout.isTTY || !process.stdin.isTTY || process.env.CI === "true";
}
