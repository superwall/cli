import { SuperwallApi } from "./client";

export interface Application {
  id: string | number;
  name?: string;
  platform?: string;
  bundle_id?: string;
  public_api_key?: string;
}

export interface Project {
  id: string | number;
  name?: string;
  applications?: Application[];
}

/** A resource row we only display generically (id + a best-guess name). */
export type Row = Record<string, unknown> & { id?: string | number };

export const RESOURCES = {
  products: "/v2/products",
  campaigns: "/v2/campaigns",
  paywalls: "/v2/paywalls",
  entitlements: "/v2/entitlements",
} as const;

export type ResourceName = keyof typeof RESOURCES | "apps" | "orgs" | "projects";

/** Each list endpoint is scoped by either the project or the application. */
const RESOURCE_SCOPE: Record<keyof typeof RESOURCES, "project" | "application"> = {
  products: "project",
  entitlements: "project",
  campaigns: "application",
  paywalls: "application",
};

/** Whether a resource list is scoped by application (vs project). */
export function isAppScoped(name: keyof typeof RESOURCES): boolean {
  return RESOURCE_SCOPE[name] === "application";
}

/** Title-case a single word (OWNER → Owner). */
export function titleCase(s: string): string {
  return s ? s[0]!.toUpperCase() + s.slice(1).toLowerCase() : s;
}

/** Human, title-cased platform tag (ios → iOS, react_native → React Native). */
export function platformLabel(platform?: string): string {
  switch ((platform ?? "").toLowerCase()) {
    case "ios":
      return "iOS";
    case "android":
      return "Android";
    case "flutter":
      return "Flutter";
    case "react_native":
    case "react-native":
      return "React Native";
    case "web":
      return "Web";
    default:
      return platform ? platform[0]!.toUpperCase() + platform.slice(1) : "?";
  }
}

export interface Scope {
  projectId: string;
  applicationId?: string;
  projectName?: string;
  appName?: string;
}

/** Resolve the default (or specified) project + application to scope list calls. */
export async function resolveScope(
  api: SuperwallApi,
  opts: { projectId?: string; applicationId?: string } = {},
): Promise<Scope> {
  const projects = await listProjects(api);
  const project = opts.projectId ? projects.find((p) => String(p.id) === opts.projectId) : projects[0];
  if (!project) throw new Error("No project found in this organization.");
  const apps = project.applications ?? [];
  const app = opts.applicationId ? apps.find((a) => String(a.id) === opts.applicationId) : apps[0];
  return {
    projectId: String(project.id),
    applicationId: app ? String(app.id) : undefined,
    projectName: project.name,
    appName: app?.name,
  };
}

export async function listProjects(api: SuperwallApi): Promise<Project[]> {
  return api.list<Project>("/v2/projects");
}

/** All applications across every project (each carries its public_api_key). */
export async function listApplications(api: SuperwallApi): Promise<Application[]> {
  const projects = await listProjects(api);
  return projects.flatMap((p) => p.applications ?? []);
}

export async function listResource(api: SuperwallApi, name: keyof typeof RESOURCES, scope: Scope): Promise<Row[]> {
  if (RESOURCE_SCOPE[name] === "application") {
    if (!scope.applicationId) throw new Error("This project has no application yet.");
    return api.list<Row>(`${RESOURCES[name]}?application_id=${scope.applicationId}`);
  }
  return api.list<Row>(`${RESOURCES[name]}?project_id=${scope.projectId}`);
}

// ── Writes ───────────────────────────────────────────────────────────────

export function createEntitlement(api: SuperwallApi, scope: Scope, identifier: string): Promise<Row> {
  return api.post<Row>("/v2/entitlements", { project_id: scope.projectId, identifier });
}

export type SubscriptionPeriod = "day" | "week" | "month" | "year";

export interface ProductCreateOpts {
  name?: string;
  /** { amount in the smallest unit (cents), ISO currency }. */
  price?: { amount: number; currency: string };
  subscription?: { period: SubscriptionPeriod; period_count?: number; trial_period_days?: number };
  entitlements?: string[];
}

export function createProduct(
  api: SuperwallApi,
  scope: Scope,
  identifier: string,
  opts: ProductCreateOpts = {},
): Promise<Row> {
  return api.post<Row>("/v2/products", {
    project_id: scope.projectId,
    identifier,
    ...(opts.name ? { name: opts.name } : {}),
    ...(opts.price ? { price: opts.price } : {}),
    ...(opts.subscription ? { subscription: opts.subscription } : {}),
    ...(opts.entitlements?.length ? { entitlements: opts.entitlements } : {}),
  });
}

export async function listOrganizations(api: SuperwallApi): Promise<Row[]> {
  const res = await api.get<{ data?: Row[] }>("/v2/me/organizations");
  return res.data ?? [];
}

export function createProject(api: SuperwallApi, name: string): Promise<Row> {
  const orgId = api.org.id;
  if (!orgId) throw new Error("No organization in the session — run `superwall login`.");
  return api.post<Row>("/v2/projects", { name, organization_id: Number(orgId) });
}

export function createApplication(
  api: SuperwallApi,
  scope: Scope,
  opts: { name: string; platform: string; bundleId?: string },
): Promise<Row> {
  return api.post<Row>(`/v2/projects/${scope.projectId}/applications`, {
    name: opts.name,
    platform: opts.platform,
    ...(opts.bundleId ? { bundle_id: opts.bundleId } : {}),
  });
}

export function createCampaign(api: SuperwallApi, scope: Scope, description: string): Promise<Row> {
  if (!scope.applicationId) throw new Error("This project has no application to create a campaign in.");
  return api.post<Row>("/v2/campaigns", { application_id: scope.applicationId, description });
}

/** Add a placement (by event name) to a campaign. */
export function addPlacement(api: SuperwallApi, campaignId: string, placement: string): Promise<Row> {
  return api.post<Row>(`/v2/campaigns/${campaignId}/placements`, { event_name: placement });
}

/** Best-effort human label for a generic row. */
export function rowName(row: Row): string {
  for (const key of ["name", "identifier", "product_identifier", "title", "description", "id"]) {
    const v = row[key];
    if (typeof v === "string" && v) return v;
    if (typeof v === "number") return String(v);
  }
  return String(row.id ?? "—");
}
