import { readFileSync } from "node:fs";
import type { Arguments } from "yargs";
import type { CommandContext } from "@/command";
import { SuperwallApi } from "@/core/api/client";
import { createAscConfig, deleteAscConfig, listAscConfigs } from "@/core/api/asc";
import { rowName } from "@/core/api/resources";
import { ui } from "@/ui";
import { withSpinner } from "@/ui/spinner";

export async function runAscKeys(ctx: CommandContext, api: SuperwallApi): Promise<void> {
  const { argv, dryRun } = ctx;
  const action = (argv.value as string | undefined) ?? "list";

  if (action === "list") {
    const configs = await withSpinner("Loading credentials", () => listAscConfigs(api));
    ui.step(`${configs.length} App Store Connect credential${configs.length === 1 ? "" : "s"}`);
    for (const c of configs) ui.info(`\`${rowName(c)}\`  ${c.team_id ?? c.id ?? ""}`);
    return;
  }

  if (action === "set") {
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
    if (!teamId) throw new Error("Usage: superwall asc keys rm <team_id>");
    if (dryRun) return void ui.info(`[dry-run] would delete ASC credential ${teamId}`);
    await withSpinner("Removing credential", () => deleteAscConfig(api, teamId));
    ui.success(`Removed App Store Connect credential ${teamId}`);
    return;
  }

  throw new Error(`Unknown "asc keys ${action}". Use list | set | rm.`);
}

function requireFlag(argv: Arguments, name: string): string {
  const v = argv[name] as string | undefined;
  if (!v) throw new Error(`Missing --${name}`);
  return v;
}
