import { Integration } from "@/constants";
import type { Framework } from "./index";

export const expoFramework: Framework = {
  integration: Integration.expo,
  name: "Expo (React Native)",
  supported: true,
  sdkPackage: "expo-superwall",
  docsUrl: "https://superwall.com/docs/expo",

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
