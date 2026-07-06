---
name: superwall-placements
description: Place and audit Superwall placements (register/paywall triggers) at the right feature-gate points in an app. Use when reviewing or adding Superwall placements.
---

# Superwall placements

A **placement** is a named trigger (`register(placement:)` / `registerPlacement`
/ `usePlacement`) you fire at a moment where the user hits a premium boundary.
Superwall decides — from your dashboard campaign — whether to show a paywall,
and gates the feature behind the result.

## Where placements go

Put a placement at genuine premium boundaries, not arbitrary spots:

- "Go premium" / upgrade buttons.
- Feature-gated actions (export, unlock, remove ads, advanced tools).
- Limit-reached moments (free quota exhausted).
- End of onboarding, settings "upgrade" entries.

Do **not** scatter placements where they can't meaningfully fire, and do not add
a placeholder button just to have one — if there's no real gate yet, say so.

## Naming

- `snake_case`, descriptive, stable (e.g. `unlock_export`, `paywall_settings`).
- Reuse existing names where present; never duplicate or typo a name.
- Keep names aligned with the dashboard campaign that routes them.

## Gating

Registering a placement is not enough — the feature must actually be gated on
the result. After the placement, gate access on `Superwall.subscriptionStatus`
(or your entitlement source) so non-subscribers don't get the paywalled feature.

## Placements ↔ campaigns

A placement only presents a paywall once it's routed through a **campaign**
(that's what decides which paywall to show, to whom). When implementing, make
sure every placement you register is on a campaign — using the installed
`superwall` CLI (it's authenticated):

- `superwall campaigns` — see existing campaigns and their placements.
- `superwall campaigns create "<description>"` — create one if needed.
- `superwall campaigns placement <campaignId> <event_name>` — route a placement.

Prefer one campaign per distinct paywall surface (e.g. onboarding, settings
upgrade) rather than one per trigger. Don't create duplicate campaigns.

## Reviewing existing placements

When auditing (read-only), for each trigger capture `name — file:line — context`,
then check: consistent snake_case naming, each trigger sits at a real gate,
obvious premium entry points that have NO placement, and whether access is
actually gated after the trigger.

Docs: superwall.com/docs
