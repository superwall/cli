---
name: superwall-dashboard
description: Set up an app's Superwall dashboard state so its placements actually present paywalls — create entitlements, products (imported from App Store Connect or created with real pricing), and campaigns that carry each placement. Use after the SDK is integrated and placements are registered, or whenever "nothing shows" because a placement has no campaign.
---

# Set up the Superwall dashboard

Turn an app whose code registers placements into a working dashboard: entitlement(s),
products, and campaigns that route each placement to a paywall. Use the globally
installed, already-authenticated `superwall` CLI for every change. Pass `--json` on
every command. Run `superwall whoami` first; if not logged in, tell the user to run
`superwall login`.

## The model (teach this, then act)

```
placement (in code)  →  campaign (routes it)  →  audience (who)  →  paywall (what shows)
                                                       ↑
                          products + entitlements (what's sold / unlocked)
```

- A **placement** is a `register("event")` call in the app. It does **nothing** until a
  campaign carries it.
- A **campaign** is the container that routes placements. It holds **audiences** (top-to-bottom
  filter rules; first match wins, sticky assignment) and each audience runs an **experiment**
  that splits traffic across **paywalls**.
- A **paywall** sells **products**; buying grants an **entitlement** (e.g. `pro`) which is the
  boolean the app gates features on.
- So: register a placement in code → add it to a campaign → the campaign shows a paywall. Without
  the campaign step, the placement fires and silently does nothing.

## Do it in order

1. **Find the app.** `superwall apps list --json`. Match the app by its `public_api_key`
   (the `pk_…` in the app's `configure()` call). Note its `id` → pass `--app <id>` to
   campaign/paywall commands, `--project <id>` to product/entitlement commands. One project =
   one app per platform, so defaults usually resolve; be explicit in monorepos.
2. **Find registered placements.** Grep the app for `register(`, `registerPlacement(`,
   `usePlacement(`, `Superwall.shared.register` — collect the exact event-name strings.
3. **Ensure an entitlement.** `superwall entitlements list --json`; reuse an existing one, else
   `superwall entitlements create pro --json`. Default to a single `pro` entitlement unless the
   app clearly has tiers.
4. **Ensure products.** `superwall products list --json` first. If none:
   - App Store Connect connected (`superwall asc keys list`) → import (see references/setup.md).
   - Otherwise create with real pricing:
     `superwall products create pro_yearly --price 39.99 --period year --trial-days 7 --entitlement pro --json`
5. **Carry each placement.** `superwall campaigns list --json`. For each placement not already on
   a campaign: `superwall campaigns create "<description>" --app <id> --json`, then
   `superwall campaigns placement <campaignId> <placement> --app <id> --json`.

## Guardrails

- **List before you create.** Never create a duplicate entitlement/product/campaign.
- **Never delete or destructively modify** existing campaigns, paywalls, products, or audiences.
- Reuse existing entitlements and products; only add what's missing.
- Idempotent by design — re-running should be a no-op when everything already exists.

## Best practices

- **One campaign per surface** (e.g. an "Onboarding" campaign carrying the onboarding placement,
  a "Feature gates" campaign carrying in-app gate placements) reads better than one campaign per
  placement — a campaign can carry several related placements. When unsure, one campaign per
  distinct user context.
- Name campaigns for the surface/intent, not the placement string.
- Keep entitlements coarse (`pro`); don't mint one per product.

## Report back (short-line markdown)

- What already existed (ids).
- What you created: entitlement, product ids, campaign ids, placements attached.
- **Left manual:** paywall design (Superwall dashboard editor), attaching products to the paywall,
  and — if products were created by hand — reconciling identifiers with App Store Connect / Google Play.

See `references/setup.md` for the App Store Connect import path, `.storekit` generation, and pricing-flag reference.

## Docs access

Any Superwall doc page is fetchable as markdown: `curl -sL https://superwall.com/docs/llms.txt`
to find the path (dashboard concepts live under `/docs/dashboard/`), then
`curl -sL https://superwall.com/docs/{path}.md` for the page. Use this for campaign/audience
details beyond this skill.
