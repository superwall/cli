import { Integration } from "@/constants";
import type { Framework } from "@/core/frameworks";
import { swiftFramework } from "@/core/frameworks/swift";
import { expoFramework } from "@/core/frameworks/expo";
import { reactNativeFramework } from "@/core/frameworks/react-native";
import { flutterFramework } from "@/core/frameworks/flutter";
import { webFramework } from "@/core/frameworks/web";

export const frameworkByIntegration: Record<Integration, Framework> = {
  [Integration.swift]: swiftFramework,
  [Integration.expo]: expoFramework,
  [Integration.reactNative]: reactNativeFramework,
  [Integration.flutter]: flutterFramework,
  [Integration.web]: webFramework,
};

const supportedNames = Object.values(frameworkByIntegration)
  .filter((f) => f.supported)
  .map((f) => f.name);

export const SUPPORTED_LABEL =
  supportedNames.length > 1
    ? `${supportedNames.slice(0, -1).join(", ")}, or ${supportedNames.at(-1)}`
    : (supportedNames[0] ?? "");
