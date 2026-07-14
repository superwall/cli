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

## Real-app seams — where migrations break in production (do ALL of these, every provider)

Mechanical SDK swaps pass builds and still break real apps. Before deleting ANY provider code:

- **Inventory side-effects inside the old purchase/restore callbacks BEFORE deleting them.** Real
  apps hide critical work there: backend subscription-sync POSTs, analytics events (Singular /
  PostHog / TikTok / Firebase / Adjust), attribution, referral crediting, cache refreshes,
  post-purchase navigation. Every one must be rerouted — usually into a `SuperwallDelegate`
  (`transactionComplete`, `transactionRestore`, `subscriptionStatusDidChange`) — never silently
  dropped. If the app's BACKEND gates features via its own subscription check, purchases MUST still
  notify that backend (delegate-driven POST or Superwall webhooks) and the endpoint must be verified
  to accept the new flow — old routes often expect provider-specific ids.
- **Identity lifecycle, both directions.** `identify(userId:)` at login/session-restore BEFORE any
  placement can fire; `Superwall.shared.reset()` on EVERY sign-out path — explicit logout, account
  deletion, forced auth-failure (401) logout. Grep them all; a missed path leaks one user's identity
  and paywall assignments to the next.
- **Inventory ALL purchase stacks, not just the named provider.** Grep for SwiftyStoreKit,
  `SKPaymentQueue`, raw StoreKit/Play Billing helpers, `IAPManager`-style singletons. Two
  transaction finishers = ambiguous purchase ownership; remove or explicitly retire each legacy path.
- **One configure only.** Grep for existing Superwall wrapper/manager classes before adding a
  `configure` call — apps that already had Superwall for paywalls often configure it in a wrapper;
  a second configure call is a bug.
- **Feature closures on gating placements.** Any `register` that gates navigation must put the
  navigation in the feature closure so holdout / skipped / non-gated paths still proceed — never
  assume the paywall presents.
- **Dashboard hard gate.** Before creating ANY dashboard resource, confirm `superwall apps list
  --json` contains the app whose `public_api_key` matches the key in code (or bundle id matches).
  Wrong account → STOP dashboard work loudly, record it as incomplete in the handback, tell the
  user to `superwall login` with the owning account. Never create resources in an unrelated project,
  and never report the migration complete with dashboard work silently skipped.

## Three modes — decide who owns purchases first (this is about billing ownership, not what migrates)

Removing the provider is not the whole decision: something still has to purchase, restore, and
**tell Superwall who is subscribed**. Superwall only auto-detects state when its own SDK made the
purchase. Pick one (details + verified code in the provider playbook's §2):

- **FULL, Superwall owns purchases** (default, simplest) — remove the provider SDK; Superwall's
  built-in purchasing and device-level entitlements take over. No `PurchaseController`, no manual
  status setting. Use unless the app keeps its own checkout/billing code.
- **FULL, app keeps its own purchase flow** — provider gone, but the app still buys via custom UI /
  direct StoreKit / Play Billing and uses Superwall only for paywalls. Superwall does NOT observe
  purchases it didn't make, so you MUST sync state via ONE of: a `PurchaseController`, observer mode
  (`SuperwallOptions.shouldObservePurchases = true`), or a manual `Superwall.shared.subscriptionStatus`
  set on every change. Skip this and paywalls show to paying users. **The easiest mode to get wrong.**
- **PAYWALLS-ONLY, provider stays purchase controller** — provider remains the source of truth for
  purchases. Keep its SDK, install Superwall with a `PurchaseController` that forwards buys to the
  provider and mirror its entitlements into `Superwall.shared.subscriptionStatus`. Use when the
  provider's receipt validation, webhooks, or cross-platform entitlements must remain authoritative.
  (Pure observer mode is the analytics-only variant: provider owns purchases AND paywalls, Superwall
  just records revenue.)

## CLI — every Superwall-side resource

The authenticated `superwall` CLI performs all dashboard creates (logged-in session, no key juggling):

- `superwall entitlements create <id>` · `superwall entitlements list --json`
- `superwall products create <id> [--name <name>]` · `superwall products list --json`
- `superwall campaigns create "<description>" <placement>` (initial placement required) → more via `superwall campaigns placement <campaignId> <placement>` · `superwall campaigns list --json`

ASC products can be imported via the products flow / an ASC connection (`superwall asc keys set …`) instead of manual creation.

## Hand back to the user (dashboard-only, manual)

- **Rebuild each paywall** in the editor (designs do not import) and attach products.
- Connect ASC/Play so products auto-import.
- Never delete the old provider's dashboard/webhook config until verified in production.

Docs: superwall.com/docs
