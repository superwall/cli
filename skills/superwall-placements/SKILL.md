---
name: superwall-placements
description: Place and audit Superwall placements (register / paywall triggers) at the right feature-gate points in an app, and route them to campaigns. Use when adding, reviewing, or debugging where paywalls fire in iOS, Expo, React Native, or Flutter apps.
---

# Superwall placements

A **placement** is a named event you fire at a monetizable moment. You register it,
optionally with a `feature` callback. Superwall evaluates your dashboard campaign
on-device and decides — remotely — whether to show a paywall and whether the
feature is gated. **You never check subscription status by hand at the call site.**

The API is the easy part. The value of this skill is knowing *where* to place
placements and *why*. Read the strategy playbook first, then your framework's
reference for the exact call.

## Read the strategy playbook FIRST

`references/strategy.md` — the definitive, framework-agnostic guide to where
placements go and why. Read it before adding or auditing any placement. It covers:

- **The mental model** — register every monetizable moment; let the campaign
  decide. Placements are free experimentation surface; an unassigned one does
  nothing until routed. **Never gate by checking subscription status in code** —
  it freezes your monetization into an app release.
- **The core set** every app should register (`onboarding_complete`, per-feature
  gates, limit-reached, upgrade entry, broad-reach lifecycle, win-back).
- **App-type playbook** — concrete placements for editors, fitness, productivity,
  content, dating/social, and AI apps.
- **The audit method** — enumerate the paid surface first, then map surface →
  placement and flag the gaps.
- **Gate depth** — hard gate (paid-only) vs soft/non-gated (upsell), and when each
  is right.
- **How many** (~5–15, each a distinct intent) and **naming rules**.

## Then read the framework reference

Exact API, gating semantics, placement examples, audit checklist, and pitfalls:

| Framework | Reference |
|---|---|
| iOS / Swift | `references/ios.md` |
| Expo | `references/expo.md` |
| React Native | `references/react-native.md` |
| Flutter | `references/flutter.md` |

## Placements need campaigns (`superwall` CLI, authenticated)

A placement is inert until a campaign routes it in the dashboard:

- `superwall campaigns list --json` — existing campaigns and their placements.
- `superwall campaigns create "<description>"` — create one if needed.
- `superwall campaigns placement <campaignId> <placement_name>` — route a placement.

One campaign per distinct paywall surface (onboarding, settings upgrade), routing
the placements that belong to it — not one per trigger. Don't create duplicates.

## Docs access

Superwall docs are agent-fetchable as markdown:

- **Discover pages:** `curl -sL https://superwall.com/docs/llms.txt` (index of all
  pages) or a platform index like `https://superwall.com/docs/ios/llms.txt`.
- **Fetch a page:** append `.md` to any docs route and use `curl -sL` (follow
  redirects), e.g. `curl -sL https://superwall.com/docs/ios/quickstart/feature-gating.md`.
- Full-text dumps: `.../llms-full.txt` per platform.

Key pages: `feature-gating`, `sdk-reference/register`,
`dashboard/dashboard-campaigns/campaigns-placements`, and
`dashboard/dashboard-campaigns/campaigns-standard-placements` (the auto-registered
lifecycle placements).
