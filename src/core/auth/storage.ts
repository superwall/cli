import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

/** Credentials persisted after a successful `superwall login`. */
export interface Session {
  /** Org-scoped API key for the REST API. */
  apiKey: string;
  orgId?: string;
  orgName?: string;
  /** How many orgs this account can act in — drives whether we label the org. */
  orgCount?: number;
  userEmail?: string;
  /** Backend host the key belongs to. */
  host: string;
  createdAt: string;
}

function dir(): string {
  return join(homedir(), ".superwall");
}
function file(): string {
  return join(dir(), "auth.json");
}

/** Persist the session to ~/.superwall/auth.json with owner-only perms. */
export function saveSession(session: Session): void {
  mkdirSync(dir(), { recursive: true, mode: 0o700 });
  writeFileSync(file(), JSON.stringify(session, null, 2), { mode: 0o600 });
}

export function loadSession(): Session | null {
  try {
    if (!existsSync(file())) return null;
    return JSON.parse(readFileSync(file(), "utf8")) as Session;
  } catch {
    return null;
  }
}

export function clearSession(): void {
  try {
    rmSync(file(), { force: true });
  } catch {
    /* ignore */
  }
}
