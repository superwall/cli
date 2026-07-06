import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { ENV_API_KEY, VERSION } from "@/constants";

const installDirOption = {
  "install-dir": {
    describe: "Directory to set up Superwall in (default: cwd)",
    type: "string" as const,
  },
};

const apiKeyOption = {
  "api-key": {
    describe: `Superwall public API key (or set ${ENV_API_KEY})`,
    type: "string" as const,
  },
};

const dryRunOption = {
  "dry-run": { type: "boolean" as const, describe: "Plan without changing anything", hidden: true },
};

const skillOption = {
  skill: {
    type: "boolean" as const,
    describe: "Print the agent playbook (skill + this project's reference) instead of running",
  },
};

const RESOURCES = ["orgs", "projects", "apps", "products", "campaigns", "paywalls", "entitlements"] as const;

export function run(): void {
  let cli = yargs(hideBin(process.argv))
    .scriptName("superwall")
    .usage("Superwall CLI\n\n$0 [command]")
    .option("ui", {
      type: "boolean",
      default: true,
      describe: "Rich interactive UI (use --no-ui for plain, agent-friendly output)",
    })
    .command(
      "$0",
      "Show this help",
      (y) => y,
      () => {
        cli.showHelp();
      },
    )
    .command(
      ["integrate", "wizard"],
      "Set up Superwall in your app (SDK → placements → dashboard)",
      (y) => y.options({ ...installDirOption, ...apiKeyOption, ...dryRunOption, ...skillOption }),
      (argv) => {
        if (argv.skill) return void import("@/commands/print-skill").then((m) => m.runPrintSkill("integrate")(argv));
        void import("@/commands/integrate").then((m) => m.runIntegrate(argv));
      },
    )
    .command(
      "placements <action>",
      "Review or implement Superwall placements",
      (y) =>
        y
          .positional("action", { choices: ["review", "implement"] as const, describe: "review | implement" })
          .options({ ...installDirOption, ...dryRunOption, ...skillOption }),
      (argv) => {
        const id = argv.action === "implement" ? "placements-implement" : "placements-review";
        if (argv.skill) return void import("@/commands/print-skill").then((m) => m.runPrintSkill(id)(argv));
        void import("@/commands/integrate").then((m) => m.runActionCommand(id)(argv));
      },
    )
    .command(
      "dashboard",
      "Set up the Superwall dashboard (campaign + placement) for your app",
      (y) => y.options({ ...installDirOption, ...apiKeyOption, ...dryRunOption, ...skillOption }),
      (argv) => {
        if (argv.skill) return void import("@/commands/print-skill").then((m) => m.runPrintSkill("dashboard-setup")(argv));
        void import("@/commands/integrate").then((m) => m.runActionCommand("dashboard-setup")(argv));
      },
    )
    .command(
      "migrate",
      "Migrate from RevenueCat / Adapty / Qonversion to Superwall",
      (y) =>
        y.options({ ...installDirOption, "dry-run": { type: "boolean", describe: "Plan without changes" }, ...skillOption }),
      (argv) => {
        if (argv.skill) return void import("@/commands/print-skill").then((m) => m.runPrintSkill("migrate")(argv));
        void import("@/commands/migrate").then((m) => m.runMigrate(argv));
      },
    )
    .command(
      "login",
      "Log in to Superwall (opens your browser)",
      (y) =>
        y.options({
          host: { type: "string", describe: "OAuth issuer override", hidden: true },
          "client-id": { type: "string", describe: "OAuth client id override", hidden: true },
        }),
      (argv) => {
        void import("@/commands/auth").then((m) => m.runLogin(argv));
      },
    )
    .command(
      "logout",
      "Log out of Superwall",
      (y) => y,
      (argv) => {
        void import("@/commands/auth").then((m) => m.runLogout(argv));
      },
    )
    .command(
      "whoami",
      "Show the logged-in Superwall account",
      (y) => y,
      (argv) => {
        void import("@/commands/auth").then((m) => m.runWhoami(argv));
      },
    )
    .command(
      "skills",
      "Install the Superwall agent toolkit (skills) for your coding agent",
      (y) =>
        y.options({
          skill: { type: "array", describe: "Install specific skills by name (default: all)" },
          "dry-run": { type: "boolean", describe: "Print the install command without running it", hidden: true },
        }),
      (argv) => {
        void import("@/commands/skills").then((m) => m.runSkills(argv));
      },
    )
    .command(
      "doctor",
      "Check the health of your Superwall integration",
      (y) => y.options(installDirOption),
      (argv) => {
        void import("@/commands/doctor").then((m) => m.runDoctor(argv));
      },
    )
    .command(
      "scan",
      "Detect apps + existing Superwall setup in this directory",
      (y) => y.options({ ...installDirOption, json: { type: "boolean", describe: "Output JSON" } }),
      (argv) => {
        void import("@/commands/scan").then((m) => m.runScan(argv));
      },
    )
    .command(
      ["asc <target> [value]", "app-store-connect <target> [value]"],
      "Call the App Store Connect API through Superwall's signed proxy (no .p8 / JWT needed)",
      (y) =>
        y
          .positional("target", { type: "string", describe: "get|post|patch|delete, a raw path (/v1/…), or: apps | products | subscriptions | iaps" })
          .positional("value", { type: "string", describe: "Path (for a verb) or app bundle id / ASC app id (for shortcuts)" })
          .options({
            d: { type: "array", describe: "Request param, Stripe-style: -d key=value (string) or key:=value (number/bool/json); nesting via key[sub]" },
            team: { type: "string", describe: "ASC team id (if the org has more than one connected)" },
            json: { type: "boolean", describe: "Output JSON" },
          }),
      (argv) => {
        void import("@/commands/asc").then((m) => m.runAsc(argv));
      },
    );

  const RESOURCE_HELP: Partial<Record<(typeof RESOURCES)[number], string>> = {
    orgs: "List your Superwall organizations",
    projects: "List your projects and their platforms (ios/android/…)",
    apps: "Add a platform to a project (superwall apps create <name> --platform ios)",
  };

  for (const resource of RESOURCES) {
    cli = cli.command(
      `${resource} [action] [value] [value2]`,
      RESOURCE_HELP[resource] ?? `Manage Superwall ${resource} (list · create)`,
      (y) =>
        y
          .positional("action", { type: "string", default: "list", describe: "list | create | placement | use | storekit" })
          .positional("value", { type: "string", describe: "identifier / description / campaign id" })
          .positional("value2", { type: "string", describe: "placement name (campaigns placement)" })
          .options({
            json: { type: "boolean", describe: "Output JSON" },
            project: { type: "string", describe: "Scope to a project id" },
            app: { type: "string", describe: "Scope to an application id" },
            name: { type: "string", describe: "Display name (products create)" },
            platform: { type: "string", describe: "ios | android | flutter | react_native | web (apps create)" },
            bundle: { type: "string", describe: "Bundle id / package name (apps create)" },
            out: { type: "string", describe: "Output file (products storekit)" },
            // products create — full product definition (mainly for agents)
            price: { type: "number", describe: "Price in major units, e.g. 9.99 (products create)" },
            currency: { type: "string", describe: "ISO currency, default USD (products create)" },
            period: { choices: ["day", "week", "month", "year"] as const, describe: "Subscription billing period (products create)" },
            "period-count": { type: "number", describe: "Periods per cycle, default 1 (products create)" },
            "trial-days": { type: "number", describe: "Free-trial length in days (products create)" },
            entitlement: { type: "array", describe: "Entitlement id(s) to grant (products create)" },
            "dry-run": { type: "boolean", describe: "Plan without writing" },
          }),
      (argv) => {
        void import("@/commands/resource").then((m) => m.runResource(resource)(argv));
      },
    );
  }

  for (const name of ["init", "pull", "plan", "push"] as const) {
    cli = cli.command(
      name,
      `Local-first Monetization-as-Code: ${name} superwall.json ↔ cloud`,
      (y) => y.options({ ...installDirOption, "dry-run": { type: "boolean", describe: "Preview (push)" } }),
      (argv) => {
        void import("@/commands/local").then((m) => m.runLocal(name)(argv));
      },
    );
  }

  cli = cli.command(
    "secrets [action] [value] [value2]",
    "Manage stored credentials (App Store Connect API key)",
    (y) =>
      y
        .positional("action", { type: "string", default: "list", describe: "set | list | rm" })
        .positional("value", { type: "string", describe: "app-store-connect" })
        .positional("value2", { type: "string", describe: "team id (rm)" })
        .options({
          "key-id": { type: "string", describe: "ASC key id" },
          issuer: { type: "string", describe: "ASC issuer id" },
          "key-file": { type: "string", describe: "Path to the .p8 key file" },
          name: { type: "string", describe: "Account name" },
          "dry-run": { type: "boolean" },
        }),
    (argv) => {
      void import("@/commands/secrets").then((m) => m.runSecrets(argv));
    },
  );

  void cli
    .version(VERSION)
    .alias("v", "version")
    .help()
    .alias("h", "help")
    .strict()
    .parse();
}
