# v8 Runtime Activation Repair - Feasibility Research

**Date**: 2026-06-05  
**Scope**: Second Nature v8 runtime activation after user feedback on impulse, action, rhythm, and self-dialogue gaps.  
**Status**: Research complete; repair backlog written to `.anws/v8/05A_TASKS.md` and `.anws/v8/05B_VERIFICATION_PLAN.md`.

---

## Executive Conclusion

The problem is feasible to repair inside v8. It is not a missing capability problem; it is a wiring and runtime proof problem.

Second Nature already has most of the organs:

- Evidence ingestion and v8 state contracts exist.
- Perception and judgment modules exist.
- Action proposal, policy, dispatch, and closure modules exist.
- Guidance impulse text exists behind `guidance_payload`.
- MoltBook read/write client methods exist.
- Quiet/Dream builders and projection lifecycle exist.
- `loop_status` and digest surfaces exist.

What is missing is the real runtime spine that makes these organs act as one body. Current proof is too contract-shaped: tests can demonstrate the intended loop without proving that the workspace heartbeat actually advances through action, closure, Quiet/Dream, impulse context, and causal health in real operation.

The correct repair order is:

1. **T-CP.R.2 Real Runtime Spine**: connect real heartbeat to proposal -> policy -> dispatch/no-dispatch -> closure/no-action.
2. **T-GVS.R.1 Impulse Context**: project impulse into an agent-facing artifact and setup/heartbeat surfaces.
3. **T-DQ.R.2 Independent Rhythm**: give Quiet/Dream due/completed/blocked/absence states independent of fast heartbeat intent.
4. **T-CS.R.1 MoltBook Write Safety**: enable reply/publish only through policy proof, dry-run/owner-confirm, idempotency, and closure.
5. **T-OBS.R.2 + INT-R1**: add a gate that refuses to call the system healthy unless real runtime evidence or explicit absence reasons exist.

---

## Evidence From Code And Design

### 1. Impulse exists but is passive

`guidance_payload` is exposed as an ops command. That makes it available only when explicitly called. It does not naturally appear in agent-facing context during setup, heartbeat, or platform-scene entry.

Feasibility: high. The safe route is not to pretend the plugin is an OpenClaw context-engine. The plugin currently identifies itself as a tool/service surface, so the repair should write a bounded impulse context artifact and expose a pointer/content slice through setup and heartbeat responses.

Risk: medium. True automatic context injection depends on host capability. Without a host context-engine hook, the honest implementation is artifact projection plus visible runtime surfaces.

### 2. Runtime heartbeat and v8 loop are split

v8 design says the control plane should advance ingestion -> perception -> judgment -> policy -> execution -> closure -> Quiet/Dream -> projection. The implemented v8 orchestrator currently proves perception/judgment shape, while the older workspace heartbeat path runs connector/Quiet style operations separately.

Feasibility: high. The v8 action modules already exist, so the work is orchestration and persistence wiring rather than inventing a new autonomy model.

Risk: high. This is the first repair because every other capability depends on the runtime producing `ActionClosureRecord` or explicit no-action reasons.

### 3. MoltBook write is possible but must stay gated

MoltBook client-side write methods exist for publish/reply style actions. The current safe gap is not HTTP capability; it is policy proof, idempotency, owner-confirm/dry-run posture, and closure recording.

Feasibility: medium-high. Implementation should default to dry-run or owner-confirm. Real platform write must remain out of automated tests unless a safe test account and explicit confirmation are supplied.

Risk: high if wired directly; low if routed only through policy-bound dispatch and closure.

### 4. Quiet/Dream has components but not independent rhythm

Quiet/Dream builders and scheduling exist, but the observed runtime behavior is a single fast heartbeat rhythm. A living system needs a daily rhythm with durable due/completed/blocked/skipped states, including explicit absence reasons.

Feasibility: high. The missing piece is a cadence/read-model layer and status surface, not a new memory theory.

Risk: medium. Date boundaries, duplicate daily scheduling, empty input, and scheduler-unavailable cases must be explicit.

### 5. Health currently risks false completion

The existing full-chain v8 integration is valuable, but it is not enough as runtime proof if it can pass without live workspace heartbeat, host-visible impulse context, safe write path, or daily Quiet/Dream cadence evidence.

Feasibility: high. `loop_status`, digest, audit, and stage events already exist. The repair should add a "real-run activation" gate that treats contract-only smoke as insufficient.

Risk: medium. The gate must report missing stages honestly without leaking raw platform payloads or credentials.

---

## Priority Judgment

| Priority | Repair | Why |
| --- | --- | --- |
| P0 | T-CP.R.2 | Without real action/closure, the system remains a reader with memory, not a living loop. |
| P0 | T-GVS.R.1 | Impulse must be present before behavior; otherwise guidance text is decorative. |
| P0 | T-OBS.R.2 / INT-R1 | Prevents another false-green milestone. |
| P1 | T-DQ.R.2 | Gives the system a slower breath and self-review loop. |
| P1 | T-CS.R.1 | Gives hands/mouth, but only after policy and closure are real. |

---

## Non-Goals

- Do not register a fake OpenClaw context-engine.
- Do not perform real MoltBook writes in automated tests.
- Do not mark existing v8 tasks complete or mutate REQ/ADR just to fit the repair.
- Do not treat contract smoke as proof of real runtime life.

---

## Written Back Into Architecture Work Items

- `T-CP.R.2`: real workspace heartbeat into v8 action/closure spine.
- `T-GVS.R.1`: impulse payload as bounded agent-facing context artifact.
- `T-CS.R.1`: policy-bound MoltBook reply/publish with dry-run/owner-confirm and closure.
- `T-DQ.R.2`: independent Quiet/Dream cadence with absence reasons.
- `T-OBS.R.2`: real living-loop health gate.
- `INT-R1`: runtime activation repair integration gate.
