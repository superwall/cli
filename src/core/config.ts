import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

/**
 * Small, user-level CLI config at ~/.superwall/config.json. Separate from the
 * session (auth.json) — this is preferences, not credentials.
 */
interface Config {
  /** Preferred application per project id (for app-scoped commands). */
  defaultApp?: Record<string, string>;
}

function dir(): string {
  return join(homedir(), ".superwall");
}
function file(): string {
  return join(dir(), "config.json");
}

function read(): Config {
  try {
    return existsSync(file()) ? (JSON.parse(readFileSync(file(), "utf8")) as Config) : {};
  } catch {
    return {};
  }
}

function write(config: Config): void {
  mkdirSync(dir(), { recursive: true, mode: 0o700 });
  writeFileSync(file(), JSON.stringify(config, null, 2), { mode: 0o600 });
}

/** The remembered default app for a project, if any. */
export function getDefaultApp(projectId: string): string | undefined {
  return read().defaultApp?.[projectId];
}

/** Remember an app as the default for a project (used to preselect next time). */
export function setDefaultApp(projectId: string, applicationId: string): void {
  const config = read();
  config.defaultApp = { ...(config.defaultApp ?? {}), [projectId]: applicationId };
  write(config);
}
