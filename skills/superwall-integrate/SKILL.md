---
name: superwall-integrate
description: Install and configure the Superwall SDK in a mobile app (iOS/Swift, Expo, React Native, Flutter) — the right way, with correct purchase handling. Use when adding Superwall to an app for the first time.
---

# Integrate the Superwall SDK

Get Superwall installed and configured with the smallest, cleanest set of edits.
Placements (paywall triggers) are a **separate step** — do not add `register()`
calls or example "Go Premium" buttons here.

## Principles

- Make the smallest set of edits that yields a working, verifiable integration.
  Don't refactor or reformat unrelated code.
- Read a file before editing it; match its existing style and conventions.
- Detect the package manager / build system from the project (lockfiles, config)
  — never assume npm/yarn/pnpm/CocoaPods/SPM.
- **Never invent an API key.** Use the exact public key you were given. Never
  commit a secret. The public Superwall key may be inlined where the platform
  conventionally does so (e.g. iOS `configure()`); otherwise store it in the
  platform's standard env/config mechanism.

## Install & configure

Install the platform SDK, then call Superwall's configure **once, at app
launch**, as early in the launch path as possible, with the public API key.

| Platform | Package | Docs |
| --- | --- | --- |
| iOS / Swift | SPM `github.com/superwall/Superwall-iOS` (product `SuperwallKit`) | superwall.com/docs/installation-via-spm |
| Expo | `expo-superwall` (config plugin — needs a native rebuild, not Expo Go) | superwall.com/docs/expo |
| React Native | `@superwall/react-native-superwall` (`pod install` on iOS) | superwall.com/docs/react-native |
| Flutter | `superwallkit_flutter` | superwall.com/docs/flutter |

Always follow the current official docs for the exact configure call and entry
point.

## Purchase handling (get this right)

Pick the path that matches how the app already handles purchases:

- **No existing IAP system** → default. No `PurchaseController`; Superwall
  manages purchases, restoration, and subscription state.
- **RevenueCat present** → follow Superwall's RevenueCat guide (don't
  double-manage purchases) and keep `Superwall.subscriptionStatus` in sync with
  RevenueCat's entitlement state.
- **Custom / server-side billing** (Qonversion, Adapty, direct StoreKit) →
  implement a `PurchaseController` and set `Superwall.subscriptionStatus`
  yourself from your source of truth.

## Definition of done

1. SDK installed and resolving.
2. Superwall configured once at launch with the provided public key.
3. If a build command exists, build to verify it compiles.

Do NOT add placements, `register()` calls, or example paywall buttons — that is
the placements step.
