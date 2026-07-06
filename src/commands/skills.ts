import { ui } from "@/ui";
import { defineCommand } from "@/command";
import { KNOWN_SKILLS, SUPERWALL_SKILLS_SOURCE, installToolkit, installBundledSkills } from "@/core/skills/install";

/**
 * `superwall skills [--skill <name>...] [--dry-run]`
 *
 * Install the Superwall agent toolkit globally (every detected agent) via the
 * open `skills` CLI — canonical ~/.agents/skills + per-agent symlinks. When run
 * interactively without --skill, you pick which skills to install.
 */
export const runSkills = defineCommand(async (ctx) => {
  ui.intro("Superwall agent toolkit");

  let skills = normalizeList(ctx.argv.skill);
  const { dryRun, plain } = ctx;

  // Interactive picker when no explicit selection (mirrors the `skills` CLI).
  if (!skills && !dryRun && !plain) {
    const picked = await ui.multiselect({
      message: `Which skills from ${SUPERWALL_SKILLS_SOURCE}? (installs globally)`,
      options: KNOWN_SKILLS.map((s) => ({ value: s.name, label: s.name, hint: s.summary })),
      initialValues: KNOWN_SKILLS.map((s) => s.name),
    });
    if (picked === null || picked.length === 0) {
      ui.warn("Nothing selected.");
      return;
    }
    skills = picked;
  } else {
    const shown = skills?.length ? KNOWN_SKILLS.filter((s) => skills!.includes(s.name)) : KNOWN_SKILLS;
    ui.note(shown.map((s) => `\`${s.name}\`\n  ${s.summary}`).join("\n\n"), "Installing globally");
  }

  const spin = ui.spinner();
  spin.start(dryRun ? "Resolving" : "Installing skills globally");
  const pub = await installToolkit({ skills, dryRun });
  const bundled = await installBundledSkills({ dryRun }); // integration/migration/placements
  const ok = pub.ok || bundled.ok;
  spin.stop(dryRun ? "Dry run" : ok ? "Skills installed for every detected agent" : "Install failed");

  if (dryRun) {
    ui.info(pub.command);
    ui.info(bundled.command);
  }
  ui.outro(
    ok
      ? `**Done.** Try: ask your agent to "review my Superwall placements".`
      : "Something went wrong — try again, or check that `npx` is available.",
  );
});

function normalizeList(v: unknown): string[] | undefined {
  if (Array.isArray(v)) return v.map(String);
  if (typeof v === "string") return [v];
  return undefined;
}
