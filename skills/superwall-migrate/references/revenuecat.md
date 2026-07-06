# RevenueCat → Superwall

Definitive playbook. Read fully before editing.

## Scope & checklist

This migrates the **SDK integration**, not the whole product. Checklist:

- [ ] Inventory RevenueCat SDK usage (grep §3)
- [ ] Map products / entitlements / presentation call sites (§1)
- [ ] Re-create products, entitlements, campaign + placements in Superwall via CLI (§4)
- [ ] Swap SDK calls (configure, entitlement reads, presentation → placement, identify) (§5)
- [ ] Build + verify each placement; Restore Purchases as an existing subscriber (§7)
- [ ] FULL only: remove RC dependency once verified
- [ ] Hand back to user: **rebuild paywalls in the editor**, attach products, connect ASC/Play

> **Important — what does NOT migrate:**
> - **RC paywall designs** cannot be imported — they are **rebuilt** in the Superwall editor.
> - **Historical analytics / attribution** stays in RevenueCat.
> - **Subscriber base:** existing subscribers keep access via device-side **Restore Purchases**
>   (their purchases live with the store, not RC). A server-side **subscription migration from
>   RevenueCat is coming soon** via the dashboard ([superwall.com/dashboard](https://superwall.com/dashboard)) —
>   not shipped yet, don't depend on it.

## Docs access — fetch live, don't trust baked text

```bash
curl -sL https://superwall.com/docs/llms.txt                                             # index
curl -sL https://superwall.com/docs/dashboard/guides/migrating-from-revenuecat-to-superwall.md  # migration guide (verified)
curl -sL https://superwall.com/docs/ios/guides/using-revenuecat.md                       # PAYWALLS-ONLY controller (swap ios→expo/flutter/android)
curl -sL https://superwall.com/docs/ios/guides/advanced-configuration.md                 # PurchaseController protocol
```

## 1. Concept mapping

| RevenueCat | Superwall | Notes |
|---|---|---|
| Product (store SKU wrapped in RC dashboard) | **Product** (re-created) | Keep the SAME App Store / Play product identifier. Only the management layer moves. |
| Package (`$rc_monthly`, inside an Offering) | (no direct equal) | A package is just "product + duration slot." In Superwall you attach the raw products to a paywall in the editor. |
| Offering (remote set of packages) | **Paywall** + **Campaign** | RC picks products remotely via Offering; Superwall picks the whole paywall (products included) remotely via Campaign rules. |
| Entitlement (e.g. `pro`) | **Entitlement** (re-created) | 1:1. Recreate each RC entitlement id as a Superwall entitlement. |
| `customerInfo.entitlements.active` | `Superwall.shared.subscriptionStatus` (`.active(Set<Entitlement>)` / `.inactive` / `.unknown`) | Status is device-derived in FULL mode. |
| RC Paywalls (RC's paywall UI) | **Paywall** (rebuilt in editor), shown by **placement** | Design does NOT import — see below. |
| Manual "should I show a paywall?" gating in code | **register(placement:)** — campaign decides | |

**Mental-model shift.** With RC you check entitlement status, then decide in code whether to
fetch an offering and present a paywall. With Superwall you **register a placement at the call
site** (`register(placement: "start_workout") { … }`) and the **campaign** decides whether a
paywall shows, which one, and A/B variant. Move the *decision* out of the app and into the
dashboard. The trailing feature closure runs when the user is entitled (gated) or always
(non-gated) — see §6.

## 2. Two modes

### FULL — Superwall owns billing (default, simplest)
Remove RevenueCat entirely. Superwall's SDK handles purchase, restore, and entitlement
computation from the device's App Store / Play records. No `PurchaseController`.

### PAYWALLS-ONLY — RevenueCat stays source of truth
Keep RevenueCat for purchases/receipts/webhooks; Superwall only shows paywalls. Implement a
`PurchaseController` that forwards buys to RC and mirror RC's `customerInfo` into
`Superwall.subscriptionStatus`. Use when RC's server-side entitlements, integrations, or
cross-platform/web receipts must stay authoritative.

```bash
curl -sL https://superwall.com/docs/ios/guides/using-revenuecat.md      # swap ios → expo / flutter / android
```
Web-checkout variants: `.../guides/web-checkout/using-revenuecat` per framework.

*Observer mode* (analytics-only, RC owns purchases AND paywalls): set
`options.shouldObservePurchases = true` on `SuperwallOptions`. Superwall records revenue but you
CANNOT call `Superwall.shared.purchase(...)`. `curl -sL https://superwall.com/docs/ios/guides/advanced/observer-mode.md`

## 3. Codebase inventory — grep these symbols

**iOS (Swift, `RevenueCat`):**
- Config: `Purchases.configure(withAPIKey:` , `Purchases.logLevel`, `Purchases.shared.delegate`, `PurchasesDelegate`
- Products/offerings: `Purchases.shared.offerings(`, `.getOfferings(`, `offering.availablePackages`, `package.storeProduct`
- Purchase/restore: `Purchases.shared.purchase(package:` , `.purchase(product:`, `.restorePurchases(`
- Entitlement checks (→ future gates): `customerInfo(`, `customerInfoStream`, `.entitlements.active[`, `.entitlements.activeInCurrentEnvironment`, `entitlement.isActive`
- Identity/attributes: `Purchases.shared.logIn(`, `.logOut(`, `.attribution`, `.setAttributes(`, `Purchases.shared.appUserID`
- **Presentation call sites** (RC paywalls / your own): `PaywallView`, `.presentPaywallIfNeeded`, `presentPaywall`, any place an offering is fetched then a sheet shown → each becomes a **placement**.

**React Native / Expo (`react-native-purchases`, `react-native-purchases-ui`):**
`Purchases.configure({apiKey})`, `Purchases.getOfferings()`, `Purchases.getProducts()`,
`Purchases.purchasePackage()`, `Purchases.purchaseStoreProduct()`, `Purchases.purchaseSubscriptionOption()`,
`Purchases.restorePurchases()`, `Purchases.getCustomerInfo()`, `Purchases.addCustomerInfoUpdateListener()`,
`customerInfo.entitlements.active`, `Purchases.logIn()/logOut()`, `RevenueCatUI.presentPaywall()`.

**Flutter (`purchases_flutter`, `purchases_ui_flutter`):**
`Purchases.configure(PurchasesConfiguration(...))`, `Purchases.getOfferings()`, `Purchases.getProducts()`,
`Purchases.purchasePackage()`, `Purchases.purchaseStoreProduct()`, `Purchases.purchase(PurchaseParams...)`,
`Purchases.restorePurchases()`, `Purchases.getCustomerInfo()`, `Purchases.addCustomerInfoUpdateListener()`,
`customerInfo.entitlements.active`, `Purchases.logIn()/logOut()`, `RevenueCatUI.presentPaywall()`.

Produce: list of product ids, entitlement ids, and one row per presentation call site → proposed `snake_case` placement.

## 4. Dashboard-side re-creation (CLI)

For each entitlement and product found:
```
superwall entitlements create pro
superwall products create com.app.pro_monthly --name "Pro Monthly"
superwall products create com.app.pro_yearly  --name "Pro Yearly"
```
Product ids MUST equal the existing App Store / Play SKUs (import via ASC connection instead of
manual create when possible — `superwall secrets set app-store-connect`). Then one campaign with
a placement per call site:
```
superwall campaigns create "Main paywall"
superwall campaigns placement <campaignId> start_workout
superwall campaigns placement <campaignId> unlock_export
```
Verify: `superwall entitlements list --json`, `superwall products list --json`, `superwall campaigns list --json`.

## 5. Code replacement

### FULL mode
- **Configure.** Replace `Purchases.configure(...)` with `Superwall.configure(apiKey: "…")`. No purchase controller.
- **Entitlement checks.** Replace RC reads:
  ```swift
  // Before
  let info = try? await Purchases.shared.customerInfo()
  return info?.entitlements.active["pro"]?.isActive ?? false
  // After
  if Superwall.shared.subscriptionStatus.isActive { /* entitled */ }
  // or, per-entitlement:
  switch Superwall.shared.subscriptionStatus {
  case .active(let entitlements): handler(true)   // entitlements: Set<Entitlement>
  case .inactive:                 handler(false)
  case .unknown:                  handler(false)
  }
  ```
- **Presentation → placement.** Replace "fetch offering + present paywall" with:
  ```swift
  Superwall.shared.register(placement: "start_workout") {
    navigation.startWorkout()   // runs when entitled (gated) — see §6
  }
  ```
  RN: `Superwall.shared.register({ placement: "start_workout" }, () => {...})`.
  Flutter: `Superwall.shared.registerPlacement("start_workout", feature: () {...})`.
- **Remove `PurchaseController`** if one existed:
  ```swift
  // Before: Superwall.configure(apiKey:"…", purchaseController: RCPurchaseController())
  // After:  Superwall.configure(apiKey: "…")
  ```
- **Identity.** `Purchases.shared.logIn(id)` → `Superwall.shared.identify(userId: id)`; `logOut()` → `Superwall.shared.reset()`.
- **Attributes.** `Purchases.shared.setAttributes([...])` → `Superwall.shared.setUserAttributes([...])`. Call `identify` BEFORE `setUserAttributes`; `identify` is idempotent.
- Remove the RevenueCat dependency only after everything builds and is verified.

### PAYWALLS-ONLY mode — iOS `PurchaseController` (verbatim from docs)
```swift
import SuperwallKit
import RevenueCat
import StoreKit

final class RCPurchaseController: PurchaseController {
  func syncSubscriptionStatus() {
    assert(Purchases.isConfigured, "You must configure RevenueCat before calling this method.")
    Task {
      for await customerInfo in Purchases.shared.customerInfoStream {
        let superwallEntitlements = customerInfo.entitlements.activeInCurrentEnvironment.keys.map {
          Entitlement(id: $0)
        }
        await MainActor.run { [superwallEntitlements] in
          Superwall.shared.subscriptionStatus = .active(Set(superwallEntitlements))
        }
      }
    }
  }

  func purchase(product: SuperwallKit.StoreProduct) async -> PurchaseResult {
    do {
      guard let sk2Product = product.sk2Product else { throw PurchasingError.sk2ProductNotFound }
      let storeProduct = RevenueCat.StoreProduct(sk2Product: sk2Product)
      let result = try await Purchases.shared.purchase(product: storeProduct)
      return result.userCancelled ? .cancelled : .purchased
    } catch let error as ErrorCode {
      return error == .paymentPendingError ? .pending : .failed(error)
    } catch { return .failed(error) }
  }

  func restorePurchases() async -> RestorationResult {
    do { _ = try await Purchases.shared.restorePurchases(); return .restored }
    catch { return .failed(error) }
  }
}
```
Wire it:
```swift
let purchaseController = RCPurchaseController()
Superwall.configure(apiKey: "MY_API_KEY", purchaseController: purchaseController)
purchaseController.syncSubscriptionStatus()
```
RN/Flutter: same shape via `addCustomerInfoUpdateListener` → `Superwall.shared.setSubscriptionStatus(SubscriptionStatus.Active(entitlementIds))` / `.Inactive()`; purchase via `Purchases.purchaseStoreProduct` / `Purchases.purchaseSubscriptionOption` (RN) or `Purchases.purchase(PurchaseParams.storeProduct(...))` (Flutter). Newer RN uses `CustomPurchaseControllerProvider` with `onPurchase`/`onPurchaseRestore` callbacks instead of passing a controller to `configure`.

## 6. Feature gating

Set per placement in the paywall editor (**General → Feature Gating**):
- **Non-gated**: feature closure runs on dismiss whether or not they paid.
- **Gated**: feature closure runs only if the user is (or becomes) entitled.
Peek without presenting: `Superwall.shared.getPresentationResult(forPlacement:)`.
`curl -sL https://superwall.com/docs/ios/quickstart/feature-gating.md`

## 7. Order of operations + safety

1. Re-create entitlements, products, campaign + placements in the dashboard (CLI). Import products from ASC/Play so ids match.
2. **Rebuild** paywalls in the editor and attach products (hand-back to user — designs do not import).
3. Add Superwall SDK alongside RC (don't rip RC yet). Configure it.
4. Replace presentation call sites with `register(placement:)`; replace entitlement reads with `subscriptionStatus`.
5. Build, run, present each placement; **Restore Purchases** as an existing subscriber and confirm `subscriptionStatus.isActive`.
6. FULL: remove `PurchaseController` + the RevenueCat dependency. PAYWALLS-ONLY: keep RC + controller.
7. Never delete RC dashboard/webhook config until verified in production.

Existing subscribers keep access without any server-side data move — Superwall reads status from the
device's App Store / Play records after **Restore Purchases**. (A dashboard-driven subscription
migration from RevenueCat is coming soon but not yet available.)

## 8. Pitfalls

- **Double-charge / dueling finishers.** In PAYWALLS-ONLY, only ONE SDK may finish transactions. Let RC own purchasing via the controller; do NOT also call `Superwall.shared.purchase`. In FULL, remove RC's purchase paths entirely so two SDKs don't both react to StoreKit.
- **StoreKit listener conflicts.** Two SDKs observing StoreKit transactions cause duplicate grants/races. Pick one owner.
- **Observer-mode flag.** `shouldObservePurchases = true` disables `Superwall.shared.purchase`. Only set it in observer (analytics-only) mode, never in FULL.
- **Entitlement id mismatch.** Superwall entitlement ids must exactly match the RC entitlement keys you mirror (`pro` ≠ `Pro`).
- **Cache during switchover.** Right after swapping SDKs, status may read `.unknown`/`.inactive` until the first `customerInfoStream`/StoreKit sync — prompt Restore Purchases if a known subscriber looks free.
- **SK1 vs SK2.** The iOS controller expects a SK2 product (`product.sk2Product`); don't force Superwall to StoreKit 1 via `SuperwallOption`, or `purchase(product:)` gets no SK2 product.
- **identify order.** Call `identify` before `setUserAttributes`, or attributes attach to an anonymous user.

## 9. Deeper docs (fetch live)

```bash
curl -sL https://superwall.com/docs/dashboard/guides/migrating-from-revenuecat-to-superwall.md   # migration guide
curl -sL https://superwall.com/docs/ios/guides/using-revenuecat.md                               # + expo/flutter/android
curl -sL https://superwall.com/docs/ios/guides/advanced/observer-mode.md
curl -sL https://superwall.com/docs/ios/quickstart/tracking-subscription-state.md
curl -sL https://superwall.com/docs/support/faq/how-to-migrate-from-another-provider-to-superwall.md
curl -sL https://superwall.com/docs/llms.txt                                                     # index (per-framework: /ios /expo /react-native /flutter llms.txt)
```
- register(): https://superwall.com/docs/ios/sdk-reference/register · identify(): .../identify · setUserAttributes(): .../setUserAttributes

`PurchasingError` enum (referenced by the iOS controller) — define alongside it:
```swift
enum PurchasingError: LocalizedError { case sk2ProductNotFound
  var errorDescription: String? { "Superwall didn't pass a StoreKit 2 product to purchase." } }
```
