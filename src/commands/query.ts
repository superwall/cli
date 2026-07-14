import { readFileSync } from "node:fs";
import { defineCommand, type CommandContext } from "@/command";
import { SuperwallApi } from "@/core/api/client";
import { ui } from "@/ui";
import { apiCall } from "@/util/api-output";

export const runQuery = defineCommand(async (ctx) => {
  const api = SuperwallApi.fromSession();
  const organizationId = api.org.id;
  if (!organizationId) throw new Error("Your login has no organization. Run `superwall login` again.");

  const sql = readSql(ctx);
  const params = ctx.json ? "?default_format=JSON" : "";
  if (ctx.json && /\bFORMAT\s+[A-Za-z0-9_]+\s*;?\s*$/i.test(sql)) {
    throw new Error("Remove the FORMAT clause when using --json; the CLI requests ClickHouse JSON for you.");
  }

  if (!ctx.json) ui.intro("Superwall query");
  const output = await apiCall(ctx, "Querying ClickHouse", () =>
    api.postText(`/v2/organizations/${encodeURIComponent(organizationId)}/query${params}`, sql),
  );

  if (ctx.json) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(output);
    } catch {
      throw new Error("ClickHouse did not return valid JSON. Remove any FORMAT clause and try again.");
    }
    process.stdout.write(JSON.stringify(parsed, null, 2) + "\n");
    return;
  }

  ui.report(output.trimEnd());
});

function readSql(ctx: CommandContext): string {
  const inline = ctx.argv.sql as string | undefined;
  const file = ctx.argv.file as string | undefined;
  if (inline && file) throw new Error("Pass SQL as an argument, with --file, or on stdin — choose one.");

  const value = inline ?? (file ? readFileSync(file, "utf8") : readStdin());
  if (!value?.trim()) {
    throw new Error('Provide SQL: superwall query "SELECT ...", --file <query.sql>, or stdin.');
  }
  return value.trim();
}

function readStdin(): string {
  if (process.stdin.isTTY) return "";
  return readFileSync(0, "utf8");
}
