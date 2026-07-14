import { defineCommand, type CommandContext } from "@/command";
import type { SuperwallApi } from "@/core/api/client";
import { ascProxy, listAscConfigs } from "@/core/api/asc";
import {
  ascTypeDisplay,
  fetchUnimportedAscProducts,
  findAscAppId,
  listAscApps,
} from "@/core/api/asc-products";
import { parseParams } from "@/util/params";
import { apiCall, emitJson } from "@/util/api-output";
import { runAscKeys } from "./keys";

const VERBS = new Set(["get", "post", "patch", "delete"]);

export const runAsc = defineCommand({
  name: "asc",
  auth: "required",
  output: "both",
  async run(ctx) {
    const target = String(ctx.argv.target ?? "");

    if (target === "keys") return runAscKeys(ctx, ctx.api);

    const teamId = await resolveTeam(ctx, ctx.api);

    if (VERBS.has(target)) {
      const path = String(ctx.argv.value ?? "");
      if (!path.startsWith("/"))
        throw new Error(`Path must start with "/", e.g. /v1/apps`);
      const body = parseParams(ctx.argv.d as string[] | undefined);
      const res = await apiCall(ctx, `${target.toUpperCase()} ${path}`, () =>
        ascProxy(ctx.api, teamId, target, path, body),
      );
      return emitJson(ctx, res);
    }
    if (target.startsWith("/")) {
      const res = await apiCall(ctx, `GET ${target}`, () =>
        ascProxy(ctx.api, teamId, "GET", target),
      );
      return emitJson(ctx, res);
    }

    if (target === "apps") {
      const apps = await apiCall(ctx, "Loading apps", () =>
        listAscApps(ctx.api, teamId),
      );
      if (ctx.json) return emitJson(ctx, apps);
      ctx.ui.step(`${apps.length} app${apps.length === 1 ? "" : "s"}`);
      for (const a of apps)
        ctx.ui.info(`\`${a.name ?? a.id}\`  ${a.bundleId ?? ""}  ${a.id}`);
      return;
    }

    if (
      target === "products" ||
      target === "subscriptions" ||
      target === "iaps"
    ) {
      const appArg = ctx.argv.value as string | undefined;
      if (!appArg)
        throw new Error(
          `Usage: superwall asc ${target} <bundle-id | asc-app-id>`,
        );
      const ascAppId = /^\d+$/.test(appArg)
        ? appArg
        : await apiCall(ctx, "Finding app", () =>
            findAscAppId(ctx.api, teamId, appArg),
          );
      if (!ascAppId)
        throw new Error(`No App Store Connect app found for "${appArg}".`);

      const all = await apiCall(ctx, "Loading products", () =>
        fetchUnimportedAscProducts(ctx.api, teamId, ascAppId, new Set()),
      );
      const isSub = (t: string) =>
        t.includes("SUBSCRIPTION") && t !== "NON_RENEWING_SUBSCRIPTION";
      const rows =
        target === "subscriptions"
          ? all.filter((p) => isSub(p.type))
          : target === "iaps"
            ? all.filter((p) => !isSub(p.type))
            : all;
      if (ctx.json) return emitJson(ctx, rows);
      ctx.ui.step(`${rows.length} product${rows.length === 1 ? "" : "s"}`);
      for (const p of rows)
        ctx.ui.info(
          `\`${p.productId}\`  ${ascTypeDisplay(p.type)}${p.subscriptionPeriod ? `  ${p.subscriptionPeriod}` : ""}`,
        );
      return;
    }

    throw new Error(
      `Unknown "${target}". Use get|post|patch|delete <path>, a raw path, or: apps | products | subscriptions | iaps | keys`,
    );
  },
});

async function resolveTeam(
  ctx: CommandContext,
  api: SuperwallApi,
): Promise<string> {
  const flag = ctx.argv.team as string | undefined;
  if (flag) return flag;
  const configs = await apiCall(ctx, "Finding App Store Connect", () =>
    listAscConfigs(api),
  );
  if (configs.length === 0) {
    throw new Error(
      "App Store Connect isn't connected. Connect it with `superwall asc keys set …`.",
    );
  }
  if (configs.length > 1) {
    const teams = configs
      .map((c) => String(c.team_id ?? c.id ?? ""))
      .join(", ");
    throw new Error(
      `Multiple App Store Connect teams (${teams}). Pass --team <id>.`,
    );
  }
  return String(configs[0]!.team_id ?? configs[0]!.id ?? "");
}
