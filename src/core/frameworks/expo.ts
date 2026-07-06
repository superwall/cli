import { Integration } from "@/constants";
import type { Framework } from "./index";
import { allDeps, fileExists, readPackageJson } from "./detect-helpers";

export const expoFramework: Framework = {
  integration: Integration.expo,
  name: "Expo (React Native)",
  supported: true,
  sdkPackage: "expo-superwall",
  docsUrl: "https://superwall.com/docs/expo",

  async detect(dir) {
    const deps = allDeps(readPackageJson(dir));
    const hasExpo = "expo" in deps;
    const hasConfig = fileExists(dir, "app.json") || fileExists(dir, "app.config.ts") || fileExists(dir, "app.config.js");
    if (hasExpo) return { score: 0.92, details: deps.expo };
    if (hasConfig && "react-native" in deps) return { score: 0.6 };
    return { score: 0 };
  },

  promptSnippet() {
    return [
      "This is an Expo (React Native) project.",
      "",
      "Install the Expo Superwall SDK: `expo-superwall` (use the project's package manager).",
      "It is an Expo config-plugin package — it requires a native rebuild (dev client or",
      "EAS build), not Expo Go.",
      "",
      "Wrap the app in the Superwall provider near the root and configure with the public",
      "API key. Do NOT add placements/`usePlacement`/`register()` calls — that's a",
      "separate step.",
      "",
      "Store the API key via an env var (e.g. EXPO_PUBLIC_SUPERWALL_API_KEY); never",
      "hard-code it. Use the exact key provided in the prompt.",
    ].join("\n");
  },
};
