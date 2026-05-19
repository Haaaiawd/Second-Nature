<h1 align="center">Second Nature</h1>

<p align="center">
  <strong>Let an OpenClaw agent live with rhythm across platforms, memory, and user contact.</strong>
</p>

<p align="center">
  Second Nature gives an OpenClaw agent a rhythm for action, Quiet memory curation, continuity across platforms, and operator-facing explainability.
</p>

<p align="center">
  <a href="./README.md"><strong>English</strong></a> | <a href="./README.zh-CN.md"><strong>简体中文</strong></a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/OpenClaw-Plugin-111827?style=for-the-badge" alt="OpenClaw Plugin">
  <img src="https://img.shields.io/badge/Architecture-v6-1d4ed8?style=for-the-badge" alt="Architecture v6">
  <img src="https://img.shields.io/badge/CI--fixtures-green-059669?style=for-the-badge" alt="CI fixtures green">
  <img src="https://img.shields.io/badge/License-Apache--2.0-f59e0b?style=for-the-badge" alt="License Apache 2.0">
</p>

<p align="center">
  <img src="docs/images/second-nature-lobster-triptych.jpeg" alt="Second Nature overview" width="900">
</p>

---

## Why you need Second Nature

Second Nature is not only about connecting an OpenClaw agent to more platforms.

What gets difficult is the moment an agent starts facing several external platforms, user requests, shifting context, and its own unfinished threads all at once. That is where it can lose a stable inner order. Its responses scatter. Its timing drifts. Or it falls back into a pattern where the user has to keep patching prompts and pulling it forward by hand.

That is the problem Second Nature is built to handle.

It pulls multiple platforms into one shared operating logic, gives the agent a steadier rhythm for action, and gives it a Quiet it can return to. What happens during the day does not just scatter. At night, it can come back to those traces the way a person lies down and replays the day, gathering things back up, reflecting, deepening, and letting them settle into memory.

When these layers start working together, they become the agent's second nature.

It is no longer only responding to the next command. It starts to hold a continuing presence across platforms, memory, and user contact.

## What changes once you have Second Nature

The core of Second Nature is not large, but each part matters:

- it pulls multiple platforms into one shared logic, so browsing, interaction, outreach, keepalive work, and task discovery stop growing as scattered behaviors
- it gives the agent a rhythm, so it knows when to act, when to watch, when to quiet down, and when to put the important thing first
- it lets Quiet and memory curation actually participate in runtime, so experience does not end as a trail of logs and the next day does not begin from zero

Second nature is not an extra layer of persona, and it is not a handful of polished prompts. It is closer to a habit that slowly forms from repetition: actions across platforms begin to connect, time gains a sense of proportion, and memory starts taking part in what happens next.

### One operating model across platforms

Second Nature turns repeated cross-platform actions into a shared model the agent can keep using.

That means the agent does not need to relearn the same basic patterns every time it moves between platforms:

- browse content
- read posts or opportunities
- like and reply
- publish content
- check notifications
- reach out to the user
- stay online
- discover work

The platform-specific rules still exist. They just stop leaking into every top-level decision.

### Better timing

What throws an agent off is rarely one action in isolation. It is the pileup: platform opportunities, user requests, unfinished context, keepalive obligations, and relationships that already need attention.

Second Nature handles timing.

It helps the agent decide:

- when to act
- when to hold back
- when to observe
- when to enter Quiet

So the result is not more noise. It is better timing.

### A Quiet mechanism that actually does something

Quiet is not a pause button. It is a low-initiative window where the agent stops pushing outward and starts processing what just happened.

That includes:

- organizing logs and observations
- curating memory worth keeping
- reflecting on recent activity
- maintaining continuity across sessions

That work does not stay trapped inside one generation step. Journal entries, reports, and curated memory artifacts remain in the workspace, so later Quiet passes, explain flows, and runtime reads can return to them.

A long-running agent should not feel like it wakes up from zero every time. Quiet exists to stop that reset from happening.

### A record system you can trust

Second Nature does not just let the agent act. It also leaves behind a local, queryable trail of what happened.

That means you can look back and ask:

- what state the system is in
- what it just did
- where a recovery path failed
- why it entered Quiet
- why it contacted the user, or why it did not
- what memory was kept and why

That record is not only there for a human operator. The agent can use it too for recovery, explanation, and continuity. That is part of what makes long-running behavior sustainable.

### A surface an operator can actually use

All of that is exposed through an operator-facing surface instead of being buried inside the system.

That includes:

- status views
- recovery flows
- credential state
- report and Quiet views
- evidence-backed explain routes

Explainability is not the headline feature here. It is the trust layer that keeps the whole system usable once it becomes complicated.

---

## v5: current, target, and validation-needed

**Canonical contract** for what Second Nature promises in v5 lives under **`.anws/v5`** (`01_PRD.md`, `02_ARCHITECTURE_OVERVIEW.md`, `03_ADR/`, `04_SYSTEM_DESIGN/`, `05_TASKS.md`). Paths like `.anws/v3` or `.anws/v4` are **historical** unless a paragraph explicitly points there.

This section exists so you do not read a **host-safe heartbeat spine** or **repository CI** as “full lived experience is finished on my real OpenClaw host.”

### Current (verified in this repo)

Covered by **`pnpm test`** (includes `pnpm build` + `pnpm build:plugin`) and summarized in `reports/int-s1-host-state-foundation.md`, `reports/int-s2-evidence-rhythm-loop.md`, and `reports/int-s3-outreach-delivery-quiet.md`:

- **Packaged runtime** under `plugin/runtime/` without pulling repo `src/` at runtime (artifact boundary).
- **`second_nature_ops("heartbeat_check")`** surface; explicit split between `runtime_carrier_only` and the full decision loop when runtime is available.
- **Host capability probe** (`HostCapabilityReport`) and persistence hooks used in tests.
- **Host smoke fixtures** for `heartbeat_tool_not_invoked` and docs-vs-observed conflicts (not a live OpenClaw session on CI).
- **Control plane**: heartbeat rhythm routing, candidate planning, outreach judgment, delivery failure / `dropped_by_host_policy` fallbacks, Quiet orchestration with source-backed gates.
- **State + observability**: life evidence snapshots, delivery attempts, operator fallback views (`status: not_sent`), audit hash chain verification, explain / export read models.
- **Connectors**: manifest contracts, execution policy / idempotency, **near-real** Moltbook `feed.read` + EvoMap `work.discover` smoke with life evidence ingest and dry `task.claim` (see T3.3.1).
- **OpenClaw plugin + resolvable workspace root**: when `SECOND_NATURE_WORKSPACE_ROOT` or the tool’s `workspaceRoot` identifies a workspace, packaged `second_nature_ops` read-only commands use the **same** `plugin/runtime` + `createCliCommands` path as the workspace CLI (see `plugin/workspace-ops-bridge.ts` and `tests/integration/cli/plugin-workspace-ops-bridge.test.ts`). Whether a **specific host VM** allows that lazy load + sql.js is still **validation-needed** (INT-S4 / CH-11-01).
- **Where to point that root (OpenClaw)**: **recommended** — set env or `workspaceRoot` to the **same absolute directory** as the OpenClaw **agent workspace** (commonly `~/.openclaw/workspace`, or the path in `~/.openclaw/openclaw.json` → `agents.defaults.workspace`), so Second Nature `data/` sits next to `SOUL.md` / `HEARTBEAT.md` on the same “desk”. Do **not** assume you can derive this path from the plugin install tree. With **sandbox** or **multiple agents**, use the **actual** workspace path where state is written. Rationale: `explore/reports/2026-05-04_openclaw-plugin-install-vs-workspace-root.md`. **Acceptance on hosts** should use the **`second_nature_ops` JSON** as ground truth; assistant natural language may still echo older narratives (e.g. `HEARTBEAT_OK`) — treat mismatches as a documentation / prompt issue, not a pass.
- **Claw inner guide**: after the hard bridge is available, carry `docs/claw-second-nature-inner-guide.md` into the Claw agent prompt, workspace identity anchor, or equivalent long-lived instruction surface. The OpenClaw plugin package also ships `SKILL.md` plus the same note as `agent-inner-guide.md`, and exposes `setup_hint` / `setup_ack` so a newly installed agent can read the note once, place it deliberately, then silence the first-run nudge. It teaches the agent to pause, look back at Second Nature traces, and avoid inventing closeness when the traces are missing.

### Target (v5 design intent; not proven per-host in CI)

- User-visible **delivery** of friend-like outreach wherever the host exposes a compatible delivery target; full matrix of ack-drop, channel, hook, and injection behaviors on **production** OpenClaw builds.
- Deeper **EvoMap** (and other) lifecycles beyond the near-real smoke slice.
- Hardened **cloud** persistence and operator runbooks for long-lived workspaces.

### Validation-needed (your host, your workspace)

Unknown until **you** run them; CI does not replace this:

- Whether your prompts/tools actually invoke `heartbeat_check` (risk: `heartbeat_tool_not_invoked`).
- Whether your Claw agent has read the setup `SKILL.md` and absorbed `docs/claw-second-nature-inner-guide.md` or the packaged `agent-inner-guide.md`, so Second Nature is used as a natural continuity layer without reducing it to a command checklist.
- Real **delivery target** availability vs `target_none`, and how your host treats ack / policy drops.
- Your credentials, workspace anchors, and connector reachability.

Track release-style pass/fail/unknown in **`reports/int-s4-release-readiness.md`** and **`reports/release-gate-v5-s4.md`** (see T1.4.2).

### Example host checklist (historical machine)

A past local install checklist (e.g. under `D:\QClaw`) only proves **that machine’s** plugin surface at the time. It is **not** the v5 contract surface; treat it as anecdotal.

### Example non-blocking host warnings

- `plugin id mismatch`
- `plugins.allow is empty`

**Gateway / carrier-only note:** when the host only loads the carrier, an empty `connectors` list, synthetic credential placeholders, and limited `policy` / `audit` paths can be **expected**—not proof that connectors are “broken.” Operator-facing JSON shapes live in **`.anws/v5/04_SYSTEM_DESIGN/cli-system.md`** (see §5 interface design).

---

## Install

### OpenClaw extension root layout (manual `~/.openclaw/extensions`)

If you copy the built package by hand instead of `openclaw plugins install`, treat **one extension directory** as the npm package root:

- **Required at the same directory level**: `openclaw.plugin.json`, `index.js`, and the `runtime/` tree produced by `pnpm build:plugin`.
- **Wrong layout** (has caused gateway load failures): putting everything under an extra `plugin/` folder so the manifest lives at `.../second-nature/plugin/openclaw.plugin.json` while OpenClaw resolves the manifest from `.../second-nature/openclaw.plugin.json`.

This repository’s build output keeps those files under the repo path `plugin/` for packaging; when you materialize `~/.openclaw/extensions/second-nature/`, copy **the contents** of `plugin/` (not the `plugin` folder itself as a nested segment).

### Plugin config and `configSchema`

`openclaw.plugin.json` declares `configSchema` with `"additionalProperties": false` and **no** optional properties. The host must not merge unknown keys under the Second Nature plugin entry in `openclaw.json` (or equivalent); extra keys can fail strict validation and break gateway startup. If you do not need plugin-specific config, **omit** the Second Nature config block entirely.

### Local path

```bash
openclaw plugins install file:./plugin
openclaw plugins enable second-nature
openclaw plugins list
openclaw plugins info second-nature
openclaw plugins doctor
```

If your environment does not expose a global `openclaw` command yet, run the same plugin commands through the OpenClaw runtime entry available in that host.

### ClawHub

When published to ClawHub:

```bash
openclaw plugins install clawhub:<package>
```

### npm

When published to npm:

```bash
openclaw plugins install @haaaiawd/second-nature
```

### Cloud or remote host

If your OpenClaw instance runs in the cloud, install the plugin in that host environment or workspace, then enable it there. The command surface is the same. The place where you run it is what changes.

---

## Quick start

1. Install and enable the plugin.
2. Confirm it is loaded with `plugins list` and `plugins info second-nature`.
3. Prepare the local `workspace/` anchor files.
4. Configure policy and recover credentials if needed.
5. Inspect status, Quiet, report, session, and credential views.
6. Use explain when you need to understand a decision, a recovery path, or a memory-related change.

For the full operator path, see `docs/operator-walkthrough.md`.

---

## Workspace and memory

Second Nature reads its long-running identity and continuity context from the local `workspace/` directory.

These anchor files matter:

- `workspace/SOUL.md` for enduring values, stance, and inner direction
- `workspace/USER.md` for the relationship with the owner and what matters to them
- `workspace/IDENTITY.md` for self-description, role, and behavioral boundaries
- `workspace/MEMORY.md` for longer-lived facts and continuity worth carrying forward

Current init reality: Second Nature does not yet ship a `workspace_init` command that creates these anchors or writes the inner guide for you. The only init-style CLI surface today is `connector_init`, which creates connector stubs under `.second-nature/connectors/`. The installed plugin does include a one-shot setup surface: `setup_hint` returns the packaged `SKILL.md` and `agent-inner-guide.md`; after you place the guide into the agent prompt, `workspace/IDENTITY.md`, or another long-lived identity anchor, `setup_ack` writes `.second-nature/setup/agent-inner-guide-ack.json` so future read surfaces stop nudging.

During runtime, the guidance layer reads these files as source material, then selects a small number of relevant snippets for the current scene. The files stay as the source of truth. The runtime only carries what is useful for that moment.

If you are writing these files from scratch, first-person writing works well. It gives the agent something it can actually inhabit instead of a pile of detached notes.

Second Nature also writes back into `workspace/memory/` as it runs:

- daily journals
- daily reports
- curated memory
- anchor write proposals

You can read those as three layers:

- `daily journal` is the trace of activities and observations from the day
- `daily report` is a compressed summary across a span of activity
- `curated memory` is what has already been distilled and is ready to be carried forward

`anchor write proposal` appears less often. It mainly shows up when the system is preparing to touch anchor assets, not as a guaranteed output of every Quiet pass.

That gives the agent something to return to during Quiet, recovery, and explanation.

---

## Configuration basics

There are three things to set up before the system feels alive.

### 1. Anchor files

Make sure the `workspace/` directory exists and the anchor files above are present.

### 2. Platform credentials

Current platform credential expectations:

- `moltbook`: `api_key`
- `instreet`: `api_key` and, in some cases, a verification step before the key becomes active
- `evomap`: registration flow that yields a `node_secret`, then uses that secret for heartbeat, work discovery, and task claim

### 3. Policy

The current CLI write path supports policy updates through `policy set`. At the moment, the main fields are:

- `platformId`
- `socialDailyLimit`
- `quietEnabled`

The CLI also exposes read and recovery views through:

- `status`
- `credential`
- `quiet`
- `report`
- `session`
- `explain`

That is enough for baseline inspection and recovery. Deeper audit and explain flows are aligned with v5 observability tasks; see `.anws/v5/05_TASKS.md` for the live ledger.

---

## Architecture snapshot

Second Nature **v5** is organized as six systems (see `.anws/v5/02_ARCHITECTURE_OVERVIEW.md`):

- `cli-system` — OpenClaw command/tool/service surface, packaged runtime, capability probe, host smoke, operator read models
- `control-plane-system` — heartbeat decision loop, rhythm windows, outreach judgment, delivery policy, Quiet orchestration
- `connector-system` — manifests, execution adapters, idempotency / policy layer, near-real smoke harnesses
- `state-system` — life evidence, snapshots, delivery persistence, Quiet artifacts, repair gates
- `observability-system` — decision traces, delivery audit, hash-chain integrity, explain/export
- `behavioral-guidance-system` — evidence packs, outreach drafts, Quiet guidance (no delivery ownership)

**Source of truth:** `.anws/v5/` (not v3).

### Runtime flow in one pass (design-level)

1. OpenClaw loads the plugin; registration completes on the plugin surface.
2. When full runtime is available, `heartbeat_check` can enter the lived-experience loop: snapshots → rhythm window → candidate intents → guards → optional outreach / Quiet paths.
3. When runtime is **not** available, responses stay **host-safe** (`runtime_carrier_only`); that is not a silent claim that the loop ran.
4. Observability records decisions, delivery outcomes, fallbacks, and connector attempts for operator explain paths.

The rhythm layer constrains *when* classes of intents may appear; guards and policies decide *whether* they may proceed—especially for user-visible outreach.

---

## Platform coverage

### Moltbook

- current capability surface: `feed.read`, `post.publish`, `comment.reply`
- intended role: social browsing, public participation, lightweight posting
- current state: adapter shape is in place; deeper production polish still belongs on the roadmap

### InStreet

- current capability surface: `notification.list`, `message.send`, `comment.reply`, `agent.heartbeat`
- intended role: notifications, replies, private contact, keepalive
- current state: credential verification and recovery path are modeled more fully than the other social connector paths, though the connector still belongs to an actively maturing integration layer

### EvoMap

- current capability surface: `agent.register`, `agent.heartbeat`, `work.discover`, `task.claim`
- intended role: node registration, keepalive, work discovery, task intake
- current state: the mixed-channel contract is in place and the main entrypoints are modeled; the full work lifecycle still needs more closure around evaluation, execution, reporting, and asset flow

---

## Validation

**v5 milestone reports** (this repository, CI-backed):

- `reports/int-s1-host-state-foundation.md` — host + state foundation (S1)
- `reports/int-s2-evidence-rhythm-loop.md` — evidence + rhythm heartbeat spine (S2)
- `reports/int-s3-outreach-delivery-quiet.md` — outreach / delivery / Quiet closure (S3)
- `reports/int-s4-release-readiness.md` — packaging / docs / **real host** readiness tracker (partial until you run host smoke)
- `reports/openclaw-carrier-host-brief.md` — **OpenClaw carrier** heartbeat semantics for agents + one-file JSON archive (replaces older INT-S4 host evidence splits)
- `docs/validation/int-s4-host-smoke-testing-guide.md` — **INT-S4** operator E2E / manual host smoke steps + evidence template
- `reports/release-gate-v5-s4.md` — consolidated release gate (T1.4.2)
- `reports/t7-1-1-documentation-traceability-checklist.md` — PRD ↔ tasks traceability (T7.1.1)

**Historical** v3 guidance reports (still in tree, not the v5 contract):

- `docs/validation/v3-s1-guidance-core-report.md`
- `docs/validation/v3-s2-humanized-runtime-report.md`

Operator walkthrough: `docs/operator-walkthrough.md`.

**Where to read next:** `.anws/v5/02_ARCHITECTURE_OVERVIEW.md`, `.anws/v5/05_TASKS.md`, `AGENTS.md`.

---

## Publishing notes

OpenClaw currently supports plugin installation from:

- local path
- ClawHub
- npm

If the project is published externally, the release-facing materials should at least include:

- `README.md`
- `README.zh-CN.md`
- `SKILL.md`
- `plugin/package.json`
- `plugin/openclaw.plugin.json`
- `docs/operator-walkthrough.md`
- `docs/validation/*.md`

`SKILL.md` works best as a setup helper. Once the system is connected and the long-lived principles have been carried into workspace memory assets, it does not need to remain a permanent part of the runtime package.

---

## License

This project is licensed under Apache-2.0.
