import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { SuperwallApi } from "@/core/api/client";
import { createEntitlement, createProduct, listResource, resolveScope, type Scope } from "@/core/api/resources";

/**
 * Local-first "Monetization-as-Code": a `superwall.json` file is the source of
 * truth for entitlements + products; `pull` writes cloud → file, `plan` diffs,
 * `push` reconciles file → cloud (additive create — never destructive).
 */
export interface LocalState {
  entitlements: Array<{ identifier: string }>;
  products: Array<{ identifier: string; name?: string }>;
}

export const CONFIG_FILE = "superwall.json";

export function configPath(dir: string): string {
  return join(dir, CONFIG_FILE);
}

export function readLocal(dir: string): LocalState {
  const p = configPath(dir);
  if (!existsSync(p)) return { entitlements: [], products: [] };
  const raw = JSON.parse(readFileSync(p, "utf8")) as Partial<LocalState>;
  return { entitlements: raw.entitlements ?? [], products: raw.products ?? [] };
}

export function writeLocal(dir: string, state: LocalState): void {
  writeFileSync(configPath(dir), JSON.stringify(state, null, 2) + "\n");
}

/** Fetch the cloud's entitlements + products for the resolved project. */
export async function pull(api: SuperwallApi, scope?: Scope): Promise<LocalState> {
  const s = scope ?? (await resolveScope(api));
  const ents = await listResource(api, "entitlements", s);
  const prods = await listResource(api, "products", s);
  return {
    entitlements: ents.map((e) => ({ identifier: String(e.identifier) })).filter((e) => e.identifier),
    products: prods
      .map((p) => ({ identifier: String(p.identifier), name: typeof p.name === "string" ? p.name : undefined }))
      .filter((p) => p.identifier),
  };
}

export interface Plan {
  entitlements: string[]; // identifiers to create
  products: string[];
}

/** Diff local file against the cloud — what `push` would create. */
export async function plan(api: SuperwallApi, local: LocalState, scope?: Scope): Promise<Plan> {
  const s = scope ?? (await resolveScope(api));
  const cloud = await pull(api, s);
  const haveEnt = new Set(cloud.entitlements.map((e) => e.identifier));
  const haveProd = new Set(cloud.products.map((p) => p.identifier));
  return {
    entitlements: local.entitlements.map((e) => e.identifier).filter((id) => id && !haveEnt.has(id)),
    products: local.products.map((p) => p.identifier).filter((id) => id && !haveProd.has(id)),
  };
}

/** Apply the plan (create missing). Returns what was created. */
export async function push(api: SuperwallApi, local: LocalState, scope?: Scope): Promise<Plan> {
  const s = scope ?? (await resolveScope(api));
  const toDo = await plan(api, local, s);
  for (const id of toDo.entitlements) await createEntitlement(api, s, id);
  for (const id of toDo.products) {
    const name = local.products.find((p) => p.identifier === id)?.name;
    await createProduct(api, s, id, { name });
  }
  return toDo;
}
