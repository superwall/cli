import { readFileSync } from "node:fs";
import { packagedDir } from "@/util/assets";
import { spawnStream } from "./drivers/spawn";

export type BundledSkillId =
  | "superwall-integrate"
  | "superwall-migrate"
  | "superwall-placements"
  | "superwall-dashboard";

const cache = new Map<string, string>();

export function bundledSkillsDir(): string {
  return packagedDir("skills").replace(/\/$/, "");
}

/** SKILL.md body, plus references/<reference>.md when given (framework/provider-specific depth). */
export function loadBundledSkill(id: BundledSkillId, reference?: string): string {
  const key = reference ? `${id}#${reference}` : id;
  const cached = cache.get(key);
  if (cached !== undefined) return cached;
  const skill = readSkillFile(`${id}/SKILL.md`);
  const ref = reference ? readSkillFile(`${id}/references/${reference}.md`) : "";
  const body = [skill, ref].filter(Boolean).join("\n\n");
  cache.set(key, body);
  return body;
}

function readSkillFile(rel: string): string {
  try {
    return stripFrontmatter(readFileSync(`${packagedDir("skills")}${rel}`, "utf8")).trim();
  } catch {
    return "";
  }
}

function stripFrontmatter(md: string): string {
  const lines = md.split("\n");
  if (lines[0]?.trim() === "---") {
    const end = lines.indexOf("---", 1);
    if (end > 0) return lines.slice(end + 1).join("\n");
  }
  return md;
}

export const SUPERWALL_SKILLS_SOURCE = "superwall/skills";

export interface SkillInfo {
  name: string;
  summary: string;
}

// For display only; the actual set is resolved live by the `skills` CLI at install time.
export const KNOWN_SKILLS: SkillInfo[] = [
  {
    name: "superwall",
    summary: "REST API (campaigns, paywalls, products, entitlements), analytics, docs, SDK triage, dashboard links",
  },
  { name: "superwall-editor", summary: "Build & edit live paywalls, onboarding, and web2app flows from the CLI" },
  { name: "wwdc", summary: "WWDC session lookup, comparison, and citation" },
];

export interface InstallToolkitOptions {
  skills?: string[];
  cwd?: string;
  dryRun?: boolean;
  onProgress?: (line: string) => void;
}

export interface InstallToolkitResult {
  ok: boolean;
  command: string;
}

export async function installToolkit(opts: InstallToolkitOptions = {}): Promise<InstallToolkitResult> {
  const args = ["-y", "skills@latest", "add", SUPERWALL_SKILLS_SOURCE, "--global", "--yes"];
  if (opts.skills?.length) args.push("--skill", ...opts.skills);
  return runInstall(args, opts);
}

// `--copy` so the skills live independently of this package's install path.
export async function installBundledSkills(opts: InstallToolkitOptions = {}): Promise<InstallToolkitResult> {
  return runInstall(["-y", "skills@latest", "add", bundledSkillsDir(), "--global", "--yes", "--copy"], opts);
}

async function runInstall(args: string[], opts: InstallToolkitOptions): Promise<InstallToolkitResult> {
  const command = `npx ${args.join(" ")}`;
  if (opts.dryRun) return { ok: true, command };
  const { code } = await spawnStream({
    bin: "npx",
    args,
    cwd: opts.cwd ?? process.cwd(),
    onStdoutLine: (line) => opts.onProgress?.(line),
    onStderrLine: (line) => opts.onProgress?.(line),
  });
  return { ok: code === 0, command };
}
