import { Integration } from "@/constants";

export interface FrameworkContext {
  installDir: string;
  /** Free-form notes the detector gathered (e.g. "SwiftUI", "Expo SDK 52"). */
  details?: string;
}

export interface Framework {
  integration: Integration;
  /** Human label shown in the UI. */
  name: string;
  /** Whether the wizard can set this platform up today (web is coming soon). */
  supported: boolean;
  /** SDK package the agent should install. */
  sdkPackage: string;
  docsUrl: string;
  /**
   * Detect whether this framework applies. Returns a confidence score 0..1
   * (0 = not this framework) plus optional notes. The highest score wins.
   */
  detect(installDir: string): Promise<{ score: number; details?: string }>;
  /** Framework-specific guidance injected into the agent prompt. */
  promptSnippet(ctx: FrameworkContext): string;
}
