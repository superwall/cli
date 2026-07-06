import { Integration } from "@/constants";
import type { Framework } from "./index";

export const swiftFramework: Framework = {
  integration: Integration.swift,
  name: "Swift (iOS)",
  supported: true,
  sdkPackage: "https://github.com/superwall/Superwall-iOS",
  docsUrl: "https://superwall.com/docs/installation-via-spm",

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
