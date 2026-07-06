import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/**
 * Bundled skills = the single source of truth for the wizard's integration /
 * migration / placement guidance. The `skills/` directory ships in the package
 * so it feeds both the wizard's headless agent (here) and, eventually, an
 * install into the user's own agent.
 */
export type BundledSkillId = "superwall-integrate" | "superwall-migrate" | "superwall-placements";

const cache = new Map<string, string>();

/** Absolute path to the bundled `skills/` directory (no trailing slash). */
export function bundledSkillsDir(): string {
  return skillsRoot().replace(/\/$/, "");
}

/** Locate the bundled `skills/` dir in both dev (src) and packaged (dist) layouts. */
function skillsRoot(): string {
  const candidates = [
    "../../../skills/", // dev:  src/core/skills/ → <repo>/skills
    "../skills/", //        prod: dist/ chunk    → <package>/skills
  ];
  for (const rel of candidates) {
    const dir = fileURLToPath(new URL(rel, import.meta.url));
    if (existsSync(dir)) return dir;
  }
  return fileURLToPath(new URL("../skills/", import.meta.url));
}

/**
 * The SKILL.md body (frontmatter stripped) for a bundled skill — the guidance we
 * inline into an agent prompt. Cached; returns "" if missing so callers degrade
 * gracefully rather than crash.
 */
export function loadBundledSkill(id: BundledSkillId): string {
  const cached = cache.get(id);
  if (cached !== undefined) return cached;
  let body = "";
  try {
    body = stripFrontmatter(readFileSync(`${skillsRoot()}${id}/SKILL.md`, "utf8")).trim();
  } catch {
    body = "";
  }
  cache.set(id, body);
  return body;
}

function stripFrontmatter(md: string): string {
  const lines = md.split("\n");
  if (lines[0]?.trim() === "---") {
    const end = lines.indexOf("---", 1);
    if (end > 0) return lines.slice(end + 1).join("\n");
  }
  return md;
}
