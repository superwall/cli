# Superwall placements — React Native

> Read `references/strategy.md` first for *where* placements go and *why* (the core
> set, app-type playbook, audit method, gate depth). This file is the RN API.

The RN SDK (`@superwall/react-native-superwall`) registers placements via a single
options-object `register` call on the shared instance. (This is distinct from Expo,
which uses the `usePlacement` hook — see `references/expo.md` if the app uses
`expo-superwall`.)

## API

```ts
import Superwall from "@superwall/react-native-superwall";
import { PaywallPresentationHandler } from "@superwall/react-native-superwall";

async register(options: {
  placement: string
  params?: Record<string, any> | Map<string, any>
  handler?: PaywallPresentationHandler
  feature?: () => void
}): Promise<void>
```

Called as `Superwall.shared.register({ ... })`. Async — `await` it. `params` values
are available in campaign audience rules; keys starting with `$` are reserved and
dropped. The `feature` callback is your gate; gating configuration lives in the
dashboard.

### Gated feature

```ts
await Superwall.shared.register({
  placement: "unlock_export",
  params: { source: "editor_toolbar" },
  feature: () => exportDocument(),   // runs only when access is granted
});
```

### Fire-and-forget

```ts
await Superwall.shared.register({ placement: "onboarding_complete" });
```

### With a presentation handler (lifecycle observation)

```ts
const handler = new PaywallPresentationHandler();
handler.onPresent((info) => console.log("presented", info.name));
handler.onDismiss((info, result) => console.log("dismissed", result));
handler.onError((error) => console.log("error", error));

await Superwall.shared.register({
  placement: "unlock_export",
  handler,
  feature: () => exportDocument(),
});
```

Keep gated work in `feature`; use the handler for analytics/UI only.

## Feature-gating semantics

When the `feature` callback runs (per the paywall's Feature Gating setting in the
dashboard):

| Situation | Does `feature` run? |
|---|---|
| No campaign matches | Yes, immediately (no network, no paywall) |
| User already subscribed | Yes, immediately, no paywall |
| Holdout / no audience match | Yes, immediately (per current subscription state) |
| Paywall shown, **Non-Gated**, dismissed | Yes — whether or not they paid |
| Paywall shown, **Gated**, dismissed without purchase | No — feature blocked |
| User purchases | Yes, after the transaction |

**Gated** = paid-only; **Non-Gated** = show paywall, let them through either way.
Same `register` call for both; the dashboard decides.

## Where to place — one realistic gate

`onPress` on a `Pressable`, limit-reached:

```tsx
function AddProjectButton({ count, freeLimit }: { count: number; freeLimit: number }) {
  const onPress = async () => {
    if (count < freeLimit) return createProject();
    await Superwall.shared.register({
      placement: "project_limit_reached",
      feature: createProject,
    });
  };
  return (
    <Pressable onPress={onPress}>
      <Text>New project</Text>
    </Pressable>
  );
}
```

## Audit checklist

- Find every call: `grep -rn "\.register(" src/ app/` and `Superwall.shared`.
- Paywalled work is passed as `feature`, not run unconditionally after the `await`.
- No manual subscription-status `if` wrapping the register call — register always,
  let gating decide (avoid reaching into `subscriptionStatus` at the call site).
- Names are `snake_case`, stable, non-duplicated, and match dashboard campaigns.
- Cross-check with `superwall campaigns list --json`: every registered placement is
  on a campaign; flag campaign placements never registered and vice versa.
- Obvious premium boundaries (upgrade buttons, gated actions, quota limits,
  onboarding end) with no placement.

## Dashboard routing

```bash
superwall campaigns list --json
superwall campaigns create "Editor upgrade paywall"
superwall campaigns placement <campaignId> unlock_export
```

## Pitfalls

- **Registering during render.** Call `register` from an event handler or effect,
  never in the component body — it would fire on every render.
- **Missing `await`.** `register` returns a Promise; without `await` errors go
  unhandled and you can't sequence follow-up work. Use `await` in a try/catch or
  attach the presentation handler.
- **Registering before `configure`.** Ensure `Superwall.configure(apiKey)` has run
  (typically at app startup) before any `register`; earlier calls are dropped.
- **Gating twice.** Don't combine a manual entitlement check with `feature` — it
  double-gates and defeats Non-Gated experiments.

## Deeper docs

- Index: https://superwall.com/docs/react-native/llms.txt
- register: https://superwall.com/docs/react-native/sdk-reference/register
- PaywallPresentationHandler: https://superwall.com/docs/react-native/sdk-reference/PaywallPresentationHandler
- subscriptionStatus: https://superwall.com/docs/react-native/sdk-reference/subscriptionStatus
- Deep links: https://superwall.com/docs/react-native/sdk-reference/handleDeepLink

Note: the RN docs index does not expose a standalone feature-gating page; the
semantics above are confirmed on the `register` reference. Confirm exact wording at
the register URL above if a detail is load-bearing.
