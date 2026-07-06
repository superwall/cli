export type AgentEvent =
  | { type: "text"; text: string }
  | { type: "tool"; name: string; summary?: string }
  | { type: "status"; text: string }
  | { type: "error"; message: string };

export interface AgentRunOptions {
  prompt: string;
  cwd: string;
  systemAppend?: string;
  allowedTools?: string[];
  readOnly?: boolean;
  onEvent?: (event: AgentEvent) => void;
  signal?: AbortSignal;
}

export interface AgentResult {
  finalText?: string;
  ok: boolean;
}

export interface DriverInfo {
  id: AgentDriverId;
  displayName: string;
  bin: string;
  version?: string;
}

export type AgentDriverId = "claude" | "codex" | "superwall";

export interface AgentDriver {
  id: AgentDriverId;
  displayName: string;
  detect(): Promise<DriverInfo | null>;
  run(options: AgentRunOptions): Promise<AgentResult>;
}
