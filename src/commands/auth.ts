import { ui } from "@/ui";
import { defineCommand } from "@/command";
import { titleCase } from "@/core/api/resources";
import { performLogin } from "@/core/auth/login";
import { clearSession, loadSession } from "@/core/auth/storage";

export const runLogin = defineCommand(async (ctx) => {
  ui.intro("Superwall login");
  const spin = ui.spinner();
  try {
    const session = await performLogin({
      issuer: ctx.argv.host as string | undefined,
      clientId: ctx.argv.clientId as string | undefined,
      onVerify: ({ url, userCode }) => {
        ui.info("Opening your browser to approve this login.");
        ui.note(`If your browser didn't open, visit:\n\n${url}\n\nand enter the code  \`${userCode}\``, "Approve in your browser");
        spin.start("Waiting for you to approve in the browser");
      },
      onStatus: (m) => spin.message(m),
      onSelectOrg: async (orgs) => {
        const sel = await ui.select({
          message: "Which organization?",
          options: orgs.map((o) => ({ value: String(o.id), label: o.name, hint: titleCase(o.role) })),
        });
        spin.start("Setting things up");
        return sel === null ? null : (orgs.find((o) => String(o.id) === sel) ?? null);
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
    ui.success(`Logged in as \`${session.userEmail ?? "you"}\`${session.orgName ? ` · \`${session.orgName}\`` : ""}`);
    ui.outro("You're all set — run `superwall integrate` to set up your app.");
  } catch (e) {
    spin.stop("Login failed");
    throw e;
  }
});

export const runLogout = defineCommand(() => {
  const s = loadSession();
  clearSession();
  if (s) ui.success(`Logged out${s.userEmail ? ` (${s.userEmail})` : ""}.`);
  else ui.info("You weren't logged in.");
});

export const runWhoami = defineCommand(() => {
  const s = loadSession();
  if (!s) {
    ui.info("Not logged in. Run `superwall login`.");
    return;
  }
  ui.list({
    items: [
      {
        label: s.userEmail ?? "Logged in",
        meta: s.orgName ? `· ${s.orgName}` : undefined,
        children: [{ label: `sk_…${s.apiKey.slice(-4)}`, meta: s.host }],
      },
    ],
  });
});
