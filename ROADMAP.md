# Superwall CLI — Roadmap

## Vision
One binary. Install it (or `npx @superwall/cli`), log in once, and never open the
dashboard or do monetization work by hand again. It is **both** the human CLI and
the agent's tool.

## Architecture decision: CLI = actions, skills = knowledge
- The **`superwall` CLI owns every _action_** — typed, authenticated via the login
  session (`sk_`), human UI by default, `--json` for agents/CI. Runnable installed
  or via `npx @superwall/cli` (so even skill-only users get it with no install).
- **`superwall/skills` owns _knowledge_** — migration playbooks, placement
  positioning, paywall design best-practices — and tells agents to call the CLI.
- **Retire the skill's `sw-api.sh`.** The CLI is the single API surface. No more
  duplicate REST wrapper, no more `SUPERWALL_API_KEY` juggling — one auth, one tool.
- The CLI **installs** the skills for the user's agent (`superwall skills`), so an
  agent gets both the actions (CLI) and the playbooks (skills).

## Command surface (the "do anything")
Done: `login/logout/whoami`, `` (pipeline), `integrate`, `placements review|implement`,
`dashboard`, `skills`, `scan`, `doctor`.

Planned:
- **apps**: `list`, `create`
- **products**: `list`, `create`, `import`, `pull` (App Store Connect), `sync`, `storekit`
- **campaigns**: `list`, `create`, `attach <placement> <paywall>`
- **placements**: `list` (code ↔ dashboard reconciliation), `review`, `implement`
- **paywalls**: `list`, `dev`, `new`, `push` (React editor as code)
- **entitlements**: `list`, `create`, `grant`, `revoke`
- **secrets**: `set` / `list` / `rm` (ASC `.p8`, webhook secrets, integration keys)
- **analytics**: `query` (ClickHouse-backed stats)
- **migrate**: detect provider → install skill → plan → hand to agent → verify
- **init / push / pull / plan**: local-first Monetization-as-Code (`superwall/` dir)

## Phases
1. **API substrate + keyless** — typed REST client over the session, `--json`
   everywhere, `pk_` auto-discovery (log in → pipeline just knows your app + key),
   read commands (`apps`/`products`/`campaigns`/`paywalls`/`entitlements list`).
2. **Writes = dashboard-in-terminal** — create campaigns/placements/entitlements,
   attach placements → paywalls. Makes the pipeline's Campaigns stage real.
3. **Products + ASC + secrets (the moat)** — `secrets set app-store-connect`,
   `products pull` via the `app_store_connect:proxy` scope, StoreKit `.storekit`
   generation, `products sync`. Makes the Products stage real.
4. **`superwall migrate`** — detect RC/Adapty/Qonversion, install the right
   migration skill from our repo, analyze current setup, produce a mapping plan
   (products, entitlements, paywall triggers), execute with the agent, verify.
5. **Local-first (Monetization-as-Code)** — `superwall/` dir as source of truth;
   `push`/`pull`/`plan` reconcile to the cloud (Terraform-for-monetization).
6. **Paywall dev loop** — `paywall dev/new/push` (pull the React paywall, run a
   local preview, push live).

## Principles
- Every command: human UI by default, `--json` for agents, authenticated by the
  session (zero config after `login`).
- Idempotent + `--dry-run`/`plan` before anything irreversible (ASC especially).
- Cross-system checks (`doctor`): placement-in-code ↔ campaign, product ↔ ASC.
- The dashboard becomes a _view_; the CLI (and the local files) are the source.
