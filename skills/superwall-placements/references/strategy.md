# Superwall placement strategy — the playbook

This is the framework-agnostic strategy guide: **where** to put placements and
**why**. Read this first, then read your framework's reference (`ios.md`,
`expo.md`, `react-native.md`, `flutter.md`) for the exact API. The API is the
easy part. Deciding what to instrument, and refusing to gate in code, is the
craft that makes an app's monetization flexible.

Most of section 1 (register everything, gate remotely) is stated in the Superwall
docs. Sections 2–4 and 6 are **recommended practice** — craft distilled from how
well-instrumented apps are built, not verbatim doc rules. They're written as
imperatives because they're what you should do, not because a doc mandates them.

## 1. The mental model

**Register every potentially-monetizable moment. The campaign decides what
happens.** A placement is a named event you fire at a boundary; whether it shows a
paywall, gates a feature, enters a holdout, or does nothing is decided remotely in
the dashboard — evaluated on-device, no network delay. The docs are explicit:
*"we strongly recommend registering all core functionality in order to remotely
configure which features you want to gate — without an app update."* And more
broadly: *"Register. Everything."* — even analytics events with no feature block,
so you can retroactively attach a paywall almost anywhere.

Why this matters:

- **Placements are free experimentation surface.** An unassigned placement does
  nothing until you route it in a campaign. Registering it costs ~nothing at
  runtime. So instrument generously now; decide monetization later, remotely.
- **Everything you don't register is frozen.** To monetize a moment you never
  instrumented, you must ship an app update and wait for adoption. Every
  un-registered premium moment is a monetization lever you can't pull.
- **The dashboard is where decisions live and change.** Show/hide a paywall,
  gate/un-gate a feature, target an audience, pause for a free weekend, run an
  A/B test — all without a release. That only works if the placement already
  exists in the binary.

### The one rule you must not break: never gate by checking subscription status in code

When a placement *should* decide access, do **not** wrap it in a hand-rolled
`if subscribed { … } else { showPaywall() }`. This is the single most common and
most damaging mistake.

```
// WRONG — freezes your monetization logic into this app release
if (user.hasActiveSubscription) {
  startWorkout();
} else {
  presentPaywall();
}

// RIGHT — the campaign decides; subscribed users are filtered automatically
register(placement: "start_workout") {
  startWorkout();
}
```

Why the code-side check is a trap:

- **Subscribed/entitled users are filtered automatically.** When you register a
  placement, Superwall evaluates subscription state itself: an entitled user's
  `feature` closure runs immediately with no paywall. You do not need — and must
  not add — your own check for this.
- **A code check hard-codes the decision.** "Gated vs non-gated," "who sees it,"
  "show it at all" become properties of a shipped binary instead of dashboard
  settings. You lose remote configuration, A/B testing, holdouts, and the free
  weekend — the entire reason to use Superwall.
- **It double-gates.** Your `if` plus the paywall's own gating means even a
  Non-Gated experiment can't let users through. It silently breaks experiments.

**The one legitimate reason to read subscription state in code is UI, never
gating.** To show a lock icon or a "PRO" badge without presenting a paywall, use
`getPresentationResult(forPlacement:)` (all SDKs) — it tells you what *would*
happen (`.paywall`, `.holdout`, `.noAudienceMatch`, `.placementNotFound`) so the
UI can adapt. The access decision still flows through `register`.

## 2. The core set every app should register

Start here regardless of app type. Each is a distinct user *moment*, named for the
moment, not the button.

| Placement | Fires when | Why it's core |
|---|---|---|
| `onboarding_complete` | User finishes onboarding | Highest-intent moment in most apps — they've invested setup effort and seen the value prop. The single most important paywall slot; often the top revenue driver. |
| one per premium feature gate | User taps a paid feature (`unlock_export`, `start_workout`, `remove_watermark`) | The direct "I want this paid thing" signal. `verb_noun`. One per distinct feature, not one per button that reaches it. |
| a limit/quota-reached moment | Free allowance exhausted (`hit_export_limit`, `scan_limit_reached`) | Catches users at peak demonstrated need. Distinct from the feature gate — the user already used it free and wants more. |
| `upgrade_tapped` | User taps an explicit "Go Pro" / upgrade entry in settings or a banner | Self-selected high intent. Route to your fullest paywall. |
| `app_launch` / `session_start` | Cold launch / new session (both are auto-registered standard placements) | Broad-reach surface for win-back or a hard gate on relaunch. Usually left **campaign-off** until you deliberately want it — powerful but blunt. |
| a win-back / discount surface | User declines, churns, or hits a re-engagement point | Where you route a discounted offer. Often driven by standard placements like `paywall_decline` or `transaction_abandon`. |

Note the last two: register them so the lever exists, but leave them unrouted
(no campaign, or campaign paused) until you have a reason to fire them. That's the
whole point — the instrumentation is cheap; the decision is remote.

Superwall also **auto-registers** standard placements you can route without any
code: `app_install`, `app_launch`, `session_start`, `deepLink_open`,
`survey_response`, `paywall_decline`, `transaction_abandon`, and more. Prefer
these for lifecycle moments instead of inventing your own.

## 3. App-type playbook

Map the app to its type, then instrument that type's premium surface. Names below
are examples — keep your app's real feature vocabulary.

| App type | The paid surface | Placements (moment that fires them) |
|---|---|---|
| Photo/video editor | Export, save, watermark removal, premium filters/tools | `unlock_export` (tap export/save), `remove_watermark` (tap watermark toggle), `unlock_premium_filter` (select locked filter), `hit_export_limit` (free export quota hit) |
| Fitness | Workout start, plan unlock, history/stats | `start_workout` (tap a locked workout), `unlock_plan` (choose a premium plan), `view_workout_history` (open stats/history), `onboarding_complete` |
| Productivity/utility | Nth document/scan/task, advanced features, cross-device sync | `hit_document_limit` (create Nth doc), `unlock_advanced_feature` (tap a pro tool), `enable_sync` (toggle cross-device sync), `scan_limit_reached` |
| Content/media | Premium article/episode, offline download | `unlock_premium_content` (tap a locked article/episode), `download_offline` (tap download), `session_start` (metered-paywall relaunch) |
| Dating/social | Likes limit, see-who-liked, boosts | `likes_limit_reached` (out of free likes), `see_who_liked` (tap the blurred list), `unlock_boost` (tap boost), `unlock_super_like` |
| AI apps | Generation quota, premium models | `generation_limit_reached` (free generations used up), `unlock_premium_model` (select a locked model), `unlock_faster_generation`, `onboarding_complete` |

For each: pick the 3–6 moments that actually correspond to money, name them for
the moment, and register at the point of intent (the tap/attempt), not on a
timer or a screen you happen to have.

## 4. The audit method (for reviews)

When reviewing an existing app's placements, work in this order. Don't start from
the placements that exist — start from the money.

1. **Enumerate the premium surface first.** List what is actually paid or
   intended to be paid: every gated feature, every quota, every "Pro" affordance,
   the upgrade entries, the end of onboarding. This is the ground truth to
   measure against — build it before looking at code.
2. **Map each paid surface → placement.** For every item in step 1, find the
   `register`/`registerPlacement` call that covers it (use the grep in your
   framework reference).
3. **Then flag the four failure modes:**
   - **Surface with no placement** → missed revenue. A paid feature you can never
     attach a paywall to without an app update. The highest-value finding.
   - **Placement with no campaign** → dead instrumentation. Cross-check every
     registered name against `superwall campaigns list --json`. A placement not on
     any campaign fires nothing — either route it or it's noise.
   - **Code-side entitlement check that should be a placement** → grep for
     subscription/entitlement reads at call sites (`subscriptionStatus`,
     `hasActiveSubscription`, `getEntitlements`, `CustomerInfo`, `isPro`). Any that
     gate a feature by branching in code should be a `register` with the work in
     `feature` instead. (Reads that only drive a lock icon via
     `getPresentationResult` are fine.)
   - **Naming drift / typos** → `Start_Workout` vs `start_workout`, `unlockExport`
     vs `unlock_export`, singular/plural drift. A typo means the campaign silently
     never matches. Also flag campaign placements that nothing in code registers.

Report findings as: surface → expected placement → status (present / missing /
dead / code-gated / misnamed).

## 5. Gate depth: hard gate vs soft gate

Every placement is either a **hard gate** or a **soft/non-gated** surface. This is
set per-paywall in the dashboard (editor → General → Feature Gating), *not* in
code — the same `register` call serves both. But you decide the *intent* when you
place it, so know which you mean.

- **Hard gate (paid-only feature).** The work lives inside the `feature` closure,
  and the paywall is set to **Gated**. Per the docs, a Gated paywall runs the
  `feature` closure *"only if the user is already paying or if they begin
  paying."* Dismiss without buying → feature blocked. Use for genuinely
  paid-only capability: the export, the premium generation, the unlimited scan.

- **Soft gate (show paywall, let them through).** Same code, paywall set to
  **Non-Gated**: the `feature` closure runs *"when the paywall is dismissed
  (whether they paid or not)."* Use for upsell moments where you want to surface
  the offer but not block the user — a nudge at `session_start`, a value reminder
  after `onboarding_complete`.

In both cases, when no campaign matches or the user is already entitled, the
feature runs immediately with no paywall and no network call. The important
consequence: **put the paywalled work in the `feature` closure either way.** That
keeps the gated/non-gated choice remote. If you run the work *after* the register
call unconditionally, you've made it non-gated in code and can never harden it.

## 6. How many placements?

A well-instrumented app typically runs roughly **5–15 placements**. That's a
guideline for calibration, not a limit.

- **Too few (1–3)** → no experimentation surface. You can only monetize the two or
  three moments you thought of at build time; everything else needs a release.
- **Placement-per-button spam (30+)** → noise. Ten placements that all mean "user
  tapped something in the editor" dilute your data and make campaigns unreadable.

**Quality bar: each placement is a DISTINCT user intent.** If two placements would
always be routed to the same paywall for the same reason, they're one placement.
If a single placement fires from three unrelated moments, it's probably three. Use
`params` to distinguish *variants* of one intent (`{ source: "toolbar" }` vs
`{ source: "menu" }`) rather than minting a new placement per source.

## 7. Naming rules

- **`snake_case`, and pick one convention for the whole app.** The house style for
  this skill is `snake_case` (`unlock_export`, `onboarding_complete`). Superwall's
  own docs examples use mixed casing (`StartWorkout`, `caffeineLogged`) — the SDK
  doesn't enforce a style, so the real rule is *one consistent convention*, and we
  standardize on `snake_case`.
- **Name the user moment, not the UI widget.** `unlock_export`, not
  `export_button_tapped`; `hit_export_limit`, not `alert_shown`. The widget can
  change; the intent is stable.
- **`verb_noun` for feature gates.** `start_workout`, `unlock_export`,
  `remove_watermark`, `download_offline`. It reads as what the user is trying to
  do.
- **Stable forever.** A placement name is a routing key shared with the dashboard
  campaign. Renaming it silently breaks routing — the campaign keeps looking for
  the old name and the new one fires nothing. Treat renames as breaking changes:
  add the new campaign mapping before shipping the rename, or don't rename.
- **Reuse, never duplicate.** Before adding a name, check existing placements
  (`superwall campaigns list --json`) and existing `register` calls. Two names for
  one intent split your data and double your campaign work.

## Dashboard routing (placements are inert without a campaign)

A registered placement does nothing until a campaign routes it. Campaigns hold
one or more placements and use audience filters to decide what each user sees.

```bash
superwall campaigns list --json                                  # existing campaigns + placements
superwall campaigns create "Editor upgrade paywall"              # create one if needed
superwall campaigns placement <campaignId> unlock_export         # route a placement
```

Rule of thumb: one campaign per distinct paywall surface/decision (onboarding,
settings upgrade, win-back), routing the placements that belong to it — not one
campaign per trigger, and no duplicates. Placements can also be added "on the fly":
registering a name that doesn't exist yet auto-creates it on the campaign.
