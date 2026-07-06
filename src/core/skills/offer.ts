import { ui } from "@/ui";
import { isNonInteractive } from "@/util/env";
import { KNOWN_SKILLS, installToolkit } from "./install";

/**
 * Offer to install the Superwall agent toolkit (skills) globally, letting the
 * user pick which skills — like the `skills` CLI.
 */
export async function offerToolkit(): Promise<boolean> {
  if (isNonInteractive()) return false;

  const selected = await ui.multiselect({
    message: "Install Superwall skills for your coding agent? (space to toggle, enter to confirm)",
    options: KNOWN_SKILLS.map((s) => ({ value: s.name, label: s.name, hint: s.summary })),
    initialValues: KNOWN_SKILLS.map((s) => s.name),
  });
  if (selected === null || selected.length === 0) return false;

  const spin = ui.spinner();
  spin.start("Installing skills globally");
  const { ok } = await installToolkit({ skills: selected });
  spin.stop(ok ? "Skills installed for every detected agent" : "Skill install failed — run `superwall skills` to retry");
  return ok;
}
