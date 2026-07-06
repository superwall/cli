import { readFileSync } from "node:fs";
import type { Arguments } from "yargs";
import { SuperwallApi } from "@/core/api/client";
import { createAscConfig, deleteAscConfig, listAscConfigs } from "@/core/api/asc";
import { rowName } from "@/core/api/resources";
import { ui } from "@/ui";
import { withSpinner } from "@/ui/spinner";
import { defineCommand } from "@/command";

// The .p8 is uploaded to Superwall's vault — nothing sensitive is stored locally.
export const runSecrets = defineCommand(async (ctx) => {
  const { argv, dryRun } = ctx;
  const action = (argv.action as string | undefined) ?? "list";
  const target = argv.value as string | undefined;
  const api = SuperwallApi.fromSession(); // throws NotLoggedInError → handled centrally

  if (action === "list") {
    const configs = await withSpinner("Loading credentials", () => listAscConfigs(api));
    ui.step(`${configs.length} App Store Connect credential${configs.length === 1 ? "" : "s"}`);
    for (const c of configs) ui.info(`\`${rowName(c)}\`  ${c.team_id ?? c.id ?? ""}`);
    return;
  }

  if (action === "set") {
    if (target !== "app-store-connect") throw new Error("Only `app-store-connect` is supported today.");
    const keyId = requireFlag(argv, "key-id");
    const issuerId = requireFlag(argv, "issuer");
    const keyFile = requireFlag(argv, "key-file");
    const privateKey = readFileSync(keyFile, "utf8");
    if (dryRun) return void ui.info(`[dry-run] would upload ASC key ${keyId} (issuer ${issuerId}) from ${keyFile}`);
    const created = await withSpinner("Connecting App Store Connect", () =>
      createAscConfig(api, {
        keyId,
        issuerId,
        privateKey,
        accountName: (argv.name as string | undefined) || "App Store Connect",
      }),
    );
    ui.success(`App Store Connect connected ${created.team_id ?? created.id ?? ""}`);
    return;
  }

  if (action === "rm") {
    const teamId = argv.value2 as string | undefined;
    if (!teamId) throw new Error("Usage: superwall secrets rm app-store-connect <team_id>");
    if (dryRun) return void ui.info(`[dry-run] would delete ASC credential ${teamId}`);
    await withSpinner("Removing credential", () => deleteAscConfig(api, teamId));
    ui.success(`Removed App Store Connect credential ${teamId}`);
    return;
  }

  throw new Error(`Unknown action "${action}". Use set | list | rm.`);
});

function requireFlag(argv: Arguments, name: string): string {
  const v = argv[name] as string | undefined;
  if (!v) throw new Error(`Missing --${name}`);
  return v;
}