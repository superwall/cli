import { basename, dirname, join, relative, sep } from "node:path";
import { existsSync, readFileSync } from "node:fs";
import fg from "fast-glob";
import { Integration } from "@/constants";
import type { Framework } from "@/core/frameworks";
import { frameworkByIntegration } from "./framework";
import { allDeps, readPackageJson } from "@/core/frameworks/detect-helpers";

export interface DetectedApp {
  /** Absolute path to the app root. */
  path: string;
  /** Path relative to the scan root ("." for the root itself). */
  relPath: string;
  /** Display name (directory basename). */
  name: string;
  framework: Framework;
  integration: Integration;
  /** Free-form note (e.g. "SwiftUI", "Expo 56", "next"). */
  details?: string;
  /** Confidence 0..1. */
  score: number;
}

export interface ScanResult {
  root: string;
  isMonorepo: boolean;
  /** Supported apps the wizard can set up, sorted by confidence (highest first). */
  apps: DetectedApp[];
  /** Detected but not-yet-supported apps (web) — shown as "coming soon". */
  comingSoon: DetectedApp[];
  /** Names of packages we found but skipped (backends, libs) — for messaging. */
  skipped: string[];
}

const IGNORE = [
  "**/node_modules/**",
  "**/.git/**",
  "**/.build/**",
  "**/DerivedData/**",
  "**/Pods/**",
  "**/build/**",
  "**/dist/**",
  "**/.next/**",
  "**/.expo/**",
  "**/vendor/**",
  "**/.turbo/**",
];

const SCAN_DEPTH = 6;

/** Frontend frameworks that make a JS package a paywall-capable web target. */
const FRONTEND_DEPS = [
  "next",
  "nuxt",
  "astro",
  "@sveltejs/kit",
  "@angular/core",
  "@remix-run/react",
  "@tanstack/react-start",
  "gatsby",
  "vite",
  "react-dom",
  "vue",
  "svelte",
  "solid-js",
  "preact",
];

interface Classification {
  integration: Integration;
  details?: string;
  score: number;
}

/** Classify a directory that contains a package.json by its dependencies. */
function classifyJs(dir: string): Classification | null {
  const pkg = readPackageJson(dir);
  if (!pkg) return null;
  const deps = allDeps(pkg);
  if ("expo" in deps) return { integration: Integration.expo, details: `Expo ${deps.expo}`, score: 0.96 };
  if ("react-native" in deps)
    return { integration: Integration.reactNative, details: deps["react-native"], score: 0.9 };
  const fe = FRONTEND_DEPS.find((d) => d in deps);
  if (fe) return { integration: Integration.web, details: fe, score: 0.7 };
  return null; // backend / tooling / library — not a paywall target
}

/** SwiftUI vs UIKit by scanning a single app's sources. */
function swiftUiKind(dir: string): string {
  const files = fg.sync("**/*.swift", {
    cwd: dir,
    ignore: IGNORE,
    absolute: true,
    deep: 6,
  });
  let swiftui = false;
  let uikit = false;
  for (const f of files.slice(0, 300)) {
    try {
      const c = readFileSync(f, "utf8");
      if (c.includes("import SwiftUI")) swiftui = true;
      else if (c.includes("import UIKit")) uikit = true;
    } catch {
      /* ignore */
    }
    if (swiftui) break; // SwiftUI wins; no need to keep scanning
  }
  if (swiftui) return "SwiftUI";
  if (uikit) return "UIKit";
  return "Swift";
}

/**
 * A `.xcodeproj` / `Package.swift` inside an `ios/`(or `android/`) directory
 * that sits under a JS app root is a *generated* native project (Expo prebuild /
 * RN). It is not a standalone Swift app — skip it.
 */
function isGeneratedNative(swiftDir: string, jsRoots: Set<string>): boolean {
  const segs = swiftDir.split(sep);
  if (!segs.includes("ios") && !segs.includes("android")) return false;
  let cur = swiftDir;
  while (true) {
    const parent = dirname(cur);
    if (parent === cur) break;
    if (jsRoots.has(parent)) return true;
    cur = parent;
  }
  return false;
}

/** A shared-library location in a monorepo (not a deployable app). */
function isLibraryPath(dir: string): boolean {
  return (
    dir.includes(`${sep}packages${sep}`) ||
    dir.includes(`${sep}libs${sep}`) ||
    dir.includes(`${sep}node_modules${sep}`)
  );
}

function makeApp(root: string, dir: string, c: Classification): DetectedApp {
  const rel = relative(root, dir) || ".";
  return {
    path: dir,
    relPath: rel,
    name: rel === "." ? basename(root) : basename(dir),
    framework: frameworkByIntegration[c.integration],
    integration: c.integration,
    details: c.details,
    score: c.score,
  };
}

function looksLikeMonorepoRoot(root: string): boolean {
  return (
    existsSync(join(root, "turbo.json")) ||
    existsSync(join(root, "pnpm-workspace.yaml")) ||
    existsSync(join(root, "nx.json")) ||
    existsSync(join(root, "lerna.json")) ||
    Array.isArray((readPackageJson(root) ?? {}).workspaces) ||
    typeof (readPackageJson(root) ?? {}).workspaces === "object"
  );
}

/**
 * Scan a directory (single app or monorepo) and return every paywall-capable
 * app found, with the generated native projects of RN/Expo apps filtered out.
 */
export async function scanProject(root: string): Promise<ScanResult> {
  const opts = { cwd: root, ignore: IGNORE, deep: SCAN_DEPTH } as const;
  const [pkgPaths, xcodeProjects, packageSwifts, pubspecs] = await Promise.all([
    fg("**/package.json", opts),
    fg("**/*.xcodeproj", { ...opts, onlyDirectories: true }),
    fg("**/Package.swift", opts),
    fg("**/pubspec.yaml", opts),
  ]);

  const jsRoots = pkgPaths.map((p) => dirname(join(root, p)));
  const jsRootSet = new Set(jsRoots);

  const apps: DetectedApp[] = [];
  const skipped: string[] = [];

  // JS apps. Skip shared libraries (packages/*, libs/*) — they aren't apps,
  // even when they pull in a frontend dep like react-dom.
  for (const dir of jsRoots) {
    if (isLibraryPath(dir)) continue;
    const c = classifyJs(dir);
    if (c) apps.push(makeApp(root, dir, c));
    else if (dir !== root) skipped.push(basename(dir));
  }

  // Native Swift apps (excluding generated native projects of JS apps)
  const swiftDirs = new Set<string>();
  for (const x of xcodeProjects) swiftDirs.add(dirname(join(root, x)));
  for (const s of packageSwifts) swiftDirs.add(dirname(join(root, s)));
  for (const dir of swiftDirs) {
    if (isGeneratedNative(dir, jsRootSet)) continue;
    apps.push(makeApp(root, dir, { integration: Integration.swift, details: swiftUiKind(dir), score: 0.95 }));
  }

  // Flutter apps
  for (const p of pubspecs) {
    const dir = dirname(join(root, p));
    apps.push(makeApp(root, dir, { integration: Integration.flutter, score: 0.9 }));
  }

  // Dedup by path (keep highest score), then sort.
  const byPath = new Map<string, DetectedApp>();
  for (const app of apps) {
    const prev = byPath.get(app.path);
    if (!prev || app.score > prev.score) byPath.set(app.path, app);
  }
  const deduped = [...byPath.values()].sort((a, b) => b.score - a.score);

  // Web is detected but not yet supported — surface it separately as "coming soon".
  const supported = deduped.filter((a) => a.framework.supported);
  const comingSoon = deduped.filter((a) => !a.framework.supported);

  return {
    root,
    isMonorepo: looksLikeMonorepoRoot(root) || deduped.length > 1,
    apps: supported,
    comingSoon,
    skipped: [...new Set(skipped)],
  };
}
