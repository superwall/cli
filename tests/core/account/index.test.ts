import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveAccount } from "@/core/account";
import { recordingRenderer } from "../../helpers/renderer";

const existing = {
  sdkInstalled: false,
  configureFound: false,
  registerCalls: [],
  fullyIntegrated: false,
};

test("noninteractive account resolution never invents an API key", async () => {
  const previous = process.env.SUPERWALL_API_KEY;
  delete process.env.SUPERWALL_API_KEY;
  try {
    await assert.rejects(
      resolveAccount({
        existing,
        argv: { _: [], $0: "superwall" },
        interactive: false,
        ui: recordingRenderer(),
      }),
      /No public API key found/,
    );
  } finally {
    if (previous === undefined) delete process.env.SUPERWALL_API_KEY;
    else process.env.SUPERWALL_API_KEY = previous;
  }
});

test("noninteractive account resolution accepts explicit and existing keys", async () => {
  const explicit = await resolveAccount({
    existing,
    argv: { _: [], $0: "superwall", apiKey: "pk_explicit" },
    interactive: false,
    ui: recordingRenderer(),
  });
  const project = await resolveAccount({
    existing: { ...existing, apiKey: "pk_project" },
    argv: { _: [], $0: "superwall" },
    interactive: false,
    ui: recordingRenderer(),
  });

  assert.equal(explicit?.apiKey, "pk_explicit");
  assert.equal(project?.apiKey, "pk_project");
});

test("interactive account fallback asks only for the public API key", async () => {
  const ui = recordingRenderer();
  ui.text = async () => "pk_prompted";

  const result = await resolveAccount({
    existing,
    argv: { _: [], $0: "superwall" },
    interactive: true,
    ui,
  });

  assert.deepEqual(result, { apiKey: "pk_prompted" });
});
