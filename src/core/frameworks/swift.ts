import { join } from "node:path";
import { readFileSync } from "node:fs";
import { Integration } from "@/constants";
import type { Framework } from "./index";
import { fileExists, glob } from "./detect-helpers";

async function detectUiKind(dir: string): Promise<string> {
  const swiftFiles = await glob(dir, "**/*.swift");
  let swiftui = false;
  let uikit = false;
  for (const f of swiftFiles.slice(0, 200)) {
    try {
      const c = readFileSync(join(dir, f), "utf8");
      if (c.includes("import SwiftUI")) swiftui = true;
      if (c.includes("import UIKit")) uikit = true;
    } catch {
      /* ignore */
    }
  }
  if (swiftui) return "SwiftUI";
  if (uikit) return "UIKit";
  return "Swift";
}

export const swiftFramework: Framework = {
  integration: Integration.swift,
  name: "Swift (iOS)",
  supported: true,
  sdkPackage: "https://github.com/superwall/Superwall-iOS",
  docsUrl: "https://superwall.com/docs/installation-via-spm",

  async detect(dir) {
    const xcodeProjects = await glob(dir, "*.xcodeproj", true);
    const hasPackageSwift = fileExists(dir, "Package.swift");
    const swiftFiles = await glob(dir, "**/*.swift");
    if (xcodeProjects.length > 0 && swiftFiles.length > 0) {
      return { score: 0.95, details: await detectUiKind(dir) };
    }
    if (hasPackageSwift) return { score: 0.8, details: "Swift Package" };
    if (swiftFiles.length > 0) return { score: 0.5, details: "Swift" };
    return { score: 0 };
  },

  promptSnippet(ctx) {
    return [
      `This is a Swift / iOS project (${ctx.details ?? "Swift"}).`,
      "",
      "Install the Superwall iOS SDK via Swift Package Manager:",
      "- Package URL: https://github.com/superwall/Superwall-iOS",
      "- For an Xcode project, add an XCRemoteSwiftPackageReference and an",
      "  XCSwiftPackageProductDependency (product name: SuperwallKit) to the .pbxproj.",
      "- For a Package.swift, add the dependency and product to the manifest.",
      "",
      "Configure Superwall at app launch with the public API key:",
      "- SwiftUI: call `Superwall.configure(apiKey: \"<KEY>\")` in the App's `init()`",
      "  (or an `.onAppear` on the root scene), importing SuperwallKit.",
      "- UIKit: call it in `application(_:didFinishLaunchingWithOptions:)`.",
      "",
      "IMPORTANT: do not invent an API key. Use the exact key provided in the prompt.",
      "Ask the user to close Xcode first if the project may be open (Xcode can clobber",
      "edits to the .pbxproj).",
    ].join("\n");
  },
};
