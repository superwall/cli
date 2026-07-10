import type { Arguments } from "yargs";
import pc from "picocolors";
import { ui } from "@/ui";
import { defineCommand } from "@/command";
import { SuperwallApi } from "@/core/api/client";
import {
  listOrganizations,
  listProjects,
  listResource,
  platformLabel,
  rowName,
  titleCase,
  type Application,
  type Project,
  type Row,
} from "@/core/api/resources";
import { parseParams } from "@/util/params";
import { apiCall, emitJson } from "@/util/api-output";

export type ApiVerb = "get" | "post" | "patch" | "delete";

export function runApi(verb: ApiVerb): (argv: Arguments) => Promise<void> {
  return defineCommand(async (ctx) => {
    const api = SuperwallApi.fromSession();
    const path = String(ctx.argv.path ?? "");
    if (!path.startsWith("/")) throw new Error(`Path must start with "/", e.g. /v2/products`);
    const params = parseParams(ctx.argv.d as string[] | undefined);

    const res = await apiCall(ctx, `${verb.toUpperCase()} ${path}`, () => {
      switch (verb) {
        case "get":
          return api.get(withQuery(path, params));
        case "delete":
          return api.del(withQuery(path, params));
        case "post":
          return api.post(path, params);
        case "patch":
          return api.patch(path, params);
      }
    });
    return emitJson(ctx, res ?? { ok: true });
  });
}

function withQuery(path: string, params: Record<string, unknown>): string {
  const entries = Object.entries(params);
  if (entries.length === 0) return path;
  const qs = new URLSearchParams();
  for (const [key, value] of entries) {
    if (typeof value === "object" && value !== null) {
      throw new Error(`Nested -d params aren't supported on GET/DELETE (got "${key}").`);
    }
    qs.set(key, String(value));
  }
  return `${path}${path.includes("?") ? "&" : "?"}${qs}`;
}

export const runBootstrap = defineCommand(async (ctx) => {
  const api = SuperwallApi.fromSession();
  const tree = await apiCall(ctx, "Loading your account", () => buildAccountTree(api));
  if (ctx.json) return emitJson(ctx, tree);

  const who = [api.userEmail, api.org.name].filter(Boolean).join(" · ");
  if (who) ui.step(who);
  const text = tree.organizations.flatMap((org) => renderTree([orgNode(org)])).join("\n");
  if (ctx.plain) process.stdout.write(text + "\n");
  else ui.report(text);
});

interface OrgTree extends Row {
  projects: ProjectTree[];
}
interface ProjectTree extends Project {
  products: Row[];
  entitlements: Row[];
  applications_full: AppTree[];
}
interface AppTree extends Application {
  campaigns: Row[];
  paywalls: Row[];
}

async function buildAccountTree(api: SuperwallApi): Promise<{ organizations: OrgTree[] }> {
  const orgs = await listOrganizations(api).catch(() => [] as Row[]);
  const orgList = orgs.length > 0 ? orgs : [{ id: api.org.id, name: api.org.name } as Row];
  // The orgs endpoint can return an empty name — backfill the session's.
  for (const org of orgList) {
    if (!org.name && String(org.id ?? "") === api.org.id) org.name = api.org.name;
  }

  const organizations = await Promise.all(
    orgList.map(async (org): Promise<OrgTree> => {
      // The session may only be able to read its own org — degrade per-org, like the old bootstrap.
      const projects =
        String(org.id ?? "") === api.org.id
          ? await listProjects(api).catch(() => [] as Project[])
          : await api.list<Project>(`/v2/projects?organization_id=${org.id}`).catch(() => [] as Project[]);

      const full = await Promise.all(
        projects.map(async (p): Promise<ProjectTree> => {
          const scope = { projectId: String(p.id) };
          const [products, entitlements, apps] = await Promise.all([
            listResource(api, "products", scope).catch(() => [] as Row[]),
            listResource(api, "entitlements", scope).catch(() => [] as Row[]),
            Promise.all(
              (p.applications ?? []).map(async (a): Promise<AppTree> => {
                const appScope = { ...scope, applicationId: String(a.id) };
                const [campaigns, paywalls] = await Promise.all([
                  listResource(api, "campaigns", appScope).catch(() => [] as Row[]),
                  listResource(api, "paywalls", appScope).catch(() => [] as Row[]),
                ]);
                return { ...a, campaigns, paywalls };
              }),
            ),
          ]);
          return { ...p, products, entitlements, applications_full: apps };
        }),
      );
      return { ...org, projects: full };
    }),
  );
  return { organizations };
}

interface TreeNode {
  label: string;
  children?: TreeNode[];
}

function renderTree(nodes: TreeNode[], prefix = ""): string[] {
  return nodes.flatMap((node, i) => {
    const last = i === nodes.length - 1;
    const line = `${prefix}${last ? "└── " : "├── "}${node.label}`;
    const childPrefix = `${prefix}${last ? "    " : "│   "}`;
    return [line, ...renderTree(node.children ?? [], childPrefix)];
  });
}

const id = (row: { id?: unknown }) => pc.dim(`#${row.id}`);
const group = (name: string, rows: Row[], child: (r: Row) => TreeNode): TreeNode => ({
  label: rows.length ? `${name} ${pc.dim(`(${rows.length})`)}` : pc.dim(`${name} (0)`),
  children: rows.map(child),
});

function orgNode(org: OrgTree): TreeNode {
  return {
    label: `${pc.bold(rowName(org))}  ${id(org)}${org.role ? pc.dim(` · ${titleCase(String(org.role))}`) : ""}`,
    children: org.projects.map(projectNode),
  };
}

function projectNode(p: ProjectTree): TreeNode {
  // Everything hangs off the app it belongs to: products match by platform,
  // entitlements are project-wide but shown per app (shared).
  const claimed = new Set<unknown>();
  const apps = p.applications_full.map((a) => {
    const products = p.products.filter((r) => String(r.platform ?? "") === String(a.platform ?? ""));
    for (const r of products) claimed.add(r.id);
    return appNode(a, products, p.entitlements);
  });
  const leftover = p.products.filter((r) => !claimed.has(r.id));
  return {
    label: `${pc.bold(p.name ?? String(p.id))}  ${id(p)}`,
    children: [
      ...apps,
      ...(leftover.length ? [group("products (no app)", leftover, (r) => ({ label: `${rowName(r)}  ${id(r)}` }))] : []),
    ],
  };
}

function appNode(a: AppTree, products: Row[], entitlements: Row[]): TreeNode {
  const key = a.public_api_key ? pc.dim(`pk_…${a.public_api_key.slice(-4)}`) : id(a);
  return {
    label: `${platformLabel(a.platform)} · ${a.bundle_id ?? a.name ?? a.id}  ${key}`,
    children: [
      group("campaigns", a.campaigns, campaignNode),
      group("paywalls", a.paywalls, (r) => ({ label: `${rowName(r)}  ${id(r)}` })),
      group("products", products, (r) => ({ label: `${rowName(r)}  ${id(r)}` })),
      group("entitlements", entitlements, (r) => ({ label: `${rowName(r)}  ${id(r)}` })),
    ],
  };
}

function campaignNode(c: Row): TreeNode {
  const placements = (c.placements as Array<Record<string, unknown>> | undefined) ?? [];
  return {
    label: `${String(c.description ?? rowName(c))}  ${id(c)}`,
    children: placements.map((p) => ({
      label: `${String(p.event_name ?? p.id)}${p.enabled === false ? pc.dim(" · disabled") : ""}`,
    })),
  };
}
