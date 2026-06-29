# 05B_VERIFICATION_PLAN.md — 验证计划

> 版本: v9
> 产出自: /blueprint
> 最后更新: 2026-06-22
>
> 执行主清单: [05A_TASKS.md](./05A_TASKS.md)（每个验证条目有对应 Task ID）

---

## 1. 范围与目标

本验证计划覆盖 `.anws/v9/05A_TASKS.md` 中所有 P0/P1 任务与 INT 关门任务，目标是证明 v9 的 self continuity、attention boundary、activity thread continuity、procedural routine、workspace connector evolution、CharacterFrame 与 observability recovery 契约可实现、可验证、可回滚。

硬性目标：项目验收必须同时包含单元测试与 API接口功能测试；公共契约不得只靠高层集成或 E2E 兜底。

---

## 2. 验证分层策略

| 层次 | 负责范围 | 主要工具 / 位置 |
|------|---------|-----------------|
| 单元测试 | 纯逻辑、状态机、guard DSL、redaction、health 分类、serializer | `tests/unit/**` + `node --test` |
| API接口功能测试 | CLI/plugin ops command contract、错误语义、数据变更 before/after | `tests/api/runtime-ops/**` |
| 集成测试 | SQLite schema、heartbeat path、Dream output、routine/evolution/rollback 跨系统链路 | `tests/integration/v9/**` |
| 冒烟测试 | Sprint 退出关口 | `INT-S{N}` 报告 |
| 回归测试 | v8 compatibility、legacy judgment adapter、plugin bridge、storage migration | selected v8 regression suites |
| E2E/手动验证 | OpenClaw host-visible smoke | 仅在 `/forge` 环境具备时记录，不在 blueprint 执行 |
| 编译/Lint/Build | TS contract and package integrity | `pnpm typecheck`, `pnpm build`, `pnpm build:plugin`, `pnpm lint` |

---

## 3. 风险类别覆盖原则

- **Mind/body boundary**: AttentionSignal 与 CharacterFrame 必须是 contestable projection，不得成为 final judgment、emotion claim 或 hard-control rule；CharacterFrame 输入必须先归一为 `CharacterRefreshInput`，不得直接消费 raw feedback/prompt/private payload。
- **Activity boundary**: `ActivityThread` 只能延续关注、联想与下一步候选；每个 heartbeat 最多推进一个 bounded `ActivityStep`，side-effecting step 必须进入 action policy/closure。
- **Agent-boundary rendering**: `SelfContinuityCard`、`ActivityThread`、`ToolRoutine`、`CharacterFrame`、`loop_status` 的 Agent-facing 文案必须保持 source-backed/contestable/policy-bound/runtime-health 标签；不得出现 emotion claim、identity lock、hard-control wording 或把 health 说成 Agent 心理状态。
- **Authority boundary**: routine 和 connector evolution 不得扩大 credential scope、external write policy、core runtime authority 或 package dependency。
- **Data integrity**: stable identity、schema migration、legacy adapter 和 before/after 状态必须有集成测试。
- **Recovery integrity**: canary failure、rollback failure、missing rollback event 必须进入 blocked/degraded health。
- **Runaway prevention**: stale、overlong、missing-closure activity thread 必须进入 degraded/blocked health，不能伪装为正常 ongoing work。
- **Redaction**: card/frame/ledger/digest/timeline/ops output 不得包含 raw credential、raw private content 或 raw prompt。
- **Anti-expansion**: 用代表性等价类、边界值和表驱动测试闭合风险，不做笛卡尔积枚举。

---

## 4. 测试材料与证据要求

| 验证类型 | 测试材料位置 | 证据形式 |
|---------|--------------|----------|
| 单元测试 | `tests/unit/{contracts,attention,action,memory,body,character,observability,runtime-ops}/` | test output / CI log |
| API接口功能测试 | `tests/api/runtime-ops/` | JSON response assertions / before-after state assertions |
| 集成测试 | `tests/integration/v9/`, `tests/integration/storage/`, `tests/integration/connectors/` | integration report / fixture logs |
| 冒烟测试 | `reports/int-s*-v9-*.md` | pass/fail report + bug list |
| 回归测试 | selected v8 tests | regression log |
| 编译/构建 | repository scripts | `logs/*.log` |
| E2E/手动验证 | `reports/int-s6-v9-release-regression.md` optional section | host transcript / screenshots only if available |

---

## 5. Task-by-Task 验证计划

### T1.2.1
- **关联需求**: REQ-001, REQ-005, REQ-007
- **关联契约**: `continuity.read`, `routine.*`, `connector_evolution.*`, `loop_status.read`, `RuntimeOpsEnvelope`
- **风险类别**: API契约 / CLI-plugin parity / carrier truth / 错误语义
- **单元测试覆盖**: ops command routing and envelope assembly helpers where local logic exists
- **API接口功能测试覆盖**: normal request; missing `workspaceRoot`; unknown command; carrier mode cap; downstream unavailable; data-changing rollback before/after state
- **集成/E2E/冒烟覆盖**: INT-S5 covers CLI/plugin parity; optional OpenClaw smoke in INT-S6
- **前置数据**: v9 state fixture with card, routine, connector plan and health rows
- **断言**: envelope includes `ok`, `command`, `evidenceLevel`, `surfaceMode`, `payload`, `degradedReasons`, `sourceRefs`; errors use canonical reasons
- **证据**: `tests/api/runtime-ops/v9-ops-surface.test.ts`, `tests/integration/plugin/v9-workspace-ops-bridge.test.ts`, `logs/v9-ops-envelope-smoke.json`

### T1.2.2
- **关联需求**: REQ-001, REQ-007
- **关联契约**: ops redaction, evidence level truth gate
- **风险类别**: 安全输出 / carrier false-positive / credential leak
- **单元测试覆盖**: credential/private/prompt pattern redaction; evidence level promotion/capping
- **API接口功能测试覆盖**: sensitive payload response redacts or blocks; carrier result cannot exceed `carrier_ack`
- **集成/E2E/冒烟覆盖**: INT-S5 verifies redacted public ops output
- **前置数据**: payload fixtures containing token/private/prompt fields
- **断言**: no raw sensitive value in JSON; diagnostics marks redaction; evidenceLevel matches proof tier
- **证据**: `tests/unit/runtime-ops/v9-envelope-factory.test.ts`, `tests/api/runtime-ops/v9-redaction-envelope.test.ts`

### T2.2.1
- **关联需求**: REQ-001, REQ-008
- **关联契约**: `EmbodiedContext`, `SelfContinuityCard`, `ActivityThread`, `CharacterFramePointer`, `EmbodiedContextCharacterProjection`
- **风险类别**: context injection / source grounding / prompt safety / size budget
- **单元测试覆盖**: slice loading statuses, char budgets, source ref dedup, activity thread slice loading, contest prompt rendering, Agent-boundary serializer forbidden-pattern fixtures
- **API接口功能测试覆盖**: covered through T1.2.1 `continuity.read` API shape
- **集成/E2E/冒烟覆盖**: context-continuity injection integration; INT-S2 and INT-S5
- **前置数据**: active card, accepted frame, active routine, active/paused ActivityThread, affordance fixture
- **断言**: card pointer and full projection are separate; activity threads are bounded and redacted; unavailable slices carry reasons; context text labels attention/activity/routine/character/health separately and contains no emotion claim, identity lock or hard-control wording
- **证据**: `tests/unit/control-plane/v9-embodied-context.test.ts`, `tests/integration/v9/context-continuity-injection.test.ts`

### T2.2.2
- **关联需求**: REQ-003
- **关联契约**: AttentionSignal handoff; no final body judgment
- **风险类别**: mind/body boundary / missing-source blocker / closure invariant
- **单元测试覆盖**: heartbeat branch table for attentive/blocked/degraded signals
- **API接口功能测试覆盖**: `heartbeat_check` response reports attention blocked and no write action through runtime ops
- **集成/E2E/冒烟覆盖**: attention-to-closure chain integration; INT-S2
- **前置数据**: AttentionSignal fixtures with valid and missing sourceRefs
- **断言**: blocked attention does not call proposal builder and still records no-action closure
- **证据**: `tests/unit/control-plane/v9-attention-cycle.test.ts`, `tests/integration/v9/attention-to-closure-chain.test.ts`

### T2.2.3
- **关联需求**: REQ-001
- **关联契约**: 2s heartbeat budget; slice timeout degraded reason
- **风险类别**: performance / partial context / hang containment
- **单元测试覆盖**: fake timer timeout and slice degraded mapping
- **API接口功能测试覆盖**: `heartbeat_check` returns degraded slice rather than request failure when one read port times out
- **集成/E2E/冒烟覆盖**: INT-S2 deadline smoke
- **前置数据**: slow read port fixture
- **断言**: context assembly returns before configured deadline and preserves other loaded slices
- **证据**: `tests/unit/control-plane/v9-context-deadline.test.ts`, `reports/v9-context-deadline-benchmark.md`

### T2.2.4
- **关联需求**: REQ-003
- **关联契约**: `ActivityThread`, `ActivityStep`, one-step-per-heartbeat continuation
- **风险类别**: runaway loop / stale activity / thread-action policy bypass / source-free association
- **单元测试覆盖**: create/continue/pause/complete branches; max-step guard; stale heartbeat guard; degraded attention skip; source ref blocker; idempotent step append and closure linkage
- **API接口功能测试覆盖**: indirect through `heartbeat_check` and `loop_status.read` exposing activity progress/degraded reasons
- **集成/E2E/冒烟覆盖**: multi-heartbeat continuation integration; INT-S2
- **前置数据**: active thread fixtures, related attention signals, stale/max-step thread fixtures
- **断言**: repeated related attention advances the same thread by at most one step per heartbeat; side-effect step creates action-policy handoff and closure/no-action linkage; stale/overlong thread pauses or blocks with reason
- **证据**: `tests/unit/control-plane/v9-activity-thread-coordinator.test.ts`, `tests/integration/v9/activity-thread-continuation.test.ts`

### T3.2.1
- **关联需求**: REQ-002, REQ-003
- **关联契约**: `AttentionSignal`, `activityThreadId`, `threadSuggestion`, `RepetitionKind`, `AttentionActionKind`, source ref blocker
- **风险类别**: attention scoring / body projection boundary / source grounding
- **单元测试覆盖**: new/changed/duplicate/identity_unstable; risk mapping; action suggestions; thread suggestion; summary budget
- **API接口功能测试覆盖**: indirect through `heartbeat_check` and `loop_status.read` attention stage outputs
- **集成/E2E/冒烟覆盖**: stable identity attention integration; INT-S2
- **前置数据**: EvidenceItem fixtures with sensitivity and source refs
- **断言**: no final judgment emitted; thread suggestion does not mutate state; missing source refs status is `attention_blocked_missing_sources`
- **证据**: `tests/unit/attention/v9-attention-assembler.test.ts`, `tests/integration/v9/stable-identity-attention.test.ts`

### T3.2.2
- **关联需求**: REQ-002
- **关联契约**: stable evidence identity dedup and `identity_unstable` promotion cap
- **风险类别**: data growth / duplicate pollution / routine signal corruption
- **单元测试覆盖**: key derivation boundary values
- **API接口功能测试覆盖**: `loop_status.read` or `connector_evolution.status` does not report unstable identity as routine-ready
- **集成/E2E/冒烟覆盖**: repeated feed integration; INT-S2
- **前置数据**: MoltBook feed fixture repeated three times
- **断言**: one logical row; `seenCount=3`; unstable identity not emitted as routine candidate
- **证据**: `tests/integration/v9/repeated-feed-suppression.test.ts`

### T4.2.1
- **关联需求**: REQ-003, REQ-004
- **关联契约**: `AgentActionIntent`, `ActivityStepIntent`, `AttentionSignalRef` grounding, `RoutineInvocation`, `ActionProposal`
- **风险类别**: proposal correctness / attention-authorship drift / activity policy bypass / source-free action / action kind mapping
- **单元测试覆盖**: Agent intent, activity step intent, attention refs-only no-action, routine invocation, source-free side-effect, connector_read ignore
- **API接口功能测试覆盖**: indirect via `heartbeat_check` selected proposal output and loop_status stage reasons
- **集成/E2E/冒烟覆盖**: INT-S3 action/routine chain
- **前置数据**: v9 attention and routine fixtures
- **断言**: proposals contain sourceRefs, idempotencyKey, activityThreadId/activityStepId when applicable, routine id/version when applicable; attention refs alone never author a proposal and produce `attention_hint_without_agent_or_routine_intent`
- **证据**: `tests/unit/action/v9-action-proposal-builder.test.ts`

### T4.2.2
- **关联需求**: REQ-004, REQ-007
- **关联契约**: `ToolRoutineGuardSchema`, `ActionPolicyDecision`, `routine_permission_expansion_denied`
- **风险类别**: permission expansion / policy bypass / owner confirmation
- **单元测试覆盖**: guard allow/deny/downgrade, breaker open, requiresOwnerConfirm
- **API接口功能测试覆盖**: `routine.rollback` and `routine.show` reflect denied or active routine status through ops
- **集成/E2E/冒烟覆盖**: routine policy closure integration; INT-S3
- **前置数据**: routine guard fixtures and policy context fixtures
- **断言**: permission-expanding guard is denied before execution; owner-confirm guard downgrades
- **证据**: `tests/unit/action/v9-routine-policy-guard.test.ts`, `tests/integration/v9/routine-policy-closure.test.ts`

### T4.2.3
- **关联需求**: REQ-003, REQ-007
- **关联契约**: `ActionClosureRecord`, exactly-one closure
- **风险类别**: loop closure / idempotency / traceability
- **单元测试覆盖**: no-action fallback, routine payload, denied routine no-dispatch closure, activity step closure link, idempotency conflict
- **API接口功能测试覆盖**: `loop_status.read` shows missing/duplicate closure reason in representative fixture
- **集成/E2E/冒烟覆盖**: exactly-one closure integration; INT-S3
- **前置数据**: cycle fixtures with success/failure/no-action
- **断言**: one terminal closure per cycle with source/proof/trace refs; denied routine writes denied/no-action closure without dispatch; activity side-effect step is linked to closureRef or no-action reason
- **证据**: `tests/unit/action/v9-action-closure-recorder.test.ts`, `tests/integration/v9/exactly-one-closure.test.ts`

### T5.1.1
- **关联需求**: REQ-001~REQ-008
- **关联契约**: all v9 canonical shared types, including `ActivityThread` and `ActivityStep`
- **风险类别**: type drift / local clone / contract mismatch
- **单元测试覆盖**: type/value exports, enum value snapshots, guard DSL validation fixture
- **API接口功能测试覆盖**: not applicable directly; consumed by ops API tests
- **集成/E2E/冒烟覆盖**: INT-S1 typecheck smoke
- **前置数据**: shared-v9-contracts definitions
- **断言**: implementation imports canonical types; no local v9 ledger/activity-thread redefinition in touched modules
- **证据**: `tests/unit/contracts/v9-shared-contracts.test.ts`, `logs/v9-contract-import-search.log`

### T5.1.2
- **关联需求**: REQ-002, REQ-003, REQ-004, REQ-005, REQ-008
- **关联契约**: v9 storage schema and migrations, including activity thread/step rows
- **风险类别**: persistence / migration / legacy compatibility
- **单元测试覆盖**: serializers and row mappers where isolated
- **API接口功能测试覆盖**: data-changing ops commands assert before/after state after schema exists
- **集成/E2E/冒烟覆盖**: fresh bootstrap, activity thread/step persistence including idempotent append/closure linkage, and pre-v9 upgrade; INT-S1
- **前置数据**: fresh DB and v8 DB fixture
- **断言**: v9 tables/columns exist including activity_thread/activity_step; appendActivityThreadProgress create/update/append is idempotent; closure refs link to activity steps; legacy rows readable; no destructive migration
- **证据**: `tests/integration/storage/v9-schema-migration.test.ts`, `reports/v9-schema-shape.md`

### T5.2.1
- **关联需求**: REQ-001, REQ-004, REQ-005, REQ-008
- **关联契约**: Dream output families, projection lifecycle
- **风险类别**: consolidation routing / source grounding / no-content blocker
- **单元测试覆盖**: output family routing, placeholder/no-content rejection, supersede/reject/retire transitions
- **API接口功能测试覆盖**: ops status endpoints later expose produced candidates; no direct API in this task
- **集成/E2E/冒烟覆盖**: Quiet→Dream continuity chain; INT-S2/S3/S4 feed off outputs
- **前置数据**: quiet review with memory/routine/connector/character signals
- **断言**: candidates carry sourceRefs and blocked paths use canonical reasons
- **证据**: `tests/unit/dream/v9-dream-output-families.test.ts`, `tests/integration/v9/quiet-dream-continuity.test.ts`

### T5.2.2
- **关联需求**: REQ-001
- **关联契约**: `SelfContinuityCard` runtime and storage shape
- **风险类别**: context bloat / section order drift / source-free continuity
- **单元测试覆盖**: canonical order, UTF-8 budget, truncation priority, unavailable reason, redaction
- **API接口功能测试覆盖**: `continuity.read` returns card or `continuity_unavailable`
- **集成/E2E/冒烟覆盖**: card read integration; INT-S2/S5
- **前置数据**: active memory/routine/frame pointer fixtures
- **断言**: cardText ≤1200 bytes and preserves summary + characterFramePointer
- **证据**: `tests/unit/memory/v9-self-continuity-card.test.ts`, `tests/integration/v9/self-continuity-card-read.test.ts`

### T5.2.3
- **关联需求**: REQ-003
- **关联契约**: `readLegacyJudgmentVerdictAsAttentionSignal`
- **风险类别**: v8 compatibility / test migration / semantic drift
- **单元测试覆盖**: found/not-found legacy mapping and degraded reason
- **API接口功能测试覆盖**: historical replay read does not enter realtime action path through ops
- **集成/E2E/冒烟覆盖**: INT-S1 legacy adapter smoke
- **前置数据**: v8 `judgment_verdict` row fixture
- **断言**: mapped signal is degraded, no actionable suggestions, reason `v8_legacy_judgment_mapped`
- **证据**: `tests/unit/memory/v9-legacy-judgment-adapter.test.ts`, `reports/v9-judgment-test-migration.md`

### T6.2.1
- **关联需求**: REQ-006
- **关联契约**: `AffordancePosture` access/reliability/familiarity
- **风险类别**: tool truth / stale safety / read-write confusion
- **单元测试覆盖**: scaffold, needs_auth, credentialed, stale, degraded, practiced, routine representative combinations
- **API接口功能测试覆盖**: `loop_status.read` or `connector_evolution.status` exposes real-hand posture via ops read model if surfaced
- **集成/E2E/冒烟覆盖**: real-hand affordance integration; INT-S4
- **前置数据**: probe, execution, scaffold manifest and active routine fixtures
- **断言**: read success does not imply write reliability; NOT_IMPLEMENTED stays scaffold
- **证据**: `tests/unit/body/v9-affordance-posture.test.ts`, `tests/integration/v9/real-hand-affordance.test.ts`

### T6.2.2
- **关联需求**: REQ-004, REQ-007
- **关联契约**: `ToolRoutine`, guard syntax owner, routine invocation trace
- **风险类别**: routine safety / sandbox compliance / rollback readiness
- **单元测试覆盖**: guard syntax, sandbox policy, active/retired mapping, denied invocation
- **API接口功能测试覆盖**: `routine.list/show/rollback` normal and missing routine ID; before/after rollback state
- **集成/E2E/冒烟覆盖**: routine install/invoke chain; INT-S3
- **前置数据**: ProceduralProjection and guard fixtures
- **断言**: invalid guards denied; active routine has version/sourceRefs/rollbackRef/ledgerRef
- **证据**: `tests/unit/body/v9-tool-routine-registry.test.ts`, `tests/integration/v9/tool-routine-install-invoke.test.ts`

### T6.3.1
- **关联需求**: REQ-005, REQ-007
- **关联契约**: connector evolution 7 gates, `ConnectorVersion`, ledger write
- **风险类别**: workspace-only autonomy / gate integrity / activation safety
- **单元测试覆盖**: gate order, representative gate fail, rollback setup required
- **API接口功能测试覆盖**: `connector_evolution.trigger` normal and gate-fail responses
- **集成/E2E/冒烟覆盖**: activation integration; INT-S4
- **前置数据**: scaffold connector plan and fixture workspace
- **断言**: active version only after gates pass; blocked version preserves previous stable
- **证据**: `tests/unit/connectors/v9-connector-evolution-gates.test.ts`, `tests/integration/v9/connector-evolution-activation.test.ts`

### T6.3.2
- **关联需求**: REQ-005, REQ-007
- **关联契约**: `rollbackConnectorVersion`, v8 manifest migration, file lock/atomic write
- **风险类别**: migration truth / rollback recoverability / concurrent file writes
- **单元测试覆盖**: version mapper, lock timeout, rollback missing previous stable
- **API接口功能测试覆盖**: `connector_evolution.rollback` before/after state and invalid version error
- **集成/E2E/冒烟覆盖**: manifest migration + rollback; INT-S4
- **前置数据**: v8 manifest fixtures and connector versions
- **断言**: migrated v8 manifests are candidate, not active; rollback restores previous active version or emits blocked reason
- **证据**: `tests/integration/connectors/v9-manifest-migration.test.ts`, `tests/api/runtime-ops/v9-connector-rollback.test.ts`

### T7.2.1
- **关联需求**: REQ-008
- **关联契约**: `CharacterRefreshInput`, `CharacterSignal`, `CharacterFrame` source-backed五剖面 and validator
- **风险类别**: unnormalized input / fake personality / bilingual emotion claim / identity lock / source-free projection
- **单元测试覆盖**: input normalizer; allowed source family allowlist; raw private/prompt/credential blocker; five section extraction; section ordering; bilingual validator rule IDs with forbidden and allowed counterexamples; conflict notes; char budget
- **API接口功能测试覆盖**: later through `continuity.read` and `loop_status.read` character fields; public output must not expose raw input summaries beyond redacted signal refs
- **集成/E2E/冒烟覆盖**: character from Dream integration; INT-S5
- **前置数据**: closure/tool/feedback/projection/expression outcome fixtures with valid and invalid source families
- **断言**: normalizer emits canonical `CharacterSignal[]`; disallowed source families and raw private/prompt/credential payloads are blocked; no personality scores; scoped emotion/identity/hard-control claims are blocked; safe counterexamples such as security policy wording and context-reader wording pass; insufficient sources defer
- **证据**: `tests/unit/character/v9-character-refresh-input-normalizer.test.ts`, `tests/unit/character/v9-character-frame-builder.test.ts`, `tests/integration/v9/character-frame-from-dream.test.ts`

### T7.2.2
- **关联需求**: REQ-008
- **关联契约**: CharacterFrame lifecycle, `newlyProposed` first-injection, and EmbodiedContext projection
- **风险类别**: stale/rejected frame injection / contest ignored / first-injection overclaim / prompt boundary
- **单元测试覆盖**: status transition matrix, illegal action, `newlyProposed` serializer, reject-after-first-injection, contest prompt templates, accept/reject/revise/retire affordance wording
- **API接口功能测试覆盖**: `continuity.read` shows active/deferred/contested projection states and `newlyProposed` marker when applicable
- **集成/E2E/冒烟覆盖**: character context projection; INT-S5
- **前置数据**: newly proposed accepted/rejected/retired/superseded frame fixtures
- **断言**: first active injection is explicitly contestable via `newlyProposed`; only accepted frames inject active; rejected/retired/superseded produce deferred or unavailable and are not reused as active posture after Agent rejection
- **证据**: `tests/unit/character/v9-character-lifecycle.test.ts`, `tests/integration/v9/character-context-projection.test.ts`

### T8.1.1
- **关联需求**: REQ-007
- **关联契约**: `AutonomousChangeLedgerEntry` write/read port
- **风险类别**: auditability / rollback trace / type drift
- **单元测试覆盖**: entry validation, sourceRefs required, query filters
- **API接口功能测试覆盖**: `connector_evolution.status` and `routine.show` expose ledger refs when available
- **集成/E2E/冒烟覆盖**: ledger integration; INT-S4/S5
- **前置数据**: routine install and connector activation ledger entries
- **断言**: ledger entry is append-only, source-backed, and queryable by target/status/changeKind
- **证据**: `tests/unit/observability/v9-ledger-store.test.ts`, `tests/integration/v9/autonomous-change-ledger.test.ts`

### T8.1.2
- **关联需求**: REQ-007, REQ-008
- **关联契约**: ledger/digest/timeline/character event redaction
- **风险类别**: credential leak / private content leak / prompt leak
- **单元测试覆盖**: sensitive key patterns and structure-preserving redaction
- **API接口功能测试覆盖**: public ops never returns raw sensitive values
- **集成/E2E/冒烟覆盖**: ledger redaction block integration; INT-S5
- **前置数据**: sensitive payload fixtures
- **断言**: credential-shaped payload blocks write and emits `ledger_redaction_blocked`
- **证据**: `tests/unit/observability/v9-redaction-projector.test.ts`, `tests/integration/v9/ledger-redaction-block.test.ts`

### T8.2.1
- **关联需求**: REQ-001, REQ-005, REQ-007, REQ-008
- **关联契约**: loop_status health with activity dimension
- **风险类别**: false healthy / activity runaway masking / gate failure masking / character emotion wording
- **单元测试覆盖**: healthy/degraded/blocked classification, stale/overlong/missing-closure activity thread, pause/complete terminal-state counts, gate failure, routine denied, character deferred, English/Chinese character-safety wording, health-not-psychology wording
- **API接口功能测试覆盖**: `loop_status.read` JSON schema, representative activity degraded/blocked reasons, normal pause/complete visibility, and no English/Chinese emotion/personality/hard-control assertion in public health output
- **集成/E2E/冒烟覆盖**: INT-S5 public health smoke
- **前置数据**: stage event and registry snapshots
- **断言**: stale/overlong/missing-closure activity thread not healthy; paused/completed activity threads are visible as normal terminal states; gate fail/canary fail/rollback fail not healthy; output redacted, non-emotional and not phrased as Agent psychology
- **证据**: `tests/unit/observability/v9-loop-health.test.ts`, `tests/api/runtime-ops/v9-loop-status.test.ts`

### T8.2.2
- **关联需求**: REQ-007
- **关联契约**: rollback liveness watchdog
- **风险类别**: rollback hang / missing event / false degraded
- **单元测试覆盖**: success, explicit failure, timeout inference, heartbeat-count inference
- **API接口功能测试覆盖**: `loop_status.read` sees inferred `rollback_failed` as blocked
- **集成/E2E/冒烟覆盖**: rollback liveness gate; INT-S4
- **前置数据**: rolling_back/gating plan fixture with and without rollback events
- **断言**: inferred event writes `rollback_failed` and overall loop health becomes blocked
- **证据**: `tests/unit/observability/v9-rollback-watchdog.test.ts`, `tests/integration/v9/rollback-liveness-gate.test.ts`

### T8.2.3
- **关联需求**: REQ-001, REQ-008
- **关联契约**: digest/timeline read models
- **风险类别**: operator visibility / redaction / timeline query bounds
- **单元测试覆盖**: digest sections, timeline filter/pagination/window clamp, character event kind whitelist
- **API接口功能测试覆盖**: `digest` and `timeline` ops normal/empty/oversized window requests
- **集成/E2E/冒烟覆盖**: INT-S5 digest/timeline smoke
- **前置数据**: redacted events, ledger rows, character frame events
- **断言**: output contains sourceRefCount and no emotion/personality assertion text
- **证据**: `tests/unit/observability/v9-digest-timeline.test.ts`, `tests/api/runtime-ops/v9-digest-timeline.test.ts`

### INT-S1
- **关联需求**: S1 exit criteria
- **关联契约**: shared contracts, storage schema, legacy adapter
- **风险类别**: Sprint gate / contract spine
- **单元测试覆盖**: no new unit beyond constituent tasks
- **API接口功能测试覆盖**: no direct API in S1
- **集成/E2E/冒烟覆盖**: typecheck + schema migration + legacy adapter smoke
- **前置数据**: S1 tasks complete
- **断言**: all S1 tests pass; blocking bugs listed otherwise
- **证据**: `reports/int-s1-v9-contract-spine.md`, `logs/int-s1-v9-typecheck.log`

### INT-S2
- **关联需求**: REQ-001, REQ-002, REQ-003, REQ-008
- **关联契约**: AttentionSignal, stable identity, ActivityThread, EmbodiedContext, SelfContinuityCard
- **风险类别**: Sprint gate / attention-context-activity chain
- **单元测试覆盖**: no new unit beyond constituent tasks
- **API接口功能测试覆盖**: heartbeat/continuity representative API smoke if T1.2.1 available; otherwise integration-only noted
- **集成/E2E/冒烟覆盖**: repeated feed, attention blocked, context assembly, activity continuation, deadline checks
- **前置数据**: S2 tasks complete
- **断言**: all S2 exit standards pass
- **证据**: `reports/int-s2-v9-attention-context.md`, `logs/int-s2-loop-status.json`

### INT-S3
- **关联需求**: REQ-003, REQ-004, REQ-007
- **关联契约**: action proposal, routine guard, ToolRoutine, closure
- **风险类别**: Sprint gate / routine safety
- **单元测试覆盖**: no new unit beyond constituent tasks
- **API接口功能测试覆盖**: routine ops smoke if T1.2.1 available; otherwise integration-only noted
- **集成/E2E/冒烟覆盖**: allowed/denied routine integration and exactly-one closure
- **前置数据**: S3 tasks complete
- **断言**: permission expansion denied; closure invariant holds
- **证据**: `reports/int-s3-v9-policy-routine.md`

### INT-S4
- **关联需求**: REQ-005, REQ-006, REQ-007
- **关联契约**: affordance, connector evolution, rollback, watchdog
- **风险类别**: Sprint gate / autonomous evolution recovery
- **单元测试覆盖**: no new unit beyond constituent tasks
- **API接口功能测试覆盖**: `connector_evolution.trigger/rollback/status` and `loop_status.read`
- **集成/E2E/冒烟覆盖**: migration/evolution/canary-fail/watchdog scenarios
- **前置数据**: S4 tasks complete
- **断言**: previous stable preserved/restored; blocked reasons visible
- **证据**: `reports/int-s4-v9-connector-evolution.md`, `logs/int-s4-connector-evolution.json`

### INT-S5
- **关联需求**: REQ-001, REQ-007, REQ-008
- **关联契约**: CharacterFrame, loop_status, digest/timeline, ops envelope
- **风险类别**: Sprint gate / public observability / prompt safety
- **单元测试覆盖**: no new unit beyond constituent tasks
- **API接口功能测试覆盖**: `continuity.read`, `loop_status.read`, digest/timeline ops
- **集成/E2E/冒烟覆盖**: character projection, health, redaction and CLI/plugin parity smoke
- **前置数据**: S5 tasks complete
- **断言**: outputs are redacted, source-backed, contestable and non-emotional
- **证据**: `reports/int-s5-v9-character-observability-ops.md`, `logs/int-s5-v9-ops.json`

### INT-S6
- **关联需求**: REQ-001~REQ-008 and release DoD
- **关联契约**: all v9 public contracts and selected v8 compatibility contracts
- **风险类别**: release regression / package integrity
- **单元测试覆盖**: targeted v9 unit suites
- **API接口功能测试覆盖**: targeted runtime-ops API suites
- **集成/E2E/冒烟覆盖**: all INT reports; optional host smoke; selected v8 regression sample
- **前置数据**: S1-S5 passed
- **断言**: typecheck/build/build:plugin/test gates pass; P0/P1 stories complete
- **证据**: `reports/int-s6-v9-release-regression.md`, `logs/int-s6-v9-test.log`, `logs/int-s6-v9-build.log`

---

## 6. Contract Coverage Overlay

| 契约 | 类型 | 实现承接 | 验证承接 | 状态 |
|------|------|----------|----------|:----:|
| v9 canonical shared contracts | 数据结构 / 跨系统协议 | T5.1.1 | T5.1.1 单元 + INT-S1 | ⬜ |
| v9 storage schema and migrations | 持久化结构 | T5.1.2 | T5.1.2 集成 + INT-S1 | ⬜ |
| `AttentionSignal` runtime/storage shape | 数据结构 / 操作契约 | T3.2.1, T5.1.2 | T3.2.1 单元/集成 | ⬜ |
| `ActivityThread` / `ActivityStep` continuation | 数据结构 / 跨 heartbeat 操作契约 | T5.1.1, T5.1.2, T2.2.4 | T2.2.4 单元/集成 + T8.2.1 health API | ⬜ |
| v8 `JudgmentVerdict` legacy mapping | 兼容契约 | T5.2.3 | T5.2.3 单元/回归 | ⬜ |
| Stable evidence identity | 数据变更接口 | T5.1.2, T3.2.2 | T3.2.2 集成 | ⬜ |
| `EmbodiedContext` v9 slices | 跨系统接口 | T2.2.1 | T2.2.1 单元/集成 | ⬜ |
| `SelfContinuityCard` section ordering and budget | 数据结构 / Agent-facing context | T5.2.2, T2.2.1 | T5.2.2 单元/集成 | ⬜ |
| `CharacterRefreshInput` / `CharacterSignal` | Agent-facing input boundary | T7.2.1, T5.1.1 | T7.2.1 normalizer 单元 + T7.2.1 集成 | ⬜ |
| `CharacterFrame` and contest prompt | Agent-facing projection | T7.2.1, T7.2.2 | T7.2.1/T7.2.2 单元/集成；双语 forbidden fixtures；`newlyProposed` lifecycle | ⬜ |
| `ToolRoutineGuardSchema` DSL | 配置 / 安全契约 | T5.1.1, T4.2.2, T6.2.2 | T4.2.2 + T6.2.2 单元/集成 | ⬜ |
| `ActionClosureRecord` exactly-one closure | 操作契约 / 持久化 | T4.2.3 | T4.2.3 集成 | ⬜ |
| `AffordancePosture` access/reliability/familiarity | 跨系统接口 | T6.2.1 | T6.2.1 单元/集成 | ⬜ |
| `ConnectorEvolutionPlan` / `ConnectorVersion` | 文件格式 / 持久化 / 操作契约 | T6.3.1, T6.3.2 | T6.3.1/T6.3.2 集成/API | ⬜ |
| v8 manifest → v9 candidate migration | 兼容契约 | T6.3.2 | T6.3.2 集成 | ⬜ |
| `AutonomousChangeLedgerEntry` | 审计契约 | T8.1.1 | T8.1.1 单元/集成 | ⬜ |
| rollback liveness watchdog | 恢复契约 | T8.2.2 | T8.2.2 单元/集成/API | ⬜ |
| `RuntimeOpsEnvelope` and v9 ops commands | CLI/plugin API | T1.2.1, T1.2.2 | T1.2.1/T1.2.2 API + INT-S5 | ⬜ |
| `loop_status` health including activity continuity | CLI/plugin API / read model | T8.2.1, T1.2.1 | T8.2.1 API + INT-S5 | ⬜ |
| digest/timeline redacted read models | CLI/plugin API / read model | T8.2.3 | T8.2.3 API | ⬜ |

---

## 7. Testing Coverage Overlay

| 测试责任 | 风险类别 | 覆盖方法 | 任务承接 | 测试材料 | 状态 |
|---------|----------|----------|----------|----------|:----:|
| Canonical type drift prevention | 类型漂移 | 单元 + compile + import search | T5.1.1 | `tests/unit/contracts/v9-shared-contracts.test.ts` | ⬜ |
| Storage migration fresh/upgrade | 数据持久化 | 集成 + before/after schema introspection | T5.1.2 | `tests/integration/storage/v9-schema-migration.test.ts` | ⬜ |
| Attention scoring and source blocker | Mind/body 边界 | 单元 + integration | T3.2.1 | `tests/unit/attention/v9-attention-assembler.test.ts` | ⬜ |
| Repeated feed suppression | 数据增长 | 集成 + before/after row count | T3.2.2 | `tests/integration/v9/repeated-feed-suppression.test.ts` | ⬜ |
| Context card/frame injection | Agent-facing context | 单元 + integration | T2.2.1, T5.2.2, T7.2.2 | `tests/integration/v9/context-continuity-injection.test.ts` | ⬜ |
| ActivityThread continuation | Runaway prevention / sustained activity | Unit + integration + API health | T2.2.4, T8.2.1 | `tests/integration/v9/activity-thread-continuation.test.ts` | ⬜ |
| Heartbeat no final judgment and exactly-one closure | Loop semantics | 单元 + integration | T2.2.2, T4.2.3 | `tests/integration/v9/attention-to-closure-chain.test.ts` | ⬜ |
| Routine guard permission expansion | Authority boundary | 单元 + integration | T4.2.2, T6.2.2 | `tests/integration/v9/routine-policy-closure.test.ts` | ⬜ |
| Real-hand affordance truth | Tool truth | 单元 + integration | T6.2.1 | `tests/integration/v9/real-hand-affordance.test.ts` | ⬜ |
| Connector evolution 7 gates | Workspace-only autonomy | 单元 + integration + API | T6.3.1 | `tests/integration/v9/connector-evolution-activation.test.ts` | ⬜ |
| Connector rollback and watchdog | Recovery | 集成 + API + unit watchdog | T6.3.2, T8.2.2 | `tests/integration/v9/rollback-liveness-gate.test.ts` | ⬜ |
| Ledger redaction | Security | Unit + integration + API public output | T8.1.2, T1.2.2 | `tests/integration/v9/ledger-redaction-block.test.ts` | ⬜ |
| CharacterRefreshInput normalizer | Input boundary | Unit allowlist/blocker + integration | T7.2.1 | `tests/unit/character/v9-character-refresh-input-normalizer.test.ts` | ⬜ |
| CharacterFrame validator | Prompt safety | Bilingual unit fixtures + integration | T7.2.1 | `tests/unit/character/v9-character-frame-builder.test.ts` | ⬜ |
| CharacterFrame first-injection contestability | Agent-facing context | Unit lifecycle + integration/API marker | T7.2.2, T2.2.1 | `tests/integration/v9/character-context-projection.test.ts` | ⬜ |
| Agent-boundary rendering | Anti-programming / no Agent controller | Serializer + API forbidden-pattern fixtures | T2.2.1, T7.2.1, T7.2.2, T8.2.1 | `tests/unit/control-plane/v9-context-serializer-boundary.test.ts` | ⬜ |
| Loop health false-healthy prevention | Observability | Unit + API, including activity health and bilingual character wording blocker | T8.2.1 | `tests/api/runtime-ops/v9-loop-status.test.ts` | ⬜ |
| Runtime ops API normal/error cases | API契约 | API接口功能测试 | T1.2.1, T1.2.2 | `tests/api/runtime-ops/v9-ops-surface.test.ts` | ⬜ |
| Sprint/release smoke | Milestone | INT reports + logs | INT-S1~INT-S6 | `reports/int-s*-v9-*.md` | ⬜ |

---

## 8. Verification Traceability Matrix

| REQ/Contract | Task | Verification | Test Material | Evidence | Status |
|---|---|---|---|---|---|
| REQ-001 SelfContinuityCard available/unavailable | T5.2.2, T2.2.1, T1.2.1 | Unit + integration + API | `tests/unit/memory/v9-self-continuity-card.test.ts`, `tests/api/runtime-ops/v9-ops-surface.test.ts` | INT-S2, INT-S5 reports | ⬜ |
| REQ-002 stable evidence identity | T3.2.1, T3.2.2, T5.1.2 | Unit + integration | `tests/integration/v9/repeated-feed-suppression.test.ts` | INT-S2 report | ⬜ |
| REQ-003 attention/activity boundary | T3.2.1, T2.2.2, T2.2.4, T4.2.1, T4.2.3, T8.2.1 | Unit + integration + API | `tests/integration/v9/attention-to-closure-chain.test.ts`, `tests/integration/v9/activity-thread-continuation.test.ts` | INT-S2 report | ⬜ |
| REQ-004 procedural projection/routine | T5.2.1, T4.2.2, T6.2.2, T4.2.3 | Unit + integration + API | `tests/integration/v9/tool-routine-install-invoke.test.ts` | INT-S3 report | ⬜ |
| REQ-005 workspace connector evolution | T5.2.1, T6.3.1, T6.3.2, T1.2.1 | Integration + API | `tests/integration/v9/connector-evolution-activation.test.ts` | INT-S4 report | ⬜ |
| REQ-006 real-hand affordance truth | T6.2.1, T2.2.1 | Unit + integration | `tests/integration/v9/real-hand-affordance.test.ts` | INT-S4 report | ⬜ |
| REQ-007 ledger and rollback | T8.1.1, T8.1.2, T6.3.2, T8.2.2, T1.2.1 | Unit + integration + API | `tests/integration/v9/autonomous-change-ledger.test.ts`, `tests/integration/v9/rollback-liveness-gate.test.ts` | INT-S4/S5 reports | ⬜ |
| REQ-008 CharacterFrame | T7.2.1, T7.2.2, T2.2.1, T8.2.1 | Unit + integration + API | `tests/unit/character/v9-character-refresh-input-normalizer.test.ts`, `tests/unit/character/v9-character-frame-builder.test.ts`, `tests/integration/v9/character-context-projection.test.ts` | INT-S5 report | ⬜ |
| ADR-001 TypeScript/Node/OpenClaw/SQLite stack | T5.1.2, T1.2.1, INT-S6 | Build + integration | storage/API/build tests | build logs | ⬜ |
| ADR-002 Attention not Agent mind | T3.2.1, T2.2.2, T2.2.4, T4.2.1 | Unit + integration | attention, activity and heartbeat tests | INT-S2 report | ⬜ |
| ADR-003 Continuity Projection after Dream | T5.2.1, T5.2.2 | Unit + integration | Dream/card tests | INT-S2 report | ⬜ |
| ADR-004 Workspace-only connector evolution | T6.3.1, T6.3.2, T8.2.2 | Integration + API | connector evolution tests | INT-S4 report | ⬜ |
| ADR-005 Procedural memory as verified routine | T4.2.2, T6.2.2 | Unit + integration | routine guard tests | INT-S3 report | ⬜ |
| ADR-006 Character continuity emergent projection | T7.2.1, T7.2.2, T8.2.1 | Unit + integration + API | character input normalizer, bilingual validator and context tests | INT-S5 report | ⬜ |
| G10 Agent-boundary guardrails | T2.2.1, T7.2.1, T7.2.2, T8.2.1 | Unit + integration + API | context serializer boundary, character validator and loop status tests | INT-S5 report | ⬜ |
| ToolRoutine guard DSL | T5.1.1, T4.2.2, T6.2.2 | Unit + integration | guard DSL and routine tests | INT-S3 report | ⬜ |
| rollback liveness | T6.3.2, T8.2.2 | Unit + integration + API | rollback watchdog tests | INT-S4 report | ⬜ |
| v8 JudgmentVerdict compatibility | T5.1.2, T5.2.3, T3.2.1 | Unit + regression | legacy adapter tests | INT-S1 report | ⬜ |
| Runtime ops command contract | T1.2.1, T1.2.2 | API接口功能测试 | `tests/api/runtime-ops/v9-ops-surface.test.ts` | INT-S5 report | ⬜ |
| Release DoD | INT-S6 | Build + test + regression smoke | `pnpm typecheck`, `pnpm build`, `pnpm build:plugin`, targeted tests | `reports/int-s6-v9-release-regression.md` | ⬜ |
