import { Integration } from "@/constants";
import type { Framework } from "./index";
import { allDeps, readPackageJson } from "./detect-helpers";

export const reactNativeFramework: Framework = {
  integration: Integration.reactNative,
  name: "React Native",
  supported: true,
  sdkPackage: "@superwall/react-native-superwall",
  docsUrl: "https://superwall.com/docs/react-native",

  async detect(dir) {
    const deps = allDeps(readPackageJson(dir));
    // Bare RN only — Expo is handled by its own (higher-confidence) detector.
    if ("react-native" in deps && !("expo" in deps)) {
      return { score: 0.85, details: deps["react-native"] };
    }
    return { score: 0 };
  },

  promptSnippet() {
    return [
      "This is a bare React Native project.",
      "",
      "Install `@superwall/react-native-superwall` with the project's package manager and",
      "run `pod install` in ios/ if on macOS.",
      "",
      "Configure Superwall with the public API key near the app root. Do NOT add",
      "placements/`register()` calls — that's a separate step. Use an env var for the",
      "key; never hard-code it. Use the exact key in the prompt.",
    ].join("\n");
  },
};
