import { API_HOST } from "@/constants";
import { loadSession } from "@/core/auth/storage";
import { getOAuthAccessToken } from "@/core/auth/token";

const STATUS_PATH = "/v2/cli-agent/status";
const COMPLETIONS_PATH = "/v2/cli-agent/completions";
const ANTHROPIC_PROXY_PATH = "/v2/cli-agent/anthropic";

export interface HostedAgentStatus {
  limit: number;
  usage: number;
  remaining: number;
  exhausted: boolean;
  model: string;
}

export class HostedQuotaExhaustedError extends Error {
  constructor() {
    super("Hosted CLI AI credit is exhausted.");
    this.name = "HostedQuotaExhaustedError";
  }
}

function baseUrl(): string {
  return loadSession()?.host || API_HOST;
}

export function getHostedAnthropicBaseUrl(): string {
  return `${baseUrl()}${ANTHROPIC_PROXY_PATH}`;
}

export async function getHostedAuthToken(): Promise<string | null> {
  return getOAuthAccessToken();
}

export async function getHostedStatus(): Promise<HostedAgentStatus | null> {
  const token = await getOAuthAccessToken();
  if (!token) return null;
  try {
    const res = await fetch(`${baseUrl()}${STATUS_PATH}`, {
      headers: { authorization: `Bearer ${token}`, accept: "application/json" },
    });
    if (!res.ok) return null;
    return (await res.json()) as HostedAgentStatus;
  } catch {
    return null;
  }
}

export async function hostedAgentAvailable(): Promise<boolean> {
  const status = await getHostedStatus();
  return status !== null && !status.exhausted;
}

export interface HostedChatMessage {
  role: string;
  content?: unknown;
  [key: string]: unknown;
}

export interface HostedCompletionRequest {
  messages: HostedChatMessage[];
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
  stop?: string | string[];
  tools?: unknown[];
  tool_choice?: unknown;
  response_format?: unknown;
}

export async function hostedChatCompletion(
  body: HostedCompletionRequest,
): Promise<unknown> {
  const token = await getOAuthAccessToken();
  if (!token) {
    throw new Error(
      "Not signed in - run `superwall login` to use the hosted agent.",
    );
  }

  const res = await fetch(`${baseUrl()}${COMPLETIONS_PATH}`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify(body),
  });

  if (res.status === 402) throw new HostedQuotaExhaustedError();
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(
      `Hosted agent request failed (HTTP ${res.status}). ${detail}`.trim(),
    );
  }
  return res.json();
}
