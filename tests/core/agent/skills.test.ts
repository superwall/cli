import { test } from "node:test";
import assert from "node:assert/strict";
import { actionById } from "@/core/agent/actions";
import { loadBundledSkill } from "@/core/agent/skills";

test("review uses the broad setup skill rather than the placement skill", () => {
  const body = loadBundledSkill("superwall-review", "ios");

  assert.match(body, /Review the integration as a system, not as a placement inventory/);
  assert.match(body, /Purchases & subscriptions/);
  assert.match(body, /Deep links and Web Checkout/);
  assert.match(body, /Analytics events becoming placements is recommended/);
  assert.doesNotMatch(body, /Review Superwall — Expo/);
});

test("review composes exactly one framework reference", () => {
  const cases = [
    ["ios", "iOS / Swift"],
    ["expo", "Expo"],
    ["react-native", "React Native"],
    ["flutter", "Flutter"],
  ] as const;

  for (const [reference, heading] of cases) {
    const body = loadBundledSkill("superwall-review", reference);
    assert.match(body, new RegExp(`# Review Superwall — ${heading}`));
    for (const [, other] of cases) {
      if (other !== heading) assert.doesNotMatch(body, new RegExp(`# Review Superwall — ${other}`));
    }
  }
});

test("review action is read-only and fix action is writable", () => {
  assert.equal(actionById.review.readOnly, true);
  assert.equal(actionById.review.outputMode, "report");
  assert.equal(actionById["review-fix"].readOnly, false);
  assert.equal(actionById["review-fix"].outputMode, "silent");
});
