import { ascProxyGet } from "./asc";
import type { SuperwallApi } from "./client";

/**
 * App Store Connect product import — mirrors the dashboard's
 * `getUnimportedAscProducts` (packages/legacy-api-utils products router), but
 * over the signed ASC reverse proxy instead of a direct AscApi client.
 *
 * Walks subscriptions (via subscription groups) + in-app purchases, dedupes by
 * store product id (subscriptions win — richer data), then filters out anything
 * already a Superwall product.
 */
export interface AscProduct {
  productId: string;
  referenceName: string;
  type: string;
  state: string;
  subscriptionPeriod?: string;
  subscriptionGroupName?: string;
}

interface AscResource {
  id: string;
  attributes?: Record<string, unknown>;
}
interface AscListResponse {
  data?: AscResource[];
}

function attr(r: AscResource, key: string): string | undefined {
  const v = r.attributes?.[key];
  return typeof v === "string" ? v : undefined;
}

/** Resolve the ASC app id for a bundle id (Apple's numeric app id). */
export async function findAscAppId(api: SuperwallApi, teamId: string, bundleId: string): Promise<string | undefined> {
  const res = await ascProxyGet<AscListResponse>(
    api,
    teamId,
    `/v1/apps?filter[bundleId]=${encodeURIComponent(bundleId)}&fields[apps]=bundleId&limit=10`,
  );
  return res.data?.[0]?.id;
}

export interface AscApp {
  id: string;
  name?: string;
  bundleId?: string;
}

/** Every app in the connected App Store Connect account. */
export async function listAscApps(api: SuperwallApi, teamId: string): Promise<AscApp[]> {
  const res = await ascProxyGet<AscListResponse>(api, teamId, "/v1/apps?limit=200&fields[apps]=bundleId,name");
  return (res.data ?? []).map((a) => ({ id: a.id, name: attr(a, "name"), bundleId: attr(a, "bundleId") }));
}

/**
 * The ASC products not yet imported as Superwall products. `existingIds` is the
 * set of Superwall product identifiers to exclude.
 */
export async function fetchUnimportedAscProducts(
  api: SuperwallApi,
  teamId: string,
  ascAppId: string,
  existingIds: Set<string>,
): Promise<AscProduct[]> {
  const byId = new Map<string, AscProduct>();

  // Subscriptions first (richer: period + group), via each subscription group.
  const groups = await ascProxyGet<AscListResponse>(api, teamId, `/v1/apps/${ascAppId}/subscriptionGroups?limit=200`);
  for (const group of groups.data ?? []) {
    const groupName = attr(group, "referenceName") ?? "";
    const subs = await ascProxyGet<AscListResponse>(api, teamId, `/v1/subscriptionGroups/${group.id}/subscriptions?limit=200`);
    for (const sub of subs.data ?? []) {
      const productId = attr(sub, "productId");
      if (productId && !byId.has(productId)) {
        byId.set(productId, {
          productId,
          referenceName: attr(sub, "name") ?? groupName,
          type: "AUTO_RENEWABLE_SUBSCRIPTION",
          state: attr(sub, "state") ?? "UNKNOWN",
          subscriptionPeriod: attr(sub, "subscriptionPeriod"),
          subscriptionGroupName: groupName,
        });
      }
    }
  }

  // Then non-subscription IAPs (consumables, non-consumables, non-renewing).
  const iaps = await ascProxyGet<AscListResponse>(api, teamId, `/v1/apps/${ascAppId}/inAppPurchases?limit=200`);
  for (const iap of iaps.data ?? []) {
    const productId = attr(iap, "productId");
    if (productId && !byId.has(productId)) {
      byId.set(productId, {
        productId,
        referenceName: attr(iap, "referenceName") ?? "",
        type: attr(iap, "inAppPurchaseType") ?? "UNKNOWN",
        state: attr(iap, "state") ?? "UNKNOWN",
      });
    }
  }

  return [...byId.values()].filter((p) => !existingIds.has(p.productId));
}

/** Human label for an ASC product type (mirrors the dashboard). */
export function ascTypeDisplay(type: string): string {
  switch (type) {
    case "AUTO_RENEWABLE_SUBSCRIPTION":
    case "AUTOMATICALLY_RENEWABLE_SUBSCRIPTION":
      return "Subscription";
    case "NON_CONSUMABLE":
      return "Non-Consumable";
    case "CONSUMABLE":
      return "Consumable";
    case "NON_RENEWING_SUBSCRIPTION":
      return "Non-Renewing";
    default:
      return type;
  }
}
