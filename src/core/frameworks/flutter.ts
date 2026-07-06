import { Integration } from "@/constants";
import type { Framework } from "./index";

export const flutterFramework: Framework = {
  integration: Integration.flutter,
  name: "Flutter",
  supported: true,
  sdkPackage: "superwallkit_flutter",
  docsUrl: "https://superwall.com/docs/flutter",

  promptSnippet() {
    return [
      "This is a Flutter project.",
      "",
      "Add `superwallkit_flutter` to pubspec.yaml and run `flutter pub get`.",
      "Configure Superwall with the public API key in main()/app init. Do NOT add",
      "placements/`registerPlacement()` calls — that's a separate step. Use the exact key",
      "provided in the prompt; do not hard-code it where it could be committed as a secret.",
    ].join("\n");
  },
};
