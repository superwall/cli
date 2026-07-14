# Superwall CLI

The official CLI for managing Superwall from your terminal or coding agent.

## Install

```bash
npm install --global superwall
superwall login
```

You can also run it without installing:

```bash
npx superwall
```

The package provides `superwall` and the short `sw` command.

## What it does

`superwall integrate` detects the local app and framework, reuses an existing
Superwall configuration when possible, and connects the app to the selected
Superwall account. A coding agent installs and configures the SDK. The CLI then
installs the Superwall agent skills and guides product, campaign, placement,
paywall, and device verification setup.

## Commands

Authentication uses device-flow OAuth against `auth.superwall.com`. One login
authenticates every command. The session is user-scoped; multi-org accounts pick
an organization the first time an org-scoped command needs one (or with
`superwall orgs use`).

| Command                                          | Description                                           |
| ------------------------------------------------ | ----------------------------------------------------- |
| `superwall login` / `logout` / `whoami [--json]` | Log in, out, and show identity; automation uses JSON. |

Onboarding (agent-driven):

| Command                    | Description                                                                     |
| -------------------------- | ------------------------------------------------------------------------------- |
| `superwall`                | Shows help.                                                                     |
| `superwall integrate`      | Configure the SDK, products, campaigns, placements, paywalls, and verification. |
| `superwall review [--fix]` | Audit an existing setup end to end; `--fix` applies verified, safe fixes.       |
| `superwall migrate`        | Migrate from RevenueCat / Adapty / Qonversion.                                  |

Every workflow above also takes `--skill`: instead of the CLI orchestrating an
agent, it prints the full expert playbook - the bundled skill plus the reference
matching _this_ project's detected framework/provider - so your own agent can
follow it directly (e.g. `superwall migrate --skill` in a RevenueCat Expo app
prints the migrate skill + the RevenueCat reference).

The dashboard, in your terminal (`--json` on all; pass `--project`/`--app` when more than one exists):

| Command                                                                              | Description                                                    |
| ------------------------------------------------------------------------------------ | -------------------------------------------------------------- |
| `superwall orgs [list \| use <id\|name>]`                                            | Organizations; `use` picks the org for org-scoped commands.    |
| `superwall apps list`                                                                | Apps + their `pk_` keys.                                       |
| `superwall products [list \| create <id> \| storekit]`                               | Products; generate a local `.storekit`.                        |
| `superwall entitlements [list \| create <id>]`                                       | Entitlements.                                                  |
| `superwall campaigns [list \| create "<desc>" <placement> \| placement <id> <name>]` | Campaigns + placements (create requires an initial placement). |
| `superwall paywalls list`                                                            | Paywalls.                                                      |
| `superwall asc keys <list \| set \| rm> ...`                                         | App Store Connect API key (for auto product import).           |

Data & analytics (direct SQL over your organization's ClickHouse data):

| Command                                       | Description                                                              |
| --------------------------------------------- | ------------------------------------------------------------------------ |
| `superwall query "<sql>" [--json]`            | Run an inline query; `--json` returns ClickHouse's native JSON envelope. |
| `superwall query --file <query.sql> [--json]` | Run a saved query. SQL can also be piped on stdin.                       |

This is the programmable analytics surface for ad hoc analysis, custom dashboards,
scheduled reports (for example, a daily MRR update), and agent workflows. It uses
the logged-in organization and its authenticated session; that credential must
have `data:read` access.

Raw API (Stripe-style, session-authenticated):

| Command                                                                  | Description                                                                                |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| `superwall bootstrap`                                                    | Organization, project, and app overview of the account.                                    |
| `superwall get \| post \| patch \| delete /v2/... [-d k=v]`              | Any Superwall API endpoint (`-d k=v` string, `k:=v` typed, query params on get/delete).    |
| `superwall asc <get\|post\|...> /v1/... ` / `asc apps \| products <app>` | The App Store Connect API through Superwall's signed proxy. No `.p8` file or JWT required. |

Toolkit / utility: `superwall skills`, `superwall doctor`.

Agents should use `--json`: it is the stable, two-space-indented machine contract,
never prompts, and returns structured errors. `--no-interactive` disables prompts
while retaining normal human-readable output.

Common flags: `--json`, `--no-interactive`, `--dry-run`,
`--install-dir <dir>`, `--project <id>`, `--app <id>`.

## Testing

```bash
bun test     # node:test via tsx
```

## Skills are the product

Agent-facing expertise is split across two homes by breadth:

- **[`superwall/skills`](https://github.com/superwall/skills)** (public repo,
  source of truth, installed via `npx -y skills@latest add superwall/skills` /
  `superwall skills`) - the main `superwall` skill (CLI usage + workflow
  router, REST, analytics, and docs) and `superwall-editor`.
- **This repo's `skills/`** - the CLI's internal workflow skills, too
  task-specific for the main repo (SKILL.md + `references/`):
  - **`superwall-integrate`** - SDK integration, per-framework references
    (`ios.md`, `expo.md`, `react-native.md`, `flutter.md`).
  - **`superwall-migrate`** - SDK migration off RevenueCat/Adapty/Qonversion,
    per-provider references.
  - **`superwall-review`** - existing-setup audit across SDK configuration,
    purchasing, identity, deep links, Web Checkout, placements, and dashboard state.
  - **`superwall-placements`** - placement strategy, implementation + audit.
  - **`superwall-dashboard`** - campaigns/products/entitlements setup via the CLI.

The CLI consumes the internal skills three ways: its headless runner inlines
SKILL.md + exactly the right reference into the agent prompt (an Expo agent
never sees Swift docs); `<command> --skill` prints the same composition for
external agents; and `superwall skills` installs them (plus the public toolkit)
into the user's agent for keeps.

## How it works

The CLI is a **deterministic harness around your agent**. It assembles a
tightly-scoped prompt (project context + framework-specific instructions +
guardrail "commandments"), then runs your agent in headless mode:

- **Claude Code:** plan mode for read-only actions; edit mode only for writable actions.
- **Codex:** read-only/workspace-write sandbox and network access derived independently per action.

Both event streams are normalized into a common `AgentEvent` shape so the UI
renders identical live progress regardless of which agent ran.

## Architecture

```
bin.ts                   executable entry with Node 20 version guard
prompts/                 harness protocol - XML templates with {{var}} slots
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
  command.ts             command policy: auth, interaction, output, lifecycle, errors
  output.ts              reusable output blocks + the single JSON serializer
  constants.ts           hosts, OAuth client, key scopes, Integration enum
  commands/              thin command dispatchers (asc, auth, doctor, query, ...)
    integrate/           app selection, agent execution, campaign orchestration
    resource/            scope, list, create, and special resource actions
  core/
    agent/               drive a coding agent: actions registry, prompt assembly,
                         run, fallback, skill install, drivers (claude / codex)
    api/                 typed Superwall + App Store Connect (proxy) clients
    auth/                device-flow OAuth + session storage
    account/             org / app / key resolution
    project/             what is this local app: scan, existing SDK, billing, frameworks
    dashboard/           cloud-state flows: setup stages, storekit generation
    state/               ~/.superwall persistence (config, reports)
  ui/                    Ink (interactive) + minimal text renderers behind one facade
  util/                  clipboard, env, params, fs, JSON, assets, API output
tests/                   mirrors src/ (tests/core/api/client.test.ts, ...)
```

## Develop

**Read [AGENTS.md](AGENTS.md) first** - command naming, UI rules, skill
authoring, and the sync checklist are decided conventions, not suggestions.
Skill authoring specifically: `.claude/skills/authoring-skills/SKILL.md`.

```bash
bun install
bun dev           # run from source (bun bin.ts)
bun run build     # build dist/ with tsdown
bun run typecheck
bun run link:global   # build + link `superwall` and `sw` globally
```
