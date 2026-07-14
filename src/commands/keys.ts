import { readFileSync } from "node:fs";
import type { Arguments } from "yargs";
import type { CommandContext } from "@/command";
import { SuperwallApi } from "@/core/api/client";
import {
  createAscConfig,
  deleteAscConfig,
  listAscConfigs,
} from "@/core/api/asc";
import { rowName } from "@/core/api/resources";
import { apiCall, emitJson } from "@/util/api-output";

export async function runAscKeys(
  ctx: CommandContext,
  api: SuperwallApi,
): Promise<void> {
  const { argv, dryRun } = ctx;
  const action = (argv.value as string | undefined) ?? "list";

  if (action === "list") {
    const configs = await apiCall(ctx, "Loading credentials", () =>
      listAscConfigs(api),
    );
    if (ctx.json) return emitJson(ctx, configs);
    ctx.ui.step(
      `${configs.length} App Store Connect credential${configs.length === 1 ? "" : "s"}`,
    );
    for (const c of configs)
      ctx.ui.info(`\`${rowName(c)}\`  ${c.team_id ?? c.id ?? ""}`);
    return;
  }

  if (action === "set") {
    const keyId = requireFlag(argv, "key-id");
    const issuerId = requireFlag(argv, "issuer");
    const keyFile = requireFlag(argv, "key-file");
    const privateKey = readFileSync(keyFile, "utf8");
    if (dryRun) {
      const plan = { dryRun: true, action: "set", keyId, issuerId, keyFile };
      return void (ctx.json
        ? emitJson(ctx, plan)
        : ctx.ui.info(
            `[dry-run] would upload ASC key ${keyId} (issuer ${issuerId}) from ${keyFile}`,
          ));
    }
    const created = await apiCall(ctx, "Connecting App Store Connect", () =>
      createAscConfig(api, {
        keyId,
        issuerId,
        privateKey,
        accountName: (argv.name as string | undefined) || "App Store Connect",
      }),
    );
    if (ctx.json) return emitJson(ctx, created);
    ctx.ui.success(
      `App Store Connect connected ${created.team_id ?? created.id ?? ""}`,
    );
    return;
  }

  if (action === "rm") {
    const teamId = argv.value2 as string | undefined;
    if (!teamId) throw new Error("Usage: superwall asc keys rm <team_id>");
    if (dryRun) {
      const plan = { dryRun: true, action: "rm", teamId };
      return void (ctx.json
        ? emitJson(ctx, plan)
        : ctx.ui.info(`[dry-run] would delete ASC credential ${teamId}`));
    }
    await apiCall(ctx, "Removing credential", () =>
      deleteAscConfig(api, teamId),
    );
    if (ctx.json) return emitJson(ctx, { deleted: true, teamId });
    ctx.ui.success(`Removed App Store Connect credential ${teamId}`);
    return;
  }

  throw new Error(`Unknown "asc keys ${action}". Use list | set | rm.`);
}

function requireFlag(argv: Arguments, name: string): string {
  const v = argv[name] as string | undefined;
  if (!v) throw new Error(`Missing --${name}`);
  return v;
}
