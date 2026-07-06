import { writeFileSync } from "node:fs";
import type { Arguments } from "yargs";
import { ApiError, SuperwallApi } from "@/core/api/client";
import { generateStoreKit } from "@/core/dashboard/storekit";
import {
  addPlacement,
  createApplication,
  createCampaign,
  createEntitlement,
  createProduct,
  createProject,
  isAppScoped,
  listOrganizations,
  listProjects,
  listResource,
  platformLabel,
  rowName,
  titleCase,
  RESOURCES,
  type Application,
  type ProductCreateOpts,
  type ResourceName,
  type Row,
  type Scope,
  type SubscriptionPeriod,
} from "@/core/api/resources";
import { getDefaultApp, setDefaultApp } from "@/core/state/config";
import { defineCommand, type CommandContext } from "@/command";

interface PickedScope extends Scope {
  appPlatform?: string;
  projectCount: number;
  appCount: number;
}

async function pickScope(ctx: CommandContext, api: SuperwallApi, appScoped: boolean): Promise<PickedScope> {
  const projects = await load(ctx, "Loading projects", listProjects(api));
  const projectFlag = ctx.argv.project as string | undefined;
  const project = projectFlag ? projects.find((p) => String(p.id) === projectFlag) : projects[0];
  if (!project) {
    throw new Error(projectFlag ? `No project ${projectFlag} in this organization.` : "No project found in this organization.");
  }
  const projectId = String(project.id);
  const apps = project.applications ?? [];

  let app: Application | undefined;
  if (appScoped) {
    const appFlag = ctx.argv.app as string | undefined;
    const remembered = apps.find((a) => String(a.id) === getDefaultApp(projectId));

    if (appFlag) {
      app = apps.find((a) => String(a.id) === appFlag || a.name === appFlag);
      if (!app) throw new Error(`No app ${appFlag} in ${project.name ?? projectId}.`);
      setDefaultApp(projectId, String(app.id));
    } else if (apps.length <= 1) {
      app = apps[0];
    } else if (remembered) {
      app = remembered;
    } else if (ctx.plain) {
      app = apps[0];
    } else {
      app = await chooseApp(ctx, apps, apps[0]!);
      setDefaultApp(projectId, String(app.id));
    }
  }

  return {
    projectId,
    applicationId: app ? String(app.id) : undefined,
    projectName: project.name,
    appName: app?.name,
    appPlatform: app?.platform,
    projectCount: projects.length,
    appCount: apps.length,
  };
}

export function runResource(resource: ResourceName): (argv: Arguments) => Promise<void> {
  return defineCommand(async (ctx) => {
    const action = (ctx.argv.action as string | undefined) ?? "list";
    const api = SuperwallApi.fromSession(); // throws NotLoggedInError → handled centrally

    if (action === "list") return doList(ctx, api, resource);
    if (action === "create") return doCreate(ctx, api, resource);
    if (action === "use" && resource === "apps") return doUse(ctx, api);
    if (action === "placement" && resource === "campaigns") return doAddPlacement(ctx, api);
    if (action === "storekit" && resource === "products") return doStoreKit(ctx, api);
    throw new Error(`Unknown action "${action}" for ${resource}.`);
  });
}

async function chooseApp(ctx: CommandContext, apps: Application[], def: Application): Promise<Application> {
  const sel = await ctx.ui.select({
    message: "Which app?",
    options: apps.map((a) => ({ value: String(a.id), label: a.name ?? String(a.id), hint: platformLabel(a.platform) })),
    initialValue: String(def.id),
  });
  if (sel === null) throw new Error("Cancelled.");
  return apps.find((a) => String(a.id) === sel) ?? def;
}

async function doUse(ctx: CommandContext, api: SuperwallApi): Promise<void> {
  const { ui, argv } = ctx;
  const projects = await load(ctx, "Loading projects", listProjects(api));
  const projectFlag = argv.project as string | undefined;
  const project = projectFlag ? projects.find((p) => String(p.id) === projectFlag) : projects[0];
  if (!project) throw new Error("No project found in this organization.");
  const apps = project.applications ?? [];
  if (apps.length === 0) throw new Error(`${project.name ?? project.id} has no apps yet.`);

  const target = argv.value as string | undefined;
  let app: Application | undefined;
  if (target) {
    app = apps.find((a) => String(a.id) === target || a.name === target);
    if (!app) throw new Error(`No app ${target} in ${project.name ?? project.id}.`);
  } else if (ctx.plain) {
    throw new Error("Specify an app: superwall apps use <id|name>");
  } else {
    const current = apps.find((a) => String(a.id) === getDefaultApp(String(project.id))) ?? apps[0]!;
    app = await chooseApp(ctx, apps, current);
  }
  setDefaultApp(String(project.id), String(app.id));
  ui.success(`Default app set to \`${app.name ?? app.id}\` (${platformLabel(app.platform)})`);
}

// Skipped in JSON mode, which must emit only JSON.
async function load<T>(ctx: CommandContext, label: string, work: Promise<T>): Promise<T> {
  if (ctx.json) return work;
  const spin = ctx.ui.spinner();
  spin.start(label);
  try {
    const result = await work;
    spin.stop(label);
    return result;
  } catch (e) {
    spin.stop("Failed");
    throw e;
  }
}

function emit(data: unknown): void {
  process.stdout.write(JSON.stringify(data, null, 2) + "\n");
}

async function doList(ctx: CommandContext, api: SuperwallApi, resource: ResourceName): Promise<void> {
  const { ui, json } = ctx;

  if (resource === "orgs") {
    const orgs = await load(ctx, "Loading organizations", listOrganizations(api));
    if (json) return emit(orgs);
    ui.step(count(orgs.length, "organization"));
    ui.list({
      items: orgs.map((o) => {
        const label = rowName(o);
        return { label, badge: titleCase(String(o.role ?? "")), meta: secondaryId(label, o.id) };
      }),
      empty: "No organizations.",
    });
    return;
  }

  // `apps list` redirects here — there's no separate flat app list, apps are nested under projects.
  if (resource === "projects" || resource === "apps") {
    const projects = await load(ctx, "Loading projects", listProjects(api));
    if (json) return emit(projects);
    ui.step(`${count(projects.length, "project")}${orgLabel(api)}`);
    ui.list({
      items: projects.map((p) => ({
        label: p.name ?? String(p.id),
        meta: String(p.id),
        children: (p.applications ?? []).map((a) => ({
          badge: platformLabel(a.platform),
          label: a.bundle_id ?? a.name ?? "",
          meta: a.public_api_key ? `pk_…${a.public_api_key.slice(-4)}` : "(no key)",
        })),
      })),
      empty: "No projects yet — run `superwall apps create <name> --platform ios`.",
    });
    return;
  }

  const scope = await pickScope(ctx, api, isAppScoped(resource));
  const rows = await load(ctx, `Loading ${resource}`, listResource(api, resource, scope));
  if (json) return emit(rows);
  ui.step(`${count(rows.length, resource.replace(/s$/, ""))}${scopeLabel(resource as keyof typeof RESOURCES, scope)}`);
  ui.list({
    items: rows.map((r) => {
      const label = rowName(r);
      return { label, meta: secondaryId(label, r.id) };
    }),
    empty: `No ${resource} yet.`,
  });
}

function secondaryId(label: string, id: unknown): string | undefined {
  const s = String(id ?? "");
  return s && s !== label ? s : undefined;
}

async function doCreate(ctx: CommandContext, api: SuperwallApi, resource: ResourceName): Promise<void> {
  const { ui, json, dryRun, argv } = ctx;
  const value = argv.value as string | undefined;
  if (!value) throw new Error(`Usage: superwall ${resource} create <${createArgLabel(resource)}>`);

  // Projects aren't created directly — they're spun up when you add the first platform.
  if (resource === "projects") {
    throw new Error(
      "Projects are created for you. Add a platform instead:\n" +
        "  superwall apps create <name> --platform ios [--bundle <id>]\n" +
        "  superwall apps create <name> --platform ios --project <projectId>   # add to an existing project",
    );
  }

  // An app is a platform of a project; without --project a new project is spun up for it.
  if (resource === "apps") {
    const platform = argv.platform as string | undefined;
    if (!platform) {
      throw new Error(
        "Usage: superwall apps create <name> --platform <ios|android|flutter|react_native|web> [--bundle <id>] [--project <projectId>]",
      );
    }
    const target = argv.project as string | undefined;
    if (dryRun) {
      const where = target ? `project ${target}` : "a new project";
      return void ui.info(`[dry-run] would add ${platform} app "${value}" to ${where}`);
    }
    const projectId = target ?? String((await load(ctx, `Creating project "${value}"`, createProject(api, value))).id);
    // createApplication returns the parent project (the app is nested inside).
    let project: Row & {
      name?: string;
      applications?: Array<{ name?: string; platform?: string; public_api_key?: string }>;
    };
    try {
      project = (await load(
        ctx,
        `Adding ${platform} app`,
        createApplication(api, { projectId }, { name: value, platform, bundleId: argv.bundle as string | undefined }),
      )) as typeof project;
    } catch (e) {
      // A project allows one app per platform — surface that cleanly instead of a raw 500.
      if (e instanceof ApiError && /already[_ ]?exists|Duplicate entry|projectId_platform/i.test(e.body ?? "")) {
        throw new Error(`Project ${projectId} already has a ${platform} app — each project allows one app per platform.`);
      }
      throw e;
    }
    if (json) return emit(project);
    const created =
      project.applications?.find((a) => a.name === value && a.platform === platform) ??
      project.applications?.find((a) => a.platform === platform) ??
      project.applications?.at(-1);
    const key = created?.public_api_key ? ` · \`pk_…${created.public_api_key.slice(-4)}\`` : "";
    const proj = project.name ? ` in \`${project.name}\`` : "";
    ui.success(`Added \`${platform}\` app \`${value}\`${proj}${key}`);
    return;
  }

  const scope = await pickScope(ctx, api, isAppScoped(resource as keyof typeof RESOURCES));

  if (dryRun) {
    return void ui.info(
      `[dry-run] would create ${resource.replace(/s$/, "")} "${value}" in ${scope.projectName ?? scope.projectId}`,
    );
  }

  const created = await load(
    ctx,
    `Creating ${resource.replace(/s$/, "")}`,
    createOne(api, resource, scope, value, argv),
  );
  if (json) return emit(created);
  ui.success(`Created ${resource.replace(/s$/, "")} \`${rowName(created)}\` ${created.id ?? ""}`);
}

function createOne(api: SuperwallApi, resource: ResourceName, scope: Scope, value: string, argv: Arguments): Promise<Row> {
  switch (resource) {
    case "entitlements":
      return createEntitlement(api, scope, value);
    case "products":
      return createProduct(api, scope, value, productOptsFromArgv(argv));
    case "campaigns":
      return createCampaign(api, scope, value);
    default:
      throw new Error(`create is not supported for ${resource} yet.`);
  }
}

function productOptsFromArgv(argv: Arguments): ProductCreateOpts {
  const opts: ProductCreateOpts = {};
  if (argv.name) opts.name = String(argv.name);
  if (argv.price !== undefined) {
    // `--price 9.99` → smallest currency unit (cents) the API expects.
    opts.price = { amount: Math.round(Number(argv.price) * 100), currency: String(argv.currency ?? "USD").toUpperCase() };
  }
  if (argv.period) {
    opts.subscription = {
      period: String(argv.period) as SubscriptionPeriod,
      period_count: argv.periodCount !== undefined ? Number(argv.periodCount) : 1,
      ...(argv.trialDays !== undefined ? { trial_period_days: Number(argv.trialDays) } : {}),
    };
  }
  const ent = argv.entitlement;
  const entitlements = Array.isArray(ent) ? ent.map(String) : ent ? [String(ent)] : [];
  if (entitlements.length) opts.entitlements = entitlements;
  return opts;
}

async function doAddPlacement(ctx: CommandContext, api: SuperwallApi): Promise<void> {
  const { ui, json, dryRun, argv } = ctx;
  const campaignId = argv.value as string | undefined;
  const placement = argv.value2 as string | undefined;
  if (!campaignId || !placement) throw new Error("Usage: superwall campaigns placement <campaignId> <placement>");
  if (dryRun) return void ui.info(`[dry-run] would add placement "${placement}" to campaign ${campaignId}`);
  const res = await load(ctx, `Adding placement "${placement}"`, addPlacement(api, campaignId, placement));
  if (json) return emit(res);
  ui.success(`Added placement \`${placement}\` to campaign ${campaignId}`);
}

async function doStoreKit(ctx: CommandContext, api: SuperwallApi): Promise<void> {
  const { ui, argv } = ctx;
  const scope = await pickScope(ctx, api, false);
  const products = await load(ctx, "Loading products", listResource(api, "products", scope));
  const outFile = (argv.out as string | undefined) ?? "Superwall.storekit";
  writeFileSync(outFile, JSON.stringify(generateStoreKit(products), null, 2));
  ui.success(`Wrote \`${outFile}\` with ${products.length} product${products.length === 1 ? "" : "s"}`);
}

function createArgLabel(resource: ResourceName): string {
  return resource === "campaigns" ? "description" : "identifier";
}

function count(n: number, noun: string): string {
  return `${n} ${noun}${n === 1 ? "" : "s"}`;
}

function orgLabel(api: SuperwallApi): string {
  return api.org.count > 1 && api.org.name ? ` in \`${api.org.name}\`` : "";
}

function scopeLabel(resource: keyof typeof RESOURCES, scope: PickedScope): string {
  const parts: string[] = [];
  if (scope.projectCount > 1 && scope.projectName) parts.push(scope.projectName);
  if (isAppScoped(resource) && scope.appCount > 1 && scope.appName) {
    // App names often repeat across platforms — tag the platform to disambiguate.
    parts.push(`${scope.appName} (${platformLabel(scope.appPlatform)})`);
  }
  return parts.length ? ` in \`${parts.join(" · ")}\`` : "";
}

