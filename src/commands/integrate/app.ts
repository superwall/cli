import { ui } from "@/ui";
import { withSpinner } from "@/ui/spinner";
import { SUPPORTED_LABEL } from "@/core/project/frameworks";
import { scanProject, type DetectedApp } from "@/core/project/scan";
import type { ExistingIntegration } from "@/core/project/existing";
import { performLogin } from "@/core/auth/login";
import type { Session } from "@/core/auth/storage";
import { titleCase } from "@/core/api/resources";
import { getHostedStatus } from "@/core/agent/hosted";
import type { AgentDriver } from "@/core/agent/drivers";
import { ACTIONS, type ActionId } from "@/core/agent/actions";

export async function performLoginWithUi(): Promise<Session | null> {
  const spin = ui.spinner();
  try {
    const session = await performLogin({
      onVerify: ({ url, userCode }) => {
        ui.note(
          `If your browser didn't open, visit:\n\n${url}\n\nand enter the code  \`${userCode}\``,
          "Approve in your browser",
        );
        spin.start("Signing you in");
      },
      onStatus: (message) => spin.message(message),
      onSelectOrg: async (orgs) => {
        const selection = await ui.select({
          message: "Which organization?",
          options: orgs.map((org) => ({
            value: String(org.id),
            label: org.name,
            hint: titleCase(org.role),
          })),
        });
        spin.start("Setting things up");
        return selection === null
          ? null
          : (orgs.find((org) => String(org.id) === selection) ?? null);
      },
    });
    spin.stop(`Signed in as ${session.userEmail ?? "you"}`);
    return session;
  } catch (error) {
    spin.stop("Sign-in failed");
    ui.warn((error as Error).message);
    return null;
  }
}

export async function ensureAgentDriverReady(
  driver: AgentDriver,
  ensureLogin: () => Promise<boolean>,
  dryRun: boolean,
): Promise<boolean> {
  if (driver.id !== "superwall" || dryRun) return true;

  if (!(await ensureLogin())) {
    ui.warn(
      "Superwall Agent needs sign-in. Run `superwall login`, or install Claude Code/Codex and re-run.",
    );
    return false;
  }

  const status = await withSpinner("Checking Superwall Agent credit", () =>
    getHostedStatus(),
  );
  if (!status) {
    ui.warn(
      "Superwall Agent needs an OAuth login. Run `superwall login` (not `--api-key`), or install Claude Code/Codex.",
    );
    return false;
  }
  if (status.exhausted) {
    ui.warn(
      "Your hosted Superwall Agent credit is exhausted. Install Claude Code/Codex or copy the prompt into your own agent.",
    );
    return false;
  }

  return true;
}

export async function pickApp(
  installDir: string,
  interactive: boolean,
): Promise<DetectedApp | null> {
  const scan = await withSpinner("Scanning your project", () =>
    scanProject(installDir),
  );
  if (scan.apps.length === 0) {
    if (scan.comingSoon.length) {
      const webApp = scan.comingSoon[0]!;
      throw new Error(
        `Detected a web app${webApp.details ? ` (\`${webApp.details}\`)` : ""} — Superwall web support is coming soon.`,
      );
    }
    const skipped = scan.skipped.length
      ? ` Skipped: ${scan.skipped.join(", ")}.`
      : "";
    throw new Error(
      `No ${SUPPORTED_LABEL} app found in this directory.${skipped}`,
    );
  }
  if (scan.comingSoon.length) {
    ui.info(
      `Also found (web — coming soon): ${scan.comingSoon.map((app) => app.name).join(", ")}`,
    );
  }
  if (scan.apps.length === 1) {
    const app = scan.apps[0]!;
    ui.info(
      `Detected \`${app.framework.name}\`` +
        (app.details ? ` · \`${app.details}\`` : "") +
        (app.relPath !== "." ? `  (${app.relPath})` : ""),
    );
    return app;
  }
  if (!interactive) {
    throw new Error(
      "Multiple apps found. Pass --install-dir for the app you want to change.",
    );
  }
  const choice = await ui.select({
    message: scan.isMonorepo
      ? "Found multiple apps — which one?"
      : "Which app?",
    options: scan.apps.map((app) => ({
      value: app.path,
      label: `${app.name} · ${app.framework.name}`,
      hint: app.relPath === "." ? undefined : app.relPath,
    })),
    initialValue: scan.apps[0]!.path,
  });
  if (choice === null) return null;
  return scan.apps.find((app) => app.path === choice) ?? scan.apps[0]!;
}

export async function chooseAction(
  forced: ActionId | undefined,
  existing: ExistingIntegration,
  app: DetectedApp,
  interactive: boolean,
): Promise<ActionId | null> {
  if (forced) return forced;
  if (!interactive) return "integrate";

  if (!existing.sdkInstalled) {
    const confirmed = await ui.confirm({
      message: `Integrate Superwall into \`${app.name}\`?`,
    });
    if (confirmed === null) {
      ui.warn("Cancelled.");
      return null;
    }
    if (!confirmed) {
      ui.outro("No problem — run `superwall integrate` again anytime.");
      return null;
    }
    return "integrate";
  }

  const available = ACTIONS.filter((action) => {
    if (action.id === "integrate") return false;
    if (action.requiresOrgKey && !process.env.SUPERWALL_API_KEY) return false;
    return true;
  });
  const selection = await ui.select({
    message: "What do you want to do?",
    options: available.map((action) => ({
      value: action.id,
      label: action.title,
      hint: action.hint,
    })),
    initialValue: "review",
  });
  return selection as ActionId | null;
}

export async function stage(
  label: string,
  work: () => Promise<void> | void,
): Promise<void> {
  ui.step(label);
  // Let Ink paint the step header before the body's spinner starts.
  await new Promise((resolve) => setTimeout(resolve, 40));
  await work();
}
