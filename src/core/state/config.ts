import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { formatJson } from "@/util/json";

export interface SkillsSync {
  cliVersion: string;
  syncedAt: string;
  sourceSha?: string;
}

interface Config {
  defaultApp?: Record<string, string>;
  skillsSync?: SkillsSync;
  telemetry?: { anonymousId?: string; noticeShown?: boolean };
}

function dir(): string {
  return join(homedir(), ".superwall");
}
function file(): string {
  return join(dir(), "config.json");
}

function read(): Config {
  try {
    return existsSync(file())
      ? (JSON.parse(readFileSync(file(), "utf8")) as Config)
      : {};
  } catch {
    return {};
  }
}

function write(config: Config): void {
  mkdirSync(dir(), { recursive: true, mode: 0o700 });
  writeFileSync(file(), `${formatJson(config)}\n`, { mode: 0o600 });
}

export function getDefaultApp(projectId: string): string | undefined {
  return read().defaultApp?.[projectId];
}

export function setDefaultApp(projectId: string, applicationId: string): void {
  const config = read();
  config.defaultApp = {
    ...(config.defaultApp ?? {}),
    [projectId]: applicationId,
  };
  write(config);
}

export function getSkillsSync(): SkillsSync | undefined {
  return read().skillsSync;
}

export function setSkillsSync(sync: SkillsSync): void {
  const config = read();
  config.skillsSync = sync;
  write(config);
}

export function getAnonymousId(): string {
  const config = read();
  if (config.telemetry?.anonymousId) return config.telemetry.anonymousId;
  const anonymousId = randomUUID();
  config.telemetry = { ...config.telemetry, anonymousId };
  write(config);
  return anonymousId;
}

export function telemetryNoticeShown(): boolean {
  return Boolean(read().telemetry?.noticeShown);
}

export function setTelemetryNoticeShown(): void {
  const config = read();
  config.telemetry = { ...config.telemetry, noticeShown: true };
  write(config);
}
