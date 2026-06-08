# v8 Mechanism Audit — DeepWiki + Local Code Review

**Date**: 2026-06-01
**Scope**: v7 runtime mechanisms, DeepWiki architecture pages, local source verification
**Status**: Draft evidence package for v8 genesis

---

## 1. Executive Finding

v7 has a mostly complete runtime body, but its living loop is not closed.

The system can collect evidence, execute connectors, record tool experience, expose ops commands, and summarize runtime health. The missing layer is semantic: there is no durable, first-class path that turns raw platform evidence into agent-visible perception, agent-authored judgment, policy-bounded action closure, daily review, and Dream-backed long-term memory projection.

This is why the observed MoltBook state can be true at the same time:

- heartbeat keeps collecting data;
- `life_evidence_index` grows;
- `daily_diary_index` and `dream_output_index` remain empty;
- Nyx still has no meaningful next action.

That is not primarily a sensitivity threshold issue. The sensitivity path is a risk, but the larger bug is architectural.

---

## 2. Sources Reviewed

### 2.1 DeepWiki

DeepWiki page: <https://deepwiki.com/Haaaiawd/Second-Nature>
Last indexed: 2026-06-01.

Reviewed pages:

- `Second Nature — Project Overview`
- `Core Architecture — The Eight Sub-Systems`
- `Control-Plane System — Heartbeat & Intent Planning`
- `Intent Planning & Guard Layer`
- `Rhythm Policy & Workspace Heartbeat Runner`
- `Body-Tool System — Affordance, Experience & Circuit Breaker`
- `Dream-Quiet System — Memory Consolidation & Reflection`
- `Connector System`
- `Connector Executor & Adaptive Runner`
- `Runtime Ops Surface (v7 Command Set)`
- `Guidance & Voice System`
- `State & Memory System`
- `Observability & Health System`

The `npx @seflless/deepwiki` CLI was available through `C:\Users\11341\.agents\skills\deepwiki\SKILL.md`, but returned `Error: fetch failed`. The web pages were accessible and used as the DeepWiki evidence source.

### 2.2 Local Files

- `v8-gap-summary.md`
- `.anws/v7/02_ARCHITECTURE_OVERVIEW.md`
- `.anws/v7/04_SYSTEM_DESIGN/*.md`
- `src/core/second-nature/heartbeat/heartbeat-loop.ts`
- `src/core/second-nature/heartbeat/embodied-context-assembler.ts`
- `src/core/second-nature/orchestrator/intent-planner.ts`
- `src/core/second-nature/orchestrator/hard-guard-evaluator.ts`
- `src/core/second-nature/quiet/run-source-backed-quiet.ts`
- `src/dream/dream-engine.ts`
- `src/dream/dream-input-loader.ts`
- `src/dream/dream-scheduler.ts`
- `src/dream/redaction-gate.ts`
- `src/connectors/base/map-life-evidence.ts`
- `src/storage/services/write-validation-gate.ts`
- `src/storage/services/diary-dream-store.ts`
- `src/storage/services/embodied-context-state-port.ts`

---

## 3. Sensitivity Scan Origin

There are two different mechanisms that can look like a sensitivity scan.

### 3.1 Dream LLM Redaction Gate

Source: `src/dream/redaction-gate.ts`

This gate runs only inside the Dream path before model assistance.

It blocks LLM use when:

- an input carries `credential` or `sensitive` flags;
- credential-like regexes exceed threshold, currently `totalCredentialHits > 3`.

The relevant blocked reasons are:

- `sensitivity_flag_blocks_llm`
- `excessive_credential_exposure`

Current local code also shows that `runDream` constructs evidence summaries from refs:

```text
summary: `evidence:${ref}`
```

So in the current implementation, Dream redaction is not scanning full MoltBook post text unless another upstream path already embeds that text into summaries or flags. If `daily_diary_index` and `dream_output_index` are empty, this gate likely did not block an actual Dream run. The stronger diagnosis is: Dream was not scheduled or not fed through the expected diary path.

### 3.2 State Write Validation Gate

Source: `src/storage/services/write-validation-gate.ts`

This is storage-layer protection, not Dream. It rejects payloads containing sensitive field names or credential-shaped strings and can emit:

```text
write_validation_failed:sensitivity_scan_failed
```

If this is the observed alert, it comes from a state write path. Heartbeat can indirectly trigger it through quiet, tool experience, audit, or memory writes, but it is not a separate sub-agent or cron scanner.

### 3.3 v8 Requirement

v8 must split "security classification" from "domain vocabulary."

MoltBook and similar technical communities naturally contain words such as `token`, `secret`, `credential`, and `verification`. These words are not secrets by themselves. v8 should classify public technical discussion as `public_technical`, and only escalate when content has value-like secret shape: assignment syntax, bearer token form, private key markers, high-entropy long strings, or private identifiers.

---

## 4. System-by-System Health Review

### 4.1 Runtime Ops System

**Healthy**

- Provides a unified `RuntimeOpsEnvelope` across CLI and OpenClaw surfaces.
- Exposes practical commands: `heartbeat_check`, `tool_affordance`, `heartbeat_digest`, `timeline`, `snapshot:capture`, `restore`, `connector:run`, `guidance_payload`.
- Separates probe-only and full runtime modes.

**Unhealthy / v8 risk**

- The ops router is doing too much orchestration work. It is a host surface, not the semantic brain.
- Runtime commands expose symptoms, but there is no single causal read model for: evidence ingested -> perceived -> judged -> acted -> remembered.

**v8 direction**

Keep ops as a shell and add a causal loop read model:

```text
loop_status {
  lastEvidenceIngestedAt
  lastPerceivedAt
  lastJudgedAt
  lastActionProposedAt
  lastMemoryProjectedAt
  currentStallReason
}
```

### 4.2 Control-Plane System

**Healthy**

- Heartbeat is predictable and observable.
- Intent planning, guard evaluation, and effect dispatch are separated.
- Goal fallback prevents total paralysis when evidence is sparse.

**Unhealthy / v8 risk**

- The planner mostly sees refs, counts, goals, affordances, and narrative hints.
- It does not see semantic perception cards. It cannot know whether a MoltBook item is important, actionable, duplicate, dangerous, or irrelevant.
- Goal fallback can produce "grounded-looking" actions from goals, but that is not the same as evidence-based judgment.

**v8 direction**

Insert `PerceptionCard` and `JudgmentVerdict` before intent selection. The control plane should choose from judged proposals, not raw evidence refs.

### 4.3 State-Memory System

**Healthy**

- SQLite-backed state and observability separation is reasonable.
- Source grounding is a real contract.
- Write validation prevents obvious leakage.

**Unhealthy / v8 risk**

- Many records are stored, but not all are agent-visible.
- `LifeEvidence` can accumulate without becoming memory.
- Quiet artifacts, DailyDiary, Dream outputs, accepted projections, and prompt-visible memory are not one obvious lifecycle.

**v8 direction**

Add Dream-backed `MemoryProjection` as a first-class lifecycle. It must be produced from Quiet/Dream consolidation, not directly from every real-time perception:

```text
quiet_daily_review -> dream_candidate -> accepted_projection -> active_projection -> superseded | retired
```

Accepted long-term memory projections must be loadable into `EmbodiedContext` and exportable to an agent-facing artifact.

### 4.4 Dream-Quiet System

**Healthy**

- The conceptual lifecycle is right: Quiet summarizes daily evidence, Dream consolidates it.
- Dream has redaction, validation, candidate status, and accepted projection.
- Scheduler avoids blocking heartbeat.

**Unhealthy / v8 risk**

- Triggering depends on successful Quiet artifact completion and a wired `dreamSchedulePort`.
- Empty diary and dream indexes indicate the implemented path is not reliably producing the intended memory lifecycle.
- Fire-and-forget Dream execution can fail without a durable "scheduled but failed" state.
- Redaction is keyword-sensitive enough to become a false positive once real platform text enters the pipeline.

**v8 direction**

Dream should remain deep consolidation, not first perception. v8 needs a smaller, frequent `Perception -> Judgment -> ActionClosure` path before Quiet. Quiet reviews the day, then Dream consolidates selected daily material into long-term memory.

### 4.5 Connector System

**Healthy**

- Contract-first manifests and runners are the right boundary.
- Honest failure is good: connector problems should not crash heartbeat.
- Declarative HTTP runner and scriptable runner direction support future platforms.

**Unhealthy / v8 risk**

- The current evidence mapper summarizes successful platform reads as `${platformId}:${intent}`.
- That preserves provenance but drops meaning.
- The connector layer knows "I fetched a feed"; no later mandatory layer turns feed items into semantic observations.

**v8 direction**

Connector output should feed an `EvidenceNormalizer` that emits normalized `EvidenceItem` records with content hashes, source refs, semantic hints, sensitivity class, and extraction metadata.

### 4.6 Body-Tool System

**Healthy**

- Affordance, pain signals, and circuit breaker are useful and well bounded.
- This system answers "can the body do this safely enough?"

**Unhealthy / v8 risk**

- Affordance can be over-consumed as a decision signal.
- "Can act" is not "should act."

**v8 direction**

Body-tool remains capability and health. Judgment decides intent. Action policy decides autonomy. Body-tool should not grow a semantic brain.

### 4.7 Guidance-Voice System

**Healthy**

- Source-backed drafts, style lint, persona continuity, and relationship-aware outreach are good primitives.

**Unhealthy / v8 risk**

- It can generate voice, but it is downstream of a missing judgment layer.
- Without a judgment contract, it cannot know whether to notify, draft, reply, publish, ignore, or defer.

**v8 direction**

Guidance consumes `ActionProposal`, not raw intent. Every generated message should explain the selected action type, source refs, risk posture, and autonomy level.

### 4.8 Observability-Health System

**Healthy**

- Audit hash chains, redaction, self-health, digest, and timeline are strong foundations.

**Unhealthy / v8 risk**

- Health can report many local statuses but not the living loop's semantic stall.
- A user can see "heartbeat ok" while the agent is effectively not evolving.

**v8 direction**

Add causal health probes:

- evidence ingestion freshness
- perception backlog
- judgment backlog
- action proposal backlog
- action closure freshness
- Quiet daily review freshness
- Dream-backed long-term memory projection freshness
- autonomy policy denials by reason

---

## 5. v8 Architectural Diagnosis

The unhealthy complexity in v7 is not that there are eight systems. The unhealthy part is that the most important loop crosses all eight systems without a single semantic spine.

v7 is strong at:

- surfaces;
- safety gates;
- storage;
- connector execution;
- observability;
- recovery.

v7 is weak at:

- semantic ingestion;
- importance scoring;
- autonomous action policy;
- action closure;
- Quiet/Dream long-term memory projection;
- causal loop diagnosis.

The fix is not to add many more side systems. The fix is to introduce one central living-loop spine and make existing systems plug into it.

---

## 6. v8 Proposed Spine

```text
ConnectorResult
  -> EvidenceItem
  -> PerceptionCard
  -> JudgmentVerdict
  -> ActionProposal
  -> ActionPolicyDecision
  -> Execution / Draft / Notify / Ignore
  -> ActionClosureRecord
  -> QuietReview
  -> DreamConsolidation
  -> LongTermMemoryProjection
  -> EmbodiedContext
```

### 6.1 EvidenceItem

Normalized, source-backed platform observation.

Must include:

- stable evidence id;
- content hash;
- platform id;
- source refs;
- observed time;
- raw-content storage policy;
- sensitivity class;
- extraction metadata.

### 6.2 PerceptionCard

Agent-readable interpretation of evidence.

Must include:

- topic;
- entities;
- novelty;
- relevance;
- summary;
- possible intents;
- risk flags;
- source refs.

### 6.3 JudgmentVerdict

Nyx's decision about what the perception means.

Possible verdicts:

- `ignore`
- `remember`
- `watch`
- `notify_owner`
- `draft_reply`
- `auto_reply`
- `draft_publish`
- `auto_publish`
- `run_connector`

### 6.4 ActionPolicyDecision

The autonomy boundary.

This is where v8 implements the user's requirement: MoltBook, InStreet, entertainment platforms, work platforms, and future platforms all use the same common policy model. Platform-specific code can provide constraints, but the agent decides under a shared autonomy contract.

### 6.5 ActionClosure and Long-Term Memory Projection

Heartbeat-visible closure plus prompt-visible long-term memory artifact modeled after Dream candidate/accepted flow.

Action closure lifecycle:

```text
proposed_action
  -> policy_decision
  -> executed | drafted | notified | denied | deferred | failed
  -> processed
  -> next_state_recorded
```

Long-term memory lifecycle:

```text
quiet_daily_review
  -> dream_candidate
  -> accepted_projection
  -> active_context_projection
  -> superseded | retired
```

Dream remains deeper consolidation. MemoryProjection is the accepted output of Quiet/Dream memory formation, not a real-time write-through cache. The frequent layer is ActionClosureRecord: it records what the heartbeat saw, decided, did, produced, processed, and carried into the next cycle.

---

## 7. Required v8 Bug Fix Themes

1. **Dream trigger observability**: record scheduled, started, skipped, failed, and completed Dream runs.
2. **Quiet-to-Diary closure**: ensure quiet outputs map into the same DailyDiary/Dream input lifecycle or deliberately rename the artifact path.
3. **Evidence semantic preservation**: stop reducing platform reads to `${platformId}:${intent}` as the only summary.
4. **Context-aware sensitivity**: treat technical vocabulary differently from credential-shaped secrets.
5. **Action closure ledger**: make every heartbeat action produce a natural input-output-processing-next-state record.
6. **Agent-facing long-term memory projection**: make Dream-accepted memory visible to the host and to `EmbodiedContext`.
7. **Autonomous action policy**: define common platform-neutral policy for draft, notify, reply, publish, and connector actions.
8. **Causal health**: make stalls diagnosable as exact stage failures.

---

## 8. Recommendation

Proceed with v8 as a major architecture version.

Do not solve this as a v7 patch. A v7 patch can reduce one false positive or trigger Dream once, but it will not create a reliable perception-judgment-action-memory loop.
