import { readFileSync } from "node:fs";
import { packagedDir } from "@/util/assets";
import { spawnStream } from "./drivers/spawn";

export type BundledSkillId =
  | "superwall-integrate"
  | "superwall-migrate"
  | "superwall-review"
  | "superwall-placements"
  | "superwall-dashboard";

const cache = new Map<string, string>();

export function bundledSkillsDir(): string {
  return packagedDir("skills").replace(/\/$/, "");
}

/** SKILL.md body, plus references/<name>.md for each given reference (framework/provider depth). */
export function loadBundledSkill(id: BundledSkillId, reference?: string | Array<string | undefined>): string {
  const refs = (Array.isArray(reference) ? reference : [reference]).filter((r): r is string => !!r);
  const key = refs.length ? `${id}#${refs.join("+")}` : id;
  const cached = cache.get(key);
  if (cached !== undefined) return cached;
  const skill = readSkillFile(`${id}/SKILL.md`);
  const bodies = refs.map((r) => readSkillFile(`${id}/references/${r}.md`));
  const body = [skill, ...bodies].filter(Boolean).join("\n\n");
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

export const KNOWN_SKILLS: SkillInfo[] = [
  {
    name: "superwall",
    summary: "Resources, ClickHouse SQL analytics, docs, SDK triage, and dashboard links",
  },
  { name: "superwall-editor", summary: "Build & edit live paywalls, onboarding, and web2app flows from the CLI" },
  { name: "wwdc", summary: "WWDC session lookup, comparison, and citation" },
];

export async function fetchToolkitSkills(): Promise<SkillInfo[]> {
  try {
    const res = await fetch(`https://api.github.com/repos/${SUPERWALL_SKILLS_SOURCE}/contents/skills`, {
      headers: { accept: "application/vnd.github+json" },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return KNOWN_SKILLS;
    const entries = (await res.json()) as Array<{ name: string; type: string }>;
    const dirs = entries.filter((e) => e.type === "dir").map((e) => e.name);
    if (dirs.length === 0) return KNOWN_SKILLS;
    const skills = await Promise.all(
      dirs.map(async (name): Promise<SkillInfo> => ({ name, summary: await fetchSkillSummary(name) })),
    );
    // Main skill first, rest alphabetical.
    return skills.sort((a, b) => (a.name === "superwall" ? -1 : b.name === "superwall" ? 1 : a.name.localeCompare(b.name)));
  } catch {
    return KNOWN_SKILLS;
  }
}

async function fetchSkillSummary(name: string): Promise<string> {
  try {
    const res = await fetch(
      `https://raw.githubusercontent.com/${SUPERWALL_SKILLS_SOURCE}/main/skills/${name}/SKILL.md`,
      { signal: AbortSignal.timeout(6000) },
    );
    if (!res.ok) return "";
    const raw = (await res.text()).match(/^description:\s*(.+)$/m)?.[1] ?? "";
    const description = raw.trim().replace(/^["']|["'`]+$/g, "");
    const firstSentence = description.split(/(?<=\.)\s/)[0] ?? description;
    return firstSentence.length > 64 ? `${firstSentence.slice(0, 61)}…` : firstSentence;
  } catch {
    return "";
  }
}

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
  else args.push("--skill", "*");
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
