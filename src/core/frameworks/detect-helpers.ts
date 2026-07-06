import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import fg from "fast-glob";

export function fileExists(dir: string, rel: string): boolean {
  return existsSync(join(dir, rel));
}

/** Read & parse package.json from a directory, or null. */
export function readPackageJson(dir: string): Record<string, unknown> | null {
  try {
    return JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
  } catch {
    return null;
  }
}

/** All deps (prod + dev) from a package.json object. */
export function allDeps(pkg: Record<string, unknown> | null): Record<string, string> {
  if (!pkg) return {};
  return {
    ...((pkg.dependencies as Record<string, string>) ?? {}),
    ...((pkg.devDependencies as Record<string, string>) ?? {}),
  };
}

/** Glob within a dir, ignoring common build/vendor noise. */
export async function glob(dir: string, pattern: string, onlyDirectories = false): Promise<string[]> {
  return fg(pattern, {
    cwd: dir,
    onlyDirectories,
    ignore: [
      "**/node_modules/**",
      "**/.build/**",
      "**/DerivedData/**",
      "**/build/**",
      "**/Pods/**",
      "**/*.xcodeproj/**",
    ],
  });
}
