import { test } from "node:test";
import assert from "node:assert/strict";
import { SuperwallApi } from "@/core/api/client";
import { plan, push, type LocalState } from "@/core/dashboard/local";
import type { Session } from "@/core/auth/storage";

const api = SuperwallApi.of({ apiKey: "sk_x", host: "https://api.example.com", createdAt: "n" } as Session);
const SCOPE = { projectId: "9", applicationId: "42" };

/** Cloud has entitlement "pro" and product "com.app.pro". */
function mockCloud(): { creates: Array<{ url: string; body: unknown }> } {
  const creates: Array<{ url: string; body: unknown }> = [];
  globalThis.fetch = (async (input: string | URL, init: RequestInit = {}) => {
    const url = String(input);
    const method = init.method ?? "GET";
    if (method === "POST") {
      creates.push({ url, body: init.body ? JSON.parse(String(init.body)) : undefined });
      return new Response(JSON.stringify({ id: 1 }), { status: 200 });
    }
    if (url.includes("/v2/entitlements")) return new Response(JSON.stringify({ data: [{ identifier: "pro" }], has_more: false }), { status: 200 });
    if (url.includes("/v2/products")) return new Response(JSON.stringify({ data: [{ identifier: "com.app.pro" }], has_more: false }), { status: 200 });
    return new Response(JSON.stringify({ data: [], has_more: false }), { status: 200 });
  }) as typeof fetch;
  return { creates };
}

const LOCAL: LocalState = {
  entitlements: [{ identifier: "pro" }, { identifier: "team" }], // team is new
  products: [{ identifier: "com.app.pro" }, { identifier: "com.app.plus", name: "Plus" }], // plus is new
};

test("plan computes only the missing entitlements + products", async () => {
  mockCloud();
  const p = await plan(api, LOCAL, SCOPE);
  assert.deepEqual(p.entitlements, ["team"]);
  assert.deepEqual(p.products, ["com.app.plus"]);
});

test("push creates exactly the missing rows with correct payloads", async () => {
  const { creates } = mockCloud();
  const done = await push(api, LOCAL, SCOPE);
  assert.deepEqual(done.entitlements, ["team"]);
  assert.deepEqual(done.products, ["com.app.plus"]);
  assert.equal(creates.length, 2);
  assert.deepEqual(creates[0]!.body, { project_id: "9", identifier: "team" });
  assert.deepEqual(creates[1]!.body, { project_id: "9", identifier: "com.app.plus", name: "Plus" });
});
