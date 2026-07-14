import type { Arguments } from "yargs";
import { DASHBOARD_URL } from "@/constants";
import type { Renderer } from "@/ui";
import { apiKeyFromEnv } from "@/util/env";
import type { ExistingIntegration } from "@/core/project/existing";

export interface AccountResult {
  apiKey: string;
}

export async function resolveAccount(opts: {
  existing: ExistingIntegration;
  argv: Arguments;
  interactive: boolean;
  ui: Renderer;
}): Promise<AccountResult | null> {
  const projectKey = opts.existing.apiKey;
  const flagKey = (opts.argv.apiKey as string | undefined) ?? apiKeyFromEnv();

  if (projectKey) {
    if (!opts.interactive || flagKey === projectKey) {
      return { apiKey: projectKey };
    }
    const use = await opts.ui.confirm({
      message: `This project already has a Superwall key (${projectKey}). Use this app?`,
    });
    if (use === null) return null;
    if (use) return { apiKey: projectKey };
  }

  if (flagKey) return { apiKey: flagKey };

  if (!opts.interactive)
    throw new Error(
      "No public API key found. Pass --api-key or set SUPERWALL_API_KEY.",
    );

  opts.ui.info(`Copy the public API key from ${DASHBOARD_URL}.`);
  const key = await opts.ui.text({
    message: "Paste your app's public API key",
    placeholder: "pk_...",
    validate: (v) => (v?.trim() ? undefined : "Required"),
  });
  if (key === null) return null;
  return { apiKey: key.trim() };
}
