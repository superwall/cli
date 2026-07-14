import { defineCommand } from "@/command";
import { titleCase } from "@/core/api/resources";
import { loginWithApiKey, performLogin } from "@/core/auth/login";
import { clearSession, loadSession, type Session } from "@/core/auth/storage";

export const runLogin = defineCommand({
  name: "login",
  output: "both",
  async run(ctx) {
    const { ui } = ctx;
    ui.intro("Superwall login");

    const apiKeyArg = ctx.argv.apiKey as string | undefined;
    if (apiKeyArg) {
      const spin = ui.spinner();
      spin.start("Verifying your API key");
      try {
        const session = await loginWithApiKey(apiKeyArg);
        spin.stop("Logged in");
        if (ctx.json) return ctx.output.data(sessionOutput(session));
        ui.success(
          `Logged in with an API key${session.orgName ? ` · \`${session.orgName}\`` : ""}.`,
        );
        ui.outro(
          "You're all set — run `superwall integrate` to set up your app.",
        );
      } catch (e) {
        spin.stop("Login failed");
        throw e;
      }
      return;
    }

    if (!ctx.interactive)
      throw new Error(
        "Browser login requires an interactive terminal. Use `superwall login --api-key <key>`.",
      );

    const spin = ui.spinner();
    try {
      const session = await performLogin({
        issuer: ctx.argv.host as string | undefined,
        clientId: ctx.argv.clientId as string | undefined,
        onVerify: ({ url, userCode }) => {
          ui.info("Opening your browser to approve this login.");
          ui.note(
            `If your browser didn't open, visit:\n\n${url}\n\nand enter the code  \`${userCode}\``,
            "Approve in your browser",
          );
          spin.start("Waiting for you to approve in the browser");
        },
        onStatus: (m) => spin.message(m),
        onSelectOrg: async (orgs) => {
          const sel = await ui.select({
            message: "Which organization?",
            options: orgs.map((o) => ({
              value: String(o.id),
              label: o.name,
              hint: titleCase(o.role),
            })),
          });
          spin.start("Setting things up");
          return sel === null
            ? null
            : (orgs.find((o) => String(o.id) === sel) ?? null);
        },
        onCreateOrg: async () => {
          const name = await ui.text({
            message: "Welcome to Superwall! Name your organization",
            placeholder: "My Company",
            validate: (v) => (v?.trim() ? undefined : "Required"),
          });
          spin.start("Creating your account");
          return name === null ? null : name.trim();
        },
      });
      spin.stop("Logged in");
      ui.success(
        `Logged in as \`${session.userEmail ?? "you"}\`${session.orgName ? ` · \`${session.orgName}\`` : ""}`,
      );
      ui.outro(
        "You're all set — run `superwall integrate` to set up your app.",
      );
    } catch (e) {
      spin.stop("Login failed");
      throw e;
    }
  },
});

export const runLogout = defineCommand({
  name: "logout",
  output: "both",
  run(ctx) {
    const s = loadSession();
    clearSession();
    if (ctx.json)
      return ctx.output.data({
        loggedOut: Boolean(s),
        account: s ? sessionOutput(s) : null,
      });
    if (s)
      ctx.ui.success(`Logged out${s.userEmail ? ` (${s.userEmail})` : ""}.`);
    else ctx.ui.info("You weren't logged in.");
  },
});

export const runWhoami = defineCommand({
  name: "whoami",
  output: "both",
  run(ctx) {
    const s = loadSession();
    if (!s) {
      if (ctx.json) return ctx.output.data({ authenticated: false });
      ctx.ui.info("Not logged in. Run `superwall login`.");
      return;
    }
    if (ctx.json) return ctx.output.data(sessionOutput(s));
    const credential = s.apiKey
      ? `API key sk_…${s.apiKey.slice(-4)}`
      : s.accessToken
        ? "OAuth session"
        : "—";
    ctx.ui.list({
      items: [
        {
          label: s.userEmail ?? "Logged in",
          meta: s.orgName ? `· ${s.orgName}` : undefined,
          children: [{ label: credential, meta: s.host }],
        },
      ],
    });
  },
});

function sessionOutput(session: Session): Record<string, unknown> {
  return {
    authenticated: true,
    user: { email: session.userEmail ?? null },
    organization: {
      id: session.orgId ?? null,
      name: session.orgName ?? null,
      count: session.orgCount ?? 1,
    },
    credential: {
      type: session.apiKey
        ? "api_key"
        : session.accessToken
          ? "oauth"
          : "unknown",
    },
  };
}
