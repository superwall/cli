import pc from "picocolors";
import { ui } from "@/ui";
import { defineCommand } from "@/command";
import { detectDrivers } from "@/core/agent/drivers";
import { scanProject } from "@/core/project/scan";
import { detectExisting } from "@/core/project/existing";
import { apiKeyFromEnv } from "@/util/env";
import { loadSession } from "@/core/auth/storage";

export const runDoctor = defineCommand({
  name: "doctor",
  auth: "optional",
  output: "both",
  async run(ctx) {
    ui.intro("Superwall doctor");

    const spin = ui.spinner();
    spin.start("Checking your setup");
    const drivers = await detectDrivers();
    const scan = await scanProject(ctx.installDir);
    spin.stop("Checks complete");

    const top = scan.apps[0];
    const existing = top ? detectExisting(top) : null;
    const session = loadSession();

    const rows: Array<[ok: boolean, label: string, value: string]> = [
      [
        drivers.length > 0,
        "Coding agent",
        drivers.map((d) => d.info.displayName).join(", ") || "none found",
      ],
      top
        ? [
            true,
            "Project",
            `${top.framework.name}${top.details ? ` · ${top.details}` : ""}`,
          ]
        : scan.comingSoon[0]
          ? [
              false,
              "Project",
              `${scan.comingSoon[0].framework.name} (web — coming soon)`,
            ]
          : [false, "Project", "not detected"],
      ...(existing
        ? ([
            [
              existing.sdkInstalled,
              "SDK",
              existing.sdkInstalled ? "installed" : "not installed",
            ],
            [
              existing.configureFound,
              "configure()",
              existing.configureFound ? "present" : "missing",
            ],
            [
              !!existing.apiKey,
              "API key",
              existing.apiKey ?? "none in project",
            ],
          ] as Array<[boolean, string, string]>)
        : []),
      [
        !!session || !!apiKeyFromEnv(),
        "Logged in",
        session
          ? (session.userEmail ?? session.orgName ?? "yes")
          : apiKeyFromEnv()
            ? "via SUPERWALL_API_KEY"
            : "no — run `superwall login`",
      ],
    ];

    if (ctx.json) {
      const checks = rows.map(([ok, label, value]) => ({ ok, label, value }));
      return ctx.output.data({ ok: checks.every((check) => check.ok), checks });
    }

    ui.report(
      rows
        .map(
          ([ok, label, value]) =>
            `${ok ? pc.green("✓") : pc.red("✗")} ${label.padEnd(13)} ${value}`,
        )
        .join("\n"),
    );

    const failed = rows.filter(([ok]) => !ok).length;
    ui.outro(
      failed === 0
        ? "All checks passed."
        : `${failed} of ${rows.length} checks need attention.`,
    );
  },
});
