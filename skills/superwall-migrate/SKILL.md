---
name: superwall-migrate
description: Migrate an app's SDK integration from RevenueCat / Adapty / Qonversion to Superwall — swap the provider's SDK calls for Superwall's (configure, identify, placements, entitlement gating) and set up the Superwall-side products, entitlements and campaigns. Paywalls are rebuilt in the editor; subscriber state stays store-side. Use when replacing another paywall/billing SDK with Superwall.
---

# Migrate to Superwall

## What this skill does — and does NOT do

This skill migrates the **SDK integration**. It:

- Replaces the provider's SDK calls with Superwall's — `configure`, `identify`,
  entitlement gating, and (most importantly) turning every "fetch offering + present paywall"
  call site into a Superwall **placement**.
- Sets up the Superwall-side resources with the CLI — **products**, **entitlements**, and
  **campaigns/placements** are *re-created* in Superwall (reusing the same store product ids).

> **Important — what does NOT migrate:**
> - **Paywall designs.** Provider paywalls (RC Paywalls, Adapty Paywall Builder, Qonversion UI)
>   **cannot** be imported. They are **rebuilt from scratch** in the Superwall editor (dashboard). Manual, hand-back to the user.
> - **Historical analytics / attribution.** Past revenue, cohorts and attribution stay in the old
>   provider. Superwall starts collecting from the day you integrate.
> - **The subscriber base (server-side).**
>   - **Adapty / Qonversion:** there is **no** server-side subscriber migration. Existing subscribers
>     keep working because their purchases live with the store (StoreKit / Play Billing) — the app
>     reads them device-side via **Restore Purchases** and maps them to Superwall entitlements. No
>     subscriber data moves between backends.
>   - **RevenueCat:** device-side restore works the same way today. In addition, Superwall has a
>     **subscription-migration feature coming soon** that will migrate subscriptions from RevenueCat
>     into Superwall via the dashboard ([superwall.com/dashboard](https://superwall.com/dashboard)).
>     Not shipped yet — do not rely on it for this migration.

## Docs access — always fetch live

Doc content changes; fetch it rather than trusting baked text.

```bash
curl -sL https://superwall.com/docs/llms.txt          # index — find the right page path
curl -sL https://superwall.com/docs/{path}.md         # any doc page as markdown (verified working)
```

## Detect the provider, then open its playbook

Grep the codebase for the SDK, then read the matching reference in full before touching anything:

| Provider | Detect (package / import) | Playbook |
|---|---|---|
| RevenueCat | `RevenueCat`, `react-native-purchases`, `purchases_flutter`, `Purchases.configure` | `references/revenuecat.md` |
| Adapty | `Adapty`, `react-native-adapty`, `adapty_flutter`, `Adapty.activate` | `references/adapty.md` |
| Qonversion | `Qonversion`, `react-native-qonversion`, `qonversion_flutter`, `Qonversion.initWithConfig` | `references/qonversion.md` |

If more than one is present, migrate the one that owns purchases; treat the other as already-observer.

## Flow (every provider)

1. **Inventory** — grep the provider's SDK symbols: configure/activate, purchase, restore,
   entitlement/access-level checks, and every paywall presentation call site. The playbook lists exact symbols per framework.
2. **Map** — products → Superwall products; entitlements/access-levels/permissions → Superwall
   entitlements; each paywall/presentation call site → a Superwall placement (`snake_case`).
3. **Re-create** the Superwall-side resources with the CLI (below). Reuse the SAME App Store / Play
   product identifiers — the store products never change, only the management layer does.
4. **Wire the app** — install + configure Superwall, then follow the chosen mode.
5. **Verify** — build, present each placement, confirm existing subscribers are recognized
   (Restore Purchases), then remove the old SDK only in FULL mode.

## Two modes — decide first (this is about who owns billing, not what migrates)

- **FULL** — Superwall owns billing. Remove the provider SDK; Superwall's built-in purchasing
  and device-level entitlements take over. Simplest; use unless billing must stay put.
- **PAYWALLS-ONLY** — provider stays the source of truth for purchases. Keep its SDK, install
  Superwall with a `PurchaseController` that forwards buys to the provider and mirror its
  entitlements into `Superwall.subscriptionStatus`. Use when the provider's receipt validation,
  webhooks, or cross-platform entitlements must remain authoritative. (Observer mode is the
  analytics-only variant: provider owns purchases AND paywalls, Superwall just records revenue.)

## CLI — every Superwall-side resource

The authenticated `superwall` CLI performs all dashboard creates (logged-in session, no key juggling):

- `superwall entitlements create <id>` · `superwall entitlements list --json`
- `superwall products create <id> [--name <name>]` · `superwall products list --json`
- `superwall campaigns create <description>` → `superwall campaigns placement <campaignId> <placement>` · `superwall campaigns list --json`

ASC products can be imported via the products flow / an ASC connection (`superwall secrets set
app-store-connect`) instead of manual creation.

## Hand back to the user (dashboard-only, manual)

- **Rebuild each paywall** in the editor (designs do not import) and attach products.
- Connect ASC/Play so products auto-import.
- Never delete the old provider's dashboard/webhook config until verified in production.

Docs: superwall.com/docs
