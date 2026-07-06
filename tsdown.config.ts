import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["bin.ts"],
  format: "esm",
  platform: "node",
  target: "node20",
  clean: true,
  dts: false,
  // tsdown externalizes package.json dependencies automatically; our own
  // source (including the "@/" alias) is bundled.
  alias: {
    "@": "src",
  },
});
