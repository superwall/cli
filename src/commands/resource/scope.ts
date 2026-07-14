import type { CommandContext } from "@/command";
import type { SuperwallApi } from "@/core/api/client";
import {
  listProjects,
  platformLabel,
  type Application,
  type Project,
  type Scope,
} from "@/core/api/resources";
import { getDefaultApp, setDefaultApp } from "@/core/state/config";
import { apiCall } from "@/util/api-output";

export interface PickedScope extends Scope {
  appPlatform?: string;
  projectCount: number;
  appCount: number;
}

export async function pickScope(
  context: CommandContext,
  api: SuperwallApi,
  appScoped: boolean,
): Promise<PickedScope> {
  const projects = await apiCall(context, "Loading projects", () =>
    listProjects(api),
  );
  const project = await pickProject(context, projects);
  const projectId = String(project.id);
  const apps = project.applications ?? [];

  let app: Application | undefined;
  if (appScoped) {
    const appFlag = context.argv.app as string | undefined;
    const remembered = apps.find(
      (candidate) => String(candidate.id) === getDefaultApp(projectId),
    );

    if (appFlag) {
      app = apps.find(
        (candidate) =>
          String(candidate.id) === appFlag || candidate.name === appFlag,
      );
      if (!app) {
        throw new Error(`No app ${appFlag} in ${project.name ?? projectId}.`);
      }
      setDefaultApp(projectId, String(app.id));
    } else if (apps.length <= 1) {
      app = apps[0];
    } else if (!context.interactive) {
      throw new Error(
        `Multiple apps found in ${project.name ?? projectId}. Pass --app <id>.`,
      );
    } else {
      app = await chooseApp(context, apps, remembered ?? apps[0]!);
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

export async function pickProject(
  context: CommandContext,
  projects: Project[],
): Promise<Project> {
  const projectFlag = context.argv.project as string | undefined;
  const project = projectFlag
    ? projects.find((candidate) => String(candidate.id) === projectFlag)
    : projects.length === 1
      ? projects[0]
      : context.interactive
        ? await chooseProject(context, projects)
        : undefined;
  if (project) return project;
  if (projectFlag) {
    throw new Error(`No project ${projectFlag} in this organization.`);
  }
  if (projects.length > 1) {
    throw new Error("Multiple projects found. Pass --project <id>.");
  }
  throw new Error("No project found in this organization.");
}

export async function chooseApp(
  context: CommandContext,
  apps: Application[],
  defaultApp: Application,
): Promise<Application> {
  const selection = await context.ui.select({
    message: "Which app?",
    options: apps.map((app) => ({
      value: String(app.id),
      label: app.name ?? String(app.id),
      hint: platformLabel(app.platform),
    })),
    initialValue: String(defaultApp.id),
  });
  if (selection === null) throw new Error("Cancelled.");
  return apps.find((app) => String(app.id) === selection) ?? defaultApp;
}

async function chooseProject(
  context: CommandContext,
  projects: Project[],
): Promise<Project | undefined> {
  const selection = await context.ui.select({
    message: "Which project?",
    options: projects.map((project) => ({
      value: String(project.id),
      label: project.name ?? String(project.id),
    })),
  });
  if (selection === null) throw new Error("Cancelled.");
  return projects.find((project) => String(project.id) === selection);
}
