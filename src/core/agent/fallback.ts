import { ui } from "@/ui";
import { SUPPORTED_LABEL } from "@/core/detection/framework";
import { scanProject } from "@/core/detection/scan";

export async function runFallback(installDir: string): Promise<void> {
  const scan = await scanProject(installDir);
  const top = scan.apps[0];

  if (!top) {
    if (scan.comingSoon.length) {
      ui.warn("Detected a web app — Superwall web support is coming soon.");
      ui.outro("");
      return;
    }
    ui.error(`No ${SUPPORTED_LABEL} app found here.`);
    ui.outro("See https://superwall.com/docs to set up manually.");
    return;
  }

  ui.info(`Detected ${top.framework.name}${top.details ? ` · ${top.details}` : ""}`);
  ui.note(
    [
      `1. Install the SDK: ${top.framework.sdkPackage}`,
      `2. Configure Superwall with your public API key at app launch.`,
      `3. Register one placement: register("campaign_trigger").`,
      ``,
      `Full guide: ${top.framework.docsUrl}`,
    ].join("\n"),
    "Manual setup",
  );
  ui.note(
    [
      "For a hands-free setup, install one of these and re-run the wizard:",
      "  • Claude Code  →  npm i -g @anthropic-ai/claude-code",
      "  • Codex        →  npm i -g @openai/codex",
    ].join("\n"),
    "Want it automated?",
  );
  ui.outro("Re-run `superwall integrate` after installing an agent.");
}
