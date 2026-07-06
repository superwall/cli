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
| `superwall placements review \| implement` | Audit / add `register()` calls at the right gates. |
| `superwall dashboard` | Create a campaign + placement so paywalls present. |
| `superwall migrate` | Migrate from RevenueCat / Adapty / Qonversion. |

The dashboard, in your terminal (`--json` on all; auto-scoped by project/app):

| Command | Description |
| --- | --- |
| `superwall apps list` | Apps + their `pk_` keys. |
| `superwall products [list \| create <id> \| storekit]` | Products; generate a local `.storekit`. |
| `superwall entitlements [list \| create <id>]` | Entitlements. |
| `superwall campaigns [list \| create <desc> \| placement <id> <name>]` | Campaigns + placements. |
| `superwall paywalls list` | Paywalls. |
| `superwall secrets <set \| list \| rm> app-store-connect …` | App Store Connect API key (for auto product import). |
| `superwall asc <get\|post\|…> /v1/… ` / `asc apps \| products <app>` | The App Store Connect API via Superwall's signed proxy — no `.p8`/JWT needed. |

Local-first (Monetization-as-Code — `superwall.json` ↔ cloud):

| Command | Description |
| --- | --- |
| `superwall pull` / `plan` / `push` | Reconcile entitlements + products between file and cloud. |

Toolkit / utility: `superwall skills`, `superwall doctor`, `superwall scan [--json]`.

Global flags: `--json`, `--dry-run`, `--install-dir <dir>`, `--project <id>`, `--app <id>`.

## Testing

```bash
bun test     # node:test via tsx
```

## Two kinds of skills

- **Internal actions** — bundled *inside* the CLI (`src/core/actions/`). They are
  the wizard's own flow instructions (integrate, review/implement placements,
  dashboard setup), inlined into the agent prompt at run time. Never remote.
- **Public skills** — [`superwall/skills`](https://github.com/superwall/skills),
  installable by anyone via `npx skills add superwall/skills`. `superwall skills`
  installs them globally (canonical `~/.agents/skills` + per-agent symlinks) so
  your own agent keeps the Superwall toolkit after the wizard exits.

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
src/
  cli.ts                 yargs command surface
  command.ts             defineCommand: shared lifecycle + renderer selection
  constants.ts           branding + Integration enum
  commands/              one file per command (integrate, asc, auth, doctor, …)
  core/
    api/                 typed Superwall + App Store Connect (proxy) clients
    actions/             bundled agent actions (integrate, placements, migrate)
    agent/               commandments, prompt assembly, run, fallback
    auth/                device-flow OAuth + session storage
    detection/           monorepo-aware app + framework detection
    drivers/             agent abstraction: claude, codex, spawn
    frameworks/          per-platform detect() + prompt snippets
    pipeline/            dashboard stages (products, paywall, verify)
    skills/              bundled-skill install + loading
  ui/                    Ink (interactive) + plain (agent) renderers behind one facade
  util/                  clipboard, env, params, api-output
skills/                  bundled agent skills (integrate / migrate / placements)
```

## Develop

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
