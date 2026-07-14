# Superwall CLI

Set up and manage Superwall from your terminal (and your coding agent) — one
binary, keyless, install-free.

```bash
npx superwall            # or: npx superwall integrate
```

Installs two commands: `superwall` and the short alias `sw`.

## The flow

```
detect agent        Claude Code preferred, Codex fallback (silent). None → manual steps.
   ↓
pick app            Monorepo-aware scan. Filters generated ios/ shells + packages/* libs.
   ↓                Multiple apps → you choose; one app → auto.
detect existing     SDK installed? configure() present? existing pk_ key in the repo?
   ↓
account             Existing key → link it. Else: have an account → sign in, or sign up.
   ↓                (Account API is a stubbed seam — wired next.)
agent toolkit       Offer to install the Superwall MCP + skills for your agent.
   ↓
integrate           If not already set up: agent installs SDK + configure() + a placement.
   ↓
next steps          Create a campaign, verify on device.
```

## Commands

Auth (device-flow OAuth against `auth.superwall.com`; one login → everything is authenticated):

| Command | Description |
| --- | --- |
| `superwall login` / `logout` / `whoami` | Log in (mints an `sk_` "Superwall CLI" key), out, and show identity. |

Onboarding (agent-driven):

| Command | Description |
| --- | --- |
| `superwall` | Shows help. |
| `superwall integrate` (alias `wizard`) | Full pipeline: SDK → products → campaigns & placements → paywall → verify. |
| `superwall review [--fix]` | Audit an existing setup end to end; `--fix` applies verified, safe fixes. |
| `superwall migrate` | Migrate from RevenueCat / Adapty / Qonversion. |

Every workflow above also takes `--skill`: instead of the CLI orchestrating an
agent, it prints the full expert playbook — the bundled skill plus the reference
matching *this* project's detected framework/provider — so your own agent can
follow it directly (e.g. `superwall migrate --skill` in a RevenueCat Expo app
prints the migrate skill + the RevenueCat reference).

The dashboard, in your terminal (`--json` on all; auto-scoped by project/app):

| Command | Description |
| --- | --- |
| `superwall apps list` | Apps + their `pk_` keys. |
| `superwall products [list \| create <id> \| storekit]` | Products; generate a local `.storekit`. |
| `superwall entitlements [list \| create <id>]` | Entitlements. |
| `superwall campaigns [list \| create "<desc>" <placement> \| placement <id> <name>]` | Campaigns + placements (create requires an initial placement). |
| `superwall paywalls list` | Paywalls. |
| `superwall asc keys <list \| set \| rm> …` | App Store Connect API key (for auto product import). |

Data & analytics (direct SQL over your organization's ClickHouse data):

| Command | Description |
| --- | --- |
| `superwall query "<sql>" [--json]` | Run an inline query; `--json` returns ClickHouse's native JSON envelope. |
| `superwall query --file <query.sql> [--json]` | Run a saved query. SQL can also be piped on stdin. |

This is the programmable analytics surface for ad hoc analysis, custom dashboards,
scheduled reports (for example, a daily MRR update), and agent workflows. It uses
the logged-in organization and its authenticated session; that credential must
have `data:read` access.

Raw API (Stripe-style, session-authenticated):

| Command | Description |
| --- | --- |
| `superwall bootstrap` | Org → project → app overview of the account. |
| `superwall get \| post \| patch \| delete /v2/… [-d k=v]` | Any Superwall API endpoint (`-d k=v` string, `k:=v` typed, query params on get/delete). |
| `superwall asc <get\|post\|…> /v1/… ` / `asc apps \| products <app>` | The App Store Connect API via Superwall's signed proxy — no `.p8`/JWT needed. |

Toolkit / utility: `superwall skills`, `superwall doctor`.

Global flags: `--json`, `--dry-run`, `--install-dir <dir>`, `--project <id>`, `--app <id>`.

## Testing

```bash
bun test     # node:test via tsx
```

## Skills are the product

Agent-facing expertise is split across two homes by breadth:

- **[`superwall/skills`](https://github.com/superwall/skills)** (public repo,
  source of truth, installed via `npx skills add superwall/skills` /
  `superwall skills`) — the main `superwall` skill (CLI usage + workflow
  router, REST, analytics, docs), `superwall-editor`, `wwdc`.
- **This repo's `skills/`** — the CLI's internal workflow skills, too
  task-specific for the main repo (SKILL.md + `references/`):
  - **`superwall-integrate`** — SDK integration, per-framework references
    (`ios.md`, `expo.md`, `react-native.md`, `flutter.md`).
  - **`superwall-migrate`** — SDK migration off RevenueCat/Adapty/Qonversion,
    per-provider references.
  - **`superwall-review`** — existing-setup audit across SDK configuration,
    purchasing, identity, deep links, Web Checkout, placements, and dashboard state.
  - **`superwall-placements`** — placement strategy, implementation + audit.
  - **`superwall-dashboard`** — campaigns/products/entitlements setup via the CLI.

The CLI consumes the internal skills three ways: its headless runner inlines
SKILL.md + exactly the right reference into the agent prompt (an Expo agent
never sees Swift docs); `<command> --skill` prints the same composition for
external agents; and `superwall skills` installs them (plus the public toolkit)
into the user's agent for keeps.

## How it works

The wizard is a **deterministic harness around your agent**. It assembles a
tightly-scoped prompt (project context + framework-specific instructions +
guardrail "commandments"), then runs your agent in headless mode:

- **Claude Code** → `claude -p … --output-format stream-json --permission-mode acceptEdits`
- **Codex** → `codex exec … --json --sandbox workspace-write --output-last-message`

Both event streams are normalized into a common `AgentEvent` shape so the UI
renders identical live progress regardless of which agent ran.

## Architecture

```
bin.ts                   executable entry (Node ≥20 guard → src/cli)
prompts/                 harness protocol — XML templates with {{var}} slots
  commandments.xml       guardrail system prompt appended to every run
  context.xml            project-context header
  actions/               thin per-task wrappers around the bundled skills
skills/                  internal workflow skills: SKILL.md + references/ per skill
  superwall-integrate/   references/{ios,expo,react-native,flutter}.md
  superwall-migrate/     references/{revenuecat,adapty,qonversion}.md
  superwall-review/      references/{ios,expo,react-native,flutter}.md
  superwall-placements/  references/{strategy,ios,expo,react-native,flutter}.md
  superwall-dashboard/   campaigns/products/entitlements setup via the CLI
src/
  cli.ts                 yargs command surface
  command.ts             defineCommand: shared lifecycle + renderer selection
  constants.ts           hosts, OAuth client, key scopes, Integration enum
  commands/              one file per command (integrate, asc, auth, doctor, …)
  core/
    agent/               drive a coding agent: actions registry, prompt assembly,
                         run, fallback, skill install, drivers (claude / codex)
    api/                 typed Superwall + App Store Connect (proxy) clients
    auth/                device-flow OAuth + session storage
    account/             org / app / key resolution
    project/             what is this local app: scan, existing SDK, billing, frameworks
    dashboard/           cloud-state flows: setup stages, storekit generation
    state/               ~/.superwall persistence (config, reports)
  ui/                    Ink (interactive) + plain (agent) renderers behind one facade
  util/                  clipboard, env, params, fs, assets, api-output
tests/                   mirrors src/ (tests/core/api/client.test.ts, …)
```

## Develop

**Read [AGENTS.md](AGENTS.md) first** — command naming, UI rules, skill
authoring, and the sync checklist are decided conventions, not suggestions.
Skill authoring specifically: `.claude/skills/authoring-skills/SKILL.md`.

```bash
bun install
bun dev           # run from source (bun bin.ts)
bun run build     # tsdown → dist/
bun run typecheck
bun run link:global   # build + link `superwall` and `sw` globally
```

## Roadmap

App Store Connect product automation · React paywall dev loop · campaigns-as-code
· `doctor` cross-system checks (placement ↔ campaign, product ↔ ASC) · OAuth login
+ automatic app creation · hosted MCP + skill bundle · Ink TUI.
