import { Integration } from "@/constants";
import type { Framework } from "@/core/frameworks";
import { swiftFramework } from "@/core/frameworks/swift";
import { expoFramework } from "@/core/frameworks/expo";
import { reactNativeFramework } from "@/core/frameworks/react-native";
import { flutterFramework } from "@/core/frameworks/flutter";
import { webFramework } from "@/core/frameworks/web";

/** Every framework the wizard can target. */
export const FRAMEWORKS: Framework[] = [
  swiftFramework,
  expoFramework,
  reactNativeFramework,
  flutterFramework,
  webFramework,
];

/** Lookup a framework profile (sdkPackage, docs, prompt) by integration id. */
export const frameworkByIntegration: Record<Integration, Framework> = {
  [Integration.swift]: swiftFramework,
  [Integration.expo]: expoFramework,
  [Integration.reactNative]: reactNativeFramework,
  [Integration.flutter]: flutterFramework,
  [Integration.web]: webFramework,
};
