import { spawnStream } from "@/core/drivers/spawn";
import { bundledSkillsDir } from "./bundled";

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

// `--copy` so the skills live independently of this package's install path.
export async function installBundledSkills(opts: InstallToolkitOptions = {}): Promise<InstallToolkitResult> {
  const args = ["-y", "skills@latest", "add", bundledSkillsDir(), "--global", "--yes", "--copy"];
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
