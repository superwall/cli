# Superwall placements — iOS / Swift

> Read `references/strategy.md` first for *where* placements go and *why* (the
> core set, app-type playbook, audit method, gate depth). This file is the iOS API.

## API

```swift
import SuperwallKit

// With gated feature (the common form)
public func register(
  placement: String,
  params: [String: Any]? = nil,
  handler: PaywallPresentationHandler? = nil,
  feature: @escaping () -> Void
)

// Fire-and-forget (no feature to gate)
public func register(
  placement: String,
  params: [String: Any]? = nil,
  handler: PaywallPresentationHandler? = nil
)
```

Called on the shared instance: `Superwall.shared.register(...)`. Synchronous — no
`await`. `params` values are available in campaign audience rules; keys starting
with `$` are reserved and dropped.

### Gated feature

```swift
Superwall.shared.register(placement: "unlock_export") {
  // Runs only when access is granted (see semantics below).
  self.exportDocument()
}
```

### Fire-and-forget (e.g. onboarding end, an upsell surface)

```swift
Superwall.shared.register(placement: "onboarding_complete")
```

### Passing params for audience targeting

```swift
Superwall.shared.register(
  placement: "unlock_export",
  params: ["source": "editor_toolbar", "doc_count": documents.count]
) {
  self.exportDocument()
}
```

## Feature-gating semantics

The `feature` closure is your gate. When it runs depends on the paywall's
**Feature Gating** setting (paywall editor → General → Feature Gating):

| Situation | Does `feature` run? |
|---|---|
| No campaign matches the placement | Yes, immediately (no network, no paywall) |
| User already subscribed / entitled | Yes, immediately, no paywall |
| Holdout group or no audience match | Yes, immediately (runs per current subscription state) |
| Paywall shown, **Non-Gated**, dismissed | Yes — access granted whether or not they paid |
| Paywall shown, **Gated**, dismissed without purchase | No — feature blocked |
| Paywall shown, user purchases | Yes, after the transaction completes |

So: **Gated** = paid-only feature; **Non-Gated** = show the paywall but let them
through either way (soft paywall / upsell). This is toggled in the dashboard, not
in code — the same `register` call works for both.

## Presentation handler (optional lifecycle observation)

```swift
let handler = PaywallPresentationHandler()
handler.onPresent { paywallInfo in print("presented", paywallInfo.name) }
handler.onDismiss { paywallInfo, result in print("dismissed", result) }
handler.onError { error in print("error", error) }
handler.onSkip { reason in
  switch reason {
  case .holdout(let experiment): print("holdout", experiment.id)
  case .noAudienceMatch: print("no audience match")
  case .placementNotFound: print("placement not on a campaign")
  }
}

Superwall.shared.register(placement: "unlock_export", handler: handler) {
  self.exportDocument()
}
```

Use the handler for analytics/UI reactions only. Do **not** move the gated work
into `onDismiss` — the `feature` closure already handles gating correctly.

## Where to place — one realistic gate

SwiftUI button action:

```swift
Button("Export as PDF") {
  Superwall.shared.register(placement: "unlock_export") {
    exporter.exportPDF(document)
  }
}
```

Limit-reached gate:

```swift
func addProject() {
  guard projects.count >= freeLimit else { return createProject() }
  Superwall.shared.register(placement: "project_limit_reached") {
    createProject()
  }
}
```

## Audit checklist

- Find every call: `grep -rn "register(placement:" Sources/ App/` (also older
  `Superwall.shared.track` if migrating).
- Each placement sits at a real premium boundary; the paywalled work is **inside**
  the `feature` closure, not after the call.
- No manual `if Superwall.shared.subscriptionStatus == .active { … } else { register }`
  wrapper — that fights remote config. Register unconditionally; let gating decide.
- Names are `snake_case`, stable, non-duplicated, and match dashboard campaigns.
- Cross-check code vs dashboard with `superwall campaigns list --json`: every
  registered placement is on a campaign; flag campaign placements never registered
  in code and code placements on no campaign.
- Obvious premium entry points (upgrade buttons, gated exports, quota limits,
  onboarding end) that have **no** placement.

## Dashboard routing

A placement is inert without a campaign:

```bash
superwall campaigns list --json
superwall campaigns create "Editor upgrade paywall"
superwall campaigns placement <campaignId> unlock_export
```

## Pitfalls

- **Registering inside `body`/render.** Never call `register` from within a
  SwiftUI `body` computed property — it re-fires on every re-render. Register from
  a button action or `.onAppear`/`.task`.
- **Registering before `configure`.** Calls before `Superwall.configure(apiKey:)`
  (typically in `App.init` / `AppDelegate`) are dropped. Configure first.
- **Gating twice.** Wrapping `register` in your own entitlement check double-gates
  and defeats Non-Gated experiments.
- **Waiting on the closure to fire.** The `feature` closure may run async (after a
  purchase). Don't assume it runs synchronously before the next line.

## Deeper docs

- Index: https://superwall.com/docs/ios/llms.txt
- register: https://superwall.com/docs/ios/sdk-reference/register
- Feature gating: https://superwall.com/docs/ios/quickstart/feature-gating
- Presentation handler: https://superwall.com/docs/ios/guides/advanced/using-the-presentation-handler
- Deep links: https://superwall.com/docs/ios/guides/handling-deep-links
