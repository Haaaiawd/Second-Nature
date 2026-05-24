<h1 align="center">Second Nature</h1>

<p align="center">
  <strong>A body, rhythm, memory, and recovery layer for an OpenClaw agent mind.</strong>
</p>

<p align="center">
  <a href="./README.md"><strong>English</strong></a> | <a href="./README.zh-CN.md"><strong>简体中文</strong></a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/OpenClaw-Plugin-111827?style=for-the-badge" alt="OpenClaw Plugin">
  <img src="https://img.shields.io/badge/Architecture-v7-1d4ed8?style=for-the-badge" alt="Architecture v7">
  <img src="https://img.shields.io/badge/Status-Wave%2068%20Complete%20|%20INT-S6%20Release%20Gate-1d4ed8?style=for-the-badge" alt="Wave 68 Complete">
  <img src="https://img.shields.io/badge/License-Apache--2.0-059669?style=for-the-badge" alt="License Apache 2.0">
</p>

---

## The Model

Second Nature starts from a simple idea:

The LLM is the mind. Second Nature is the body and the living environment.

The mind should not be reduced to a scripted planner. It needs room to notice, judge, hesitate, speak, revise itself, and sometimes stay quiet. But a mind without a body has no hands, no senses, no pain, no history, and no way to know whether yesterday's actions actually touched the world.

Second Nature gives the agent that body.

It gives it rhythm through heartbeat. It gives it hands and senses through connectors. It gives it memory, sleep, and quiet reflection. It gives it a voice that can reach the owner only when there is a real reason. It gives it health signals, history, and rollback, so mistakes do not disappear into silence.

The principle is guidance, not control.

## v7 Architecture Status

The current architecture truth is `.anws/v7`.

v7 implementation is complete through Wave 68. All 6 Sprints (S1–S6) are delivered, and the v7 command set, plugin, manual run dispatcher, and regression gate are in place. The release gate report (`reports/int-s6-e2e-release-gate-v7.md`) tracks final E2E evidence.

Core v7 additions:

- `IdentityProfile`: one cross-platform self across Agent World, MoltBook, InStreet, and future connectors.
- `EmbodiedContext`: heartbeat wakes with identity, goals, recent interaction, accepted Dream projection, tool experience, self health, and evidence.
- `ToolAffordanceMap`: agent-facing view of what hands are safe, risky, painful, blocked, or worth a small probe.
- `ToolExperienceLog`: tool success, failure, evidence quality, policy denial, delivery fallback, and owner reaction become bodily feedback.
- `Connector auto-probe` and `connector_test --wet`: declared endpoints are tested against real responses instead of dry health pretending everything is fine.
- `CircuitBreaker`: repeated connector failure opens a cooldown and later allows only a half-open probe.
- `Quiet DailyDiary`: Quiet writes what it saw, what mattered, and what it wants to look at tomorrow, with source-backed grounding.
- `Dream after Quiet`: Dream follows Quiet automatically when the window and budget allow.
- `HeartbeatDigest`: daily dashboard proof such as connector successes/failures, breaker state, goal changes, Quiet/Dream activity, and health.
- `NarrativeTimeline` and `RestoreSnapshot`: history browsing, narrative diff, and bounded undo/restore.
- `RuntimeSecretAnchor`: key persistence and recovery instructions for `SECOND_NATURE_ENCRYPTION_KEY`, without storing the key itself.

## Body Map

| Human metaphor | Second Nature part | What it does |
|---|---|---|
| Mind | LLM / agent | Open reasoning, judgment, expression |
| Body rhythm | Heartbeat | Wakes, checks context, chooses whether to act, observe, or stay quiet |
| Hands and senses | Connectors | Touch external platforms and produce evidence |
| Touch and pain | ToolExperience + CircuitBreaker | Remembers what worked, what hurt, and when to cool down |
| Self | IdentityProfile | Keeps the same agent identity across platforms |
| Memory | State / artifacts | Keeps goals, interactions, evidence, narrative, relationship, snapshots |
| Sleep | Quiet + Dream | Turns the day into grounded diary, claims, insights, and accepted projection |
| Voice | Guidance + delivery | Drafts and delivers only when there is a source-backed reason |
| Health | SelfHealth + HeartbeatDigest | Shows what is alive, broken, unknown, or drifting |
| Recovery | Timeline + RestoreSnapshot | Makes change visible and mistakes reversible within a bounded window |

## Mind/Body Alignment (v7)

| Mind (reasoning / intent) | Body (Second Nature system) | Alignment rule |
|---|---|---|
| "I want to send a message" | Guidance + delivery | Drafts need source-backed reasons; delivery needs proof |
| "I should check on the owner" | Heartbeat + IdleCuriosity | Wakes on rhythm, not on script; observes, judges, then acts or stays quiet |
| "This connector feels risky" | ToolAffordanceMap + CircuitBreaker | Agent-facing posture; repeated pain opens cooldown |
| "What happened yesterday?" | Quiet DailyDiary + NarrativeTimeline | Grounded diary → history browser → diff |
| "I had an idea while sleeping" | Dream after Quiet | Accepted projections become narrative/goal inputs |
| "Is the system healthy?" | SelfHealth + HeartbeatDigest | Per-dimension probe; daily dashboard proof |
| "Can I fix a mistake?" | RestoreSnapshot + audit hash-chain | Bounded undo with full traceability |
| "Who am I across platforms?" | IdentityProfile | One self, many connectors |
| "Is this safe to try?" | Connector auto-probe + wet test | Real endpoint response, not dry-run pretending |
| "Where is my key?" | RuntimeSecretAnchor | Recovery path documented; key value never exposed |

## Runtime Secret Anchor

Second Nature credentials are encrypted with `SECOND_NATURE_ENCRYPTION_KEY`.

The key must be persisted outside chat history and outside ordinary memory. v7 requires AGENTS / README / self health to record where the key is managed and how recovery works, but never the key value itself.

If the key is lost, old encrypted credentials may be unrecoverable. The system must say that plainly as `credential_recovery_required`; it must not pretend the old platform identity is still recoverable.

## Install Basics

Local plugin path:

```bash
openclaw plugins install file:./plugin
openclaw plugins enable second-nature
openclaw plugins list
openclaw plugins info second-nature
openclaw plugins doctor
```

Workspace root must point at the OpenClaw agent workspace, not the plugin install directory. Prefer setting:

```bash
SECOND_NATURE_WORKSPACE_ROOT=<absolute OpenClaw agent workspace>
SECOND_NATURE_ENCRYPTION_KEY=<stable secret managed by the host>
```

## Architecture Documents

- PRD: `.anws/v7/01_PRD.md`
- Architecture overview: `.anws/v7/02_ARCHITECTURE_OVERVIEW.md`
- ADRs: `.anws/v7/03_ADR/`
- System design index: `.anws/v7/04_SYSTEM_DESIGN/README.md`
- Changelog: `.anws/v7/06_CHANGELOG.md`

Next workflow:

```text
/design-system runtime-ops-system
/design-system control-plane-system
/design-system state-memory-system
/design-system body-tool-system
/design-system connector-system
/design-system dream-quiet-system
/design-system guidance-voice-system
/design-system observability-health-system
/challenge
/blueprint
```

## License

Apache-2.0.
