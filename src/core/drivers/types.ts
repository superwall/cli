/**
 * Agent driver abstraction.
 *
 * The Superwall wizard does not bundle a model or an API key. Instead it drives
 * whichever coding agent the developer already has installed — Claude Code
 * (`claude -p`) or Codex (`codex exec`) — in headless mode, normalizing each
 * tool's event stream into a common {@link AgentEvent} shape.
 *
 * If neither is installed we fall back to a deterministic, non-LLM path
 * (see core/agent/fallback).
 */

/** A normalized event emitted while an agent runs. */
export type AgentEvent =
  | { type: "text"; text: string }
  | { type: "tool"; name: string; summary?: string }
  | { type: "status"; text: string }
  | { type: "error"; message: string };

export interface AgentRunOptions {
  /** The fully-assembled user prompt. */
  prompt: string;
  /** Working directory the agent operates in. */
  cwd: string;
  /** Appended to the agent's system prompt (our "commandments"). */
  systemAppend?: string;
  /** Tool allowlist (driver maps to its own flag vocabulary). */
  allowedTools?: string[];
  /** No file mutations — drives sandbox/tools to read-only where supported. */
  readOnly?: boolean;
  /** Optional MCP servers, keyed by name → { url } (HTTP transport). */
  mcpServers?: Record<string, { url: string; headers?: Record<string, string> }>;
  /** Called for every normalized event as the run streams. */
  onEvent?: (event: AgentEvent) => void;
  /** Abort signal to cancel the run. */
  signal?: AbortSignal;
}

export interface AgentResult {
  /** Final assistant message / summary text, if the driver surfaced one. */
  finalText?: string;
  /** True when the agent reported a clean completion. */
  ok: boolean;
}

export interface DriverInfo {
  id: AgentDriverId;
  displayName: string;
  /** Resolved binary (name on PATH or absolute path). */
  bin: string;
  /** Version string if we could read it. */
  version?: string;
}

export type AgentDriverId = "claude" | "codex";

export interface AgentDriver {
  id: AgentDriverId;
  displayName: string;
  /** Resolve the binary + version, or null when not installed. */
  detect(): Promise<DriverInfo | null>;
  /** Run the agent headlessly, streaming normalized events. */
  run(options: AgentRunOptions): Promise<AgentResult>;
}
