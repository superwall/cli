import { Integration } from "@/constants";
import type { Framework } from "./index";

export const webFramework: Framework = {
  integration: Integration.web,
  name: "Web",
  supported: false,
  sdkPackage: "@superwall/web",
  docsUrl: "https://superwall.com/docs/web",

  promptSnippet() {
    return [
      "This appears to be a web/JavaScript project.",
      "",
      "Install the Superwall web SDK and initialize it with the public API key near app",
      "startup. Add one example placement trigger at a feature-gate entry point. Use an env",
      "var for the key; never hard-code it. Use the exact key provided in the prompt.",
      "",
      "If this is actually a backend or non-paywall project, say so clearly instead of",
      "forcing an integration.",
    ].join("\n");
  },
};
