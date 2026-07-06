# Superwall wizard

Set up Superwall in your app in one command — driven by the coding agent you
already have installed.

```bash
npx @superwall/wizard
```

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
| `superwall` | Full pipeline: integrate → placements → products → campaigns → verify. |
| `superwall integrate` | Install + configure the SDK, add a placement. |
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

Local-first (Monetization-as-Code — `superwall.json` ↔ cloud):

| Command | Description |
| --- | --- |
| `superwall pull` / `plan` / `push` | Reconcile entitlements + products between file and cloud. |

Toolkit / utility: `superwall skills`, `superwall doctor`, `superwall scan [--json]`.

Global flags: `--json`, `--dry-run`, `--install-dir <dir>`, `--project <id>`, `--app <id>`.

## Testing

```bash
pnpm test    # tsx --test (Node's built-in runner, zero extra install)
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
src/
  cli.ts                 yargs command surface
  constants.ts           branding + Integration enum
  commands/              integrate (default), mcp, doctor
  core/
    drivers/             agent abstraction: claude, codex, detection, spawn
    detection/           framework detection + scoring
    frameworks/          per-platform detect() + prompt snippets
    agent/               commandments, prompt assembly, run, fallback
  ui/                    branded clack/log helpers
```

## Develop

```bash
pnpm install
pnpm dev          # tsx bin.ts — run from source
pnpm build        # tsdown → dist/
pnpm typecheck
```

## Roadmap

App Store Connect product automation · React paywall dev loop · campaigns-as-code
· `doctor` cross-system checks (placement ↔ campaign, product ↔ ASC) · OAuth login
+ automatic app creation · hosted MCP + skill bundle · Ink TUI.
