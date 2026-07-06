import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export type BundledSkillId = "superwall-integrate" | "superwall-migrate" | "superwall-placements";

const cache = new Map<string, string>();

export function bundledSkillsDir(): string {
  return skillsRoot().replace(/\/$/, "");
}

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
