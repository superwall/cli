import type { DetectedApp } from "@/core/detection/scan";
import type { ExistingIntegration } from "@/core/detection/existing";

export type ActionId = "integrate" | "placements-review" | "placements-implement" | "dashboard-setup" | "migrate";

/** Everything an action's skill needs about the target. */
export interface ActionContext {
  app: DetectedApp;
  /** Per-app public key (pk_) for SDK init. May be "" for read-only actions. */
  apiKey: string;
  existing: ExistingIntegration;
  /** A prior saved report (e.g. a placement review) for the agent to build on. */
  priorReport?: string;
  /** Current Superwall campaigns + their placements, so the review is campaign-aware. */
  campaigns?: string;
  /** Migration source provider (revenuecat/adapty/qonversion). */
  billingProvider?: string;
  /** "full" (replace provider) or "paywalls" (keep provider for billing). */
  migrateIntent?: string;
}

/**
 * An internal, CLI-bundled skill that drives one agent task. These are NOT the
 * public superwall/skills — they ship inside the wizard and are inlined into the
 * agent prompt at run time.
 */
export interface WizardAction {
  id: ActionId;
  /** Menu label. */
  title: string;
  /** Menu hint. */
  hint: string;
  /** Spinner message while running. */
  runningLabel: string;
  /** Spinner message on success. */
  successLabel: string;
  /** Only offer when the app already has the SDK installed. */
  requiresIntegration: boolean;
  /** Needs the org-scoped SUPERWALL_API_KEY (REST API) — gated on auth. */
  requiresOrgKey: boolean;
  /** "silent" = no final output; "report" = render the agent's final findings. */
  outputMode: "silent" | "report";
  /** No file mutations — drives the agent sandbox/tools to read-only. */
  readOnly: boolean;
  /** Tool allowlist handed to the agent. */
  allowedTools: string[];
  /** The bundled skill body, inlined into the prompt. */
  skill: (ctx: ActionContext) => string;
}
