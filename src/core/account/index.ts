import type { Arguments } from "yargs";
import { ui } from "@/ui";
import { apiKeyFromEnv, isNonInteractive } from "@/util/env";
import type { ExistingIntegration } from "@/core/detection/existing";

export type AccountMode = "existing-key" | "sign-in" | "sign-up";

export interface AccountResult {
  mode: AccountMode;
  apiKey: string;
  appName?: string;
}

export async function resolveAccount(opts: {
  existing: ExistingIntegration;
  argv: Arguments;
}): Promise<AccountResult | null> {
  const projectKey = opts.existing.apiKey;
  const flagKey = (opts.argv.apiKey as string | undefined) ?? apiKeyFromEnv();

  if (projectKey) {
    if (isNonInteractive() || flagKey === projectKey) {
      return { mode: "existing-key", apiKey: projectKey };
    }
    const use = await ui.confirm({ message: `This project already has a Superwall key (${projectKey}). Use this app?` });
    if (use === null) return null;
    if (use) return { mode: "existing-key", apiKey: projectKey };
  }

  if (flagKey) return { mode: "sign-in", apiKey: flagKey };

  if (isNonInteractive()) {
    return { mode: "sign-up", apiKey: "pk_PLACEHOLDER", appName: "New App" };
  }

  const hasAccount = await ui.confirm({ message: "Do you already have a Superwall account?" });
  if (hasAccount === null) return null;

  if (hasAccount) {
    ui.step("Sign in  (account API coming soon)");
    const key = await ui.text({
      message: "Paste your app's public API key (pk_…)",
      placeholder: "pk_...",
      validate: (v) => (v?.trim() ? undefined : "Required"),
    });
    if (key === null) return null;
    return { mode: "sign-in", apiKey: key.trim() };
  }

  ui.step("Create account  (sign-up + app creation API coming soon)");
  const key = await ui.text({
    message: "For now, paste a public API key to continue",
    placeholder: "pk_...",
    validate: (v) => (v?.trim() ? undefined : "Required"),
  });
  if (key === null) return null;
  return { mode: "sign-up", apiKey: key.trim() };
}
