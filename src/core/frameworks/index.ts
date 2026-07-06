import { Integration } from "@/constants";

export interface FrameworkContext {
  installDir: string;
  details?: string;
}

export interface Framework {
  integration: Integration;
  name: string;
  supported: boolean;
  sdkPackage: string;
  docsUrl: string;
  promptSnippet(ctx: FrameworkContext): string;
}
