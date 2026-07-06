import { spawnStream } from "@/core/drivers/spawn";
import { bundledSkillsDir } from "./bundled";

/** The published Superwall skills source (github: owner/repo). */
export const SUPERWALL_SKILLS_SOURCE = "superwall/skills";

export interface SkillInfo {
  name: string;
  summary: string;
}

/**
 * The skills published by superwall/skills. Kept here for display; the actual
 * set is resolved live by the `skills` CLI at install time, so new skills added
 * to the repo install automatically without a wizard release.
 */
export const KNOWN_SKILLS: SkillInfo[] = [
  {
    name: "superwall",
    summary: "REST API (campaigns, paywalls, products, entitlements), analytics, docs, SDK triage, dashboard links",
  },
  { name: "superwall-editor", summary: "Build & edit live paywalls, onboarding, and web2app flows from the CLI" },
  { name: "wwdc", summary: "WWDC session lookup, comparison, and citation" },
];

export interface InstallToolkitOptions {
  /** Restrict to specific skills by name (default: all). */
  skills?: string[];
  cwd?: string;
  /** Print the command instead of running it. */
  dryRun?: boolean;
  onProgress?: (line: string) => void;
}

export interface InstallToolkitResult {
  ok: boolean;
  command: string;
}

/**
 * Install the Superwall agent toolkit using the open `skills` CLI — the
 * gold-standard installer (canonical ~/.agents/skills + per-agent symlinks,
 * 67+ agents, copy fallback). Installs GLOBALLY so every agent on the machine
 * gets them, not just this project.
 *
 *   npx skills add superwall/skills --global --yes [--skill <name>...]
 */
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

/**
 * Install the CLI's BUNDLED skills (integration / migration / placements) to
 * every installed agent, using the same `skills` CLI against the local `skills/`
 * dir. `--copy` so the skills live independently of this package's install path.
 * These are richer than the public toolkit and don't appear in its picker.
 */
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
