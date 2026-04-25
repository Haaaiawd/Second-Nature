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
  <img src="https://img.shields.io/badge/Architecture-v3-1d4ed8?style=for-the-badge" alt="Architecture v3">
  <img src="https://img.shields.io/badge/Host-Surface%20Validated-059669?style=for-the-badge" alt="Host Surface Validated">
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

## Current shape

Second Nature now tracks its source of truth under `.anws/v3`.

- the core plugin surface is in place
- the v3 behavioral guidance layer is in place
- the guidance templates have gone through human review
- the current task board is closed with `0` open tasks in `.anws/v3/05_TASKS.md`

### Host validation

The host-facing plugin surface has been validated locally through the OpenClaw runtime bundled in `D:\QClaw`.

- install ✅
- enable ✅
- list ✅
- info ✅
- doctor ✅
- sync register ✅
- runtime activation evidence ✅

What is verified here is the plugin surface and the minimal runtime spine that backs it.
It should not be read as proof that the full heartbeat bridge, connector orchestration, or Quiet closure is already complete.

Cloud-host closure still needs the dedicated checklist pass.

### What is still worth tightening

- clearer platform capability notes, especially for EvoMap task flow
- deeper runtime closure around connector execution and lifecycle polish
- cloud deployment hardening around persistence and host setup

### Current non-blocking warnings

- `plugin id mismatch`
- `plugins.allow is empty`

---

## Install

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

That is enough for baseline inspection and recovery. More complete audit views are still settling into place.

---

## Architecture snapshot

Second Nature currently consists of six systems:

- `cli-system` for config, explain, recovery, and operator-facing views
- `control-plane-system` for rhythm, intent, Quiet, resume, and outreach orchestration
- `connector-system` for capability contracts and execution adapters
- `state-system` for local state, memory artifacts, governed writes, and credential ownership
- `observability-system` for evidence, telemetry, redaction, and governance audit
- `behavioral-guidance-system` for runtime atmosphere, behavioral impulses, persona reinforcement, and output guard

The architecture and task source of truth lives under `.anws/v3`.

### Runtime flow in one pass

At a high level, the currently verified loop looks like this:

1. OpenClaw loads the plugin through the command / tool / service surface.
2. Registration completes synchronously before the host returns from plugin setup.
3. The runtime spine records activation or reload evidence into observability.
4. `status` reads runtime liveness separately from connector execution attempts.
5. Deeper control-plane rhythm, connector execution, and Quiet closure continue to evolve behind this spine.

The rhythm layer gives the system hard windows. The action inside those windows stays flexible. That helps the agent feel directed without turning it into a clockwork script.

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

Validation artifacts live under `docs/validation/` and currently include the v3 guidance reports:

- `docs/validation/v3-s1-guidance-core-report.md`
- `docs/validation/v3-s2-humanized-runtime-report.md`

The end-to-end operator path is documented in `docs/operator-walkthrough.md`.

If you want the architecture history and task ledger, start with:

- `.anws/v3/02_ARCHITECTURE_OVERVIEW.md`
- `.anws/v3/04_SYSTEM_DESIGN/behavioral-guidance-system.md`
- `.anws/v3/05_TASKS.md`
- `AGENTS.md`

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
