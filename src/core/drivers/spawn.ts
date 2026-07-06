import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

/** Resolve a binary's version via `<bin> --version`, or undefined. */
export async function readVersion(bin: string): Promise<string | undefined> {
  try {
    const { stdout } = await execFileAsync(bin, ["--version"], { timeout: 5000 });
    return stdout.trim().split("\n")[0];
  } catch {
    return undefined;
  }
}

/** True if a binary is resolvable on PATH. */
export async function onPath(bin: string): Promise<boolean> {
  const probe = process.platform === "win32" ? "where" : "command";
  const args = process.platform === "win32" ? [bin] : ["-v", bin];
  try {
    await execFileAsync(probe, args, { timeout: 5000, shell: process.platform !== "win32" });
    return true;
  } catch {
    return false;
  }
}

export interface SpawnStreamOptions {
  bin: string;
  args: string[];
  cwd: string;
  /** Called once per line of stdout. */
  onStdoutLine: (line: string) => void;
  /** Called once per line of stderr (for debugging). */
  onStderrLine?: (line: string) => void;
  signal?: AbortSignal;
  env?: NodeJS.ProcessEnv;
}

export interface SpawnStreamResult {
  code: number | null;
}

/**
 * Spawn a subprocess and stream its stdout line-by-line. Resolves when the
 * process exits. Both agent CLIs emit JSONL on stdout, so line framing is all
 * we need at the transport layer.
 */
export function spawnStream(opts: SpawnStreamOptions): Promise<SpawnStreamResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(opts.bin, opts.args, {
      cwd: opts.cwd,
      env: opts.env ?? process.env,
      signal: opts.signal,
      stdio: ["ignore", "pipe", "pipe"],
    });

    const out = createInterface({ input: child.stdout });
    out.on("line", (line) => {
      if (line.length) opts.onStdoutLine(line);
    });

    if (opts.onStderrLine && child.stderr) {
      const err = createInterface({ input: child.stderr });
      err.on("line", (line) => {
        if (line.length) opts.onStderrLine!(line);
      });
    }

    child.on("error", (e) => {
      if ((e as NodeJS.ErrnoException).name === "AbortError") {
        resolve({ code: null });
        return;
      }
      reject(e);
    });
    child.on("close", (code) => resolve({ code }));
  });
}
