---
name: superwall-migrate
description: Migrate an app from RevenueCat / Adapty / Qonversion to Superwall — map products, entitlements and paywall triggers, then move them over. Use when replacing another paywall/billing SDK with Superwall.
---

# Migrate to Superwall

Move an app off its current paywall/billing provider (RevenueCat, Adapty,
Qonversion) onto Superwall, either fully or paywalls-only.

## Use the CLI for every Superwall-side change

The authenticated `superwall` CLI performs all dashboard-side creates (it uses
the logged-in session — no key juggling):

- `superwall entitlements create <identifier>`
- `superwall products create <identifier> [--name <name>]`
- `superwall campaigns create <description>` then
  `superwall campaigns placement <campaignId> <placement>`
- `superwall products list --json` / `superwall entitlements list --json` to verify

## Steps

1. **Inventory** the current provider's setup: products/SKUs,
   offerings/entitlements, and every place the app presents a paywall or checks
   entitlement (find the provider's SDK calls).
2. **Map** it: products → Superwall products; offerings/entitlements → Superwall
   entitlements; each paywall trigger → a Superwall placement (`snake_case`).
3. **Create** the Superwall-side resources with the CLI commands above.
4. **Wire the app:**
   - *Full migration* → install + configure the Superwall SDK, register a
     placement at each former paywall trigger, gate features on Superwall
     entitlements / `subscriptionStatus`, and remove the old SDK once verified.
   - *Paywalls only* → keep the old provider for billing: install Superwall,
     implement a `PurchaseController` that bridges purchases to the provider, and
     set `Superwall.subscriptionStatus` from the provider's state.
5. Keep edits minimal and idiomatic — don't refactor unrelated code.

## Leftovers to hand back to the user

Manual steps the CLI can't finish: design the paywalls in the dashboard, attach
products to them, and connect App Store Connect
(`superwall secrets set app-store-connect`) so products can auto-import.

Docs: superwall.com/docs
