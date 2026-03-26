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
  <img src="https://img.shields.io/badge/Milestones-INT--S1_to_INT--S4-1d4ed8?style=for-the-badge" alt="Milestones">
  <img src="https://img.shields.io/badge/Host-Validated-059669?style=for-the-badge" alt="Host Validated">
  <img src="https://img.shields.io/badge/License-Apache--2.0-f59e0b?style=for-the-badge" alt="License Apache 2.0">
</p>

<p align="center">
  <img src="docs/images/second-nature-lobster-triptych.jpeg" alt="Second Nature overview" width="900">
</p>

---

## Why you need Second Nature

The hard part is not connecting an agent to one more platform. The hard part is keeping that agent usable after you connect it to many.

Every platform brings its own skill, its own CLI, its own state model, and its own small differences for doing the same basic things. Browse. Read. Like. Reply. Post. Check notifications. Stay online. Discover work.

The logic overlaps. The surface keeps changing.

For an agent, that fragmentation adds up quickly. It keeps relearning the same patterns in slightly different forms. For the operator, it turns into a pile of brittle flows.

Second Nature is meant to compress that into one steadier operating model.

## What changes once you have Second Nature

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

Once an agent is connected to enough platforms, the next problem is usually overactivity. It can do more, so it starts doing too much.

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

## Current status

### Milestone chain

- `INT-S1` Substrate ✅
- `INT-S2` Decision Spine ✅
- `INT-S3` World Contact ✅
- `INT-S4` Operator Voice ✅

### Host validation

Host validation has been completed through the OpenClaw runtime bundled in `D:\QClaw`.

- install ✅
- enable ✅
- list ✅
- info ✅
- doctor ✅

### Remaining follow-up

- `T4.4.2` formal `ingestTick` entrypoint consolidation

This is still worth doing. It is not blocking the completed milestone chain.

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

If you are using the OpenClaw runtime bundled in QClaw on this machine, the tested command path is:

```bash
node "D:\QClaw\resources\openclaw\node_modules\openclaw\openclaw.mjs" --profile qclaw-plugin-test plugins install file:./plugin
```

### ClawHub

When published to ClawHub:

```bash
openclaw plugins install clawhub:<package>
```

### npm

When published to npm:

```bash
openclaw plugins install @second-nature/openclaw-plugin
```

### Cloud or remote host

If your OpenClaw instance runs in the cloud, install the plugin in that host environment or workspace, then enable it there. The command surface is the same. The place where you run it is what changes.

---

## Quick start

1. Install and enable the plugin.
2. Confirm it is loaded with `plugins list` and `plugins info second-nature`.
3. Configure policy and recover credentials if needed.
4. Inspect status, Quiet, report, session, and credential views.
5. Use explain when you need to understand a decision, a recovery path, or a memory-related change.

For the full operator path, see `docs/operator-walkthrough.md`.

---

## Architecture snapshot

Second Nature currently consists of five systems:

- `cli-system` for config, explain, recovery, and operator-facing views
- `control-plane-system` for rhythm, intent, Quiet, resume, and outreach orchestration
- `connector-system` for capability contracts and execution adapters
- `state-system` for local state, memory artifacts, governed writes, and credential ownership
- `observability-system` for evidence, telemetry, redaction, and governance audit

The architecture and task source of truth lives under `.anws/v2`.

---

## Validation

Validation artifacts live under `docs/validation/`:

- `docs/validation/s1-substrate-report.md`
- `docs/validation/s2-decision-spine-report.md`
- `docs/validation/s3-world-contact-report.md`
- `docs/validation/s4-operator-voice-report.md`

The end-to-end operator path is documented in `docs/operator-walkthrough.md`.

---

## Publishing notes

OpenClaw currently supports plugin installation from:

- local path
- ClawHub
- npm

If the project is published externally, the release-facing materials should at least include:

- `README.md`
- `README.zh-CN.md`
- `plugin/package.json`
- `plugin/openclaw.plugin.json`
- `docs/operator-walkthrough.md`
- `docs/validation/*.md`

---

## License

This project is licensed under Apache-2.0.
