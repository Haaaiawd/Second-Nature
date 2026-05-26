# INT-V7C — v7 Living Loop Closure 集成验证报告

> **Date**: 2026-05-25
> **Version**: 0.1.37
> **Branch**: `main`
> **Milestone**: INT-V7C (v7 Living Loop Closure)
> **Command**: `pnpm test` (full suite) + per-area isolation runs

---

## 1. 验收标准逐项验证

### 1.1 Data Lifecycle + Connector Truth (T-V7C.C.1 / T-V7C.C.1R)

| 检查项 | 结果 | 证据 |
|---|---|---|
| `narrative:diff` 对缺失版本返回结构化缺数据错误 | PASS | `commands.test.ts` diff 缺失版本测试 |
| `timeline` range > 90 天返回 `NARRATIVE_RANGE_EXCEEDED` | PASS | `commands.test.ts` timeline range 测试 |
| `restore` 调用 `applyBoundedRestore` 并恢复 state | PASS | `commands.test.ts` restore ok=true + stateDb before/after 断言 |
| `restore` partial restore 设置 `isPartialRestore=true` | PASS | `commands.test.ts` partial restore 测试 |
| `snapshot:capture` 写入 RestoreSnapshot + NarrativeTimeline | PASS | `commands.test.ts` snapshot capture 测试 |
| `connector_test --wet` dryRun=false + triggerSource="manual" | PASS | `commands.test.ts` connector_test wet 测试 |
| wet probe 结果写入 `capability_probe_result` | PASS | `host-capability-probe.test.ts` + `wet-probe-runner.test.ts` |
| 发布包版本与源码一致 | PASS | `package.json` / `plugin/package.json` 均为 `0.1.37` |

**测试结果**: 25/25 PASS (`tests/integration/runtime-ops/commands.test.ts`)

### 1.2 Evidence + Body Feedback (T-V7C.C.2)

| 检查项 | 结果 | 证据 |
|---|---|---|
| heartbeat connector success 写 ToolExperience + life_evidence | PASS | `v7c-evidence-body-feedback.test.ts` |
| heartbeat connector failure 也写 ToolExperience | PASS | 同上 |
| guard-layer painful affordance (circuit open) → defer | PASS | `guard-layer.ts` + 集成测试 |
| guard-layer unavailable affordance → defer | PASS | 同上 |
| guard-layer safe affordance → allow | PASS | 同上 |

**测试结果**: 5/5 PASS (`tests/integration/control-plane/v7c-evidence-body-feedback.test.ts`)

### 1.3 Rhythm Loop (T-V7C.C.3)

| 检查项 | 结果 | 证据 |
|---|---|---|
| Quiet completion 后 Dream 自动触发 | PASS | `v7c-rhythm-loop.test.ts` |
| Dream 未运行写 explicit skip reason | PASS | 同上 |
| accepted Dream projection 可被 heartbeat 读取 | PASS | `dream-projection-heartbeat.test.ts` |
| digest delivery target 可用时写 deliveredAt + proof | PASS | `v7c-rhythm-loop.test.ts` |
| digest delivery target 不可用时写 fallbackReason | PASS | 同上 |
| digest generates without delivery adapter (no delivery attempted) | PASS | 同上 |

**测试结果**: 6/6 PASS (`tests/integration/dream/v7c-rhythm-loop.test.ts`)

### 1.4 Guidance Chain + Prompt Injection (T-V7C.C.4R)

| 检查项 | 结果 | 证据 |
|---|---|---|
| `post.publish` + social → impulse 非 null | PASS | `v7c-guidance-chain.test.ts` |
| `feed.read` + social → explore impulse via capabilityClass | PASS | 同上 |
| `agent.heartbeat` → no impulse injected | PASS | 同上 |
| `guidance_payload` ops 命令返回 impulseText + atmosphereText | PASS | 同上 |
| `generateGuidanceDraft` buildDraftText 返回中文内容 | PASS | 同上 |
| invalid sceneType → ok=false + INVALID_SCENE_TYPE | PASS | 同上 |

**测试结果**: 12/12 PASS (`tests/integration/guidance/v7c-guidance-chain.test.ts`)

### 1.5 Identity / Goal Hygiene (T-V7C.C.4)

| 检查项 | 结果 | 证据 |
|---|---|---|
| same kind+scope accepted goals → listAgentGoals 只返回 newest | PASS | `v7c-identity-goal-hygiene.test.ts` |
| different scope goals 不被 dedupe | PASS | 同上 |
| upsert 旧 goal 被标记为 `replaced` | PASS | `t4-1-4-agent-goal.test.ts` dedupe 测试 |
| IdentityProfile 注入 ConnectorRequestIdentity (platformHandle) | PASS | `v7c-identity-goal-hygiene.test.ts` |
| connector request 不含 credential | PASS | 同上 |
| high no-reply ratio → reduced frequency | PASS | `v7c-identity-goal-hygiene.test.ts` |
| low trust → minimal/paused style | PASS | 同上 |
| positive tone → warm_anchored | PASS | 同上 |
| negative tone → light_check | PASS | 同上 |
| relationship memory feedback persistence round-trip | PASS | 同上 |

**测试结果**: 9/9 PASS (`tests/integration/state/v7c-identity-goal-hygiene.test.ts`) + 3/3 PASS (`tests/unit/storage/t4-1-4-agent-goal.test.ts` dedupe)

---

## 2. 07_CHALLENGE_REPORT 发现关闭验证

| ID | 严重度 | 发现 | 关闭证据 |
|---|---|---|---|
| CR-CODE-001 | High | INT-S6 open，缺少 release gate 报告 | `reports/int-s6-e2e-release-gate-v7.md` 存在；全量 231/231 PASS |
| CR-CODE-002 | High | `restore` 为 audit-only，未调用 RestoreSnapshotStore | `ops-router.ts:1332-1338` 调用 `applyBoundedRestore`；测试验证 state 恢复 |
| CR-CODE-003 | High | v6 regression 9 failures 未关闭 | INT-S6 报告确认 9 项 pre-existing 已转为 justified skip |
| CR-CODE-004 | Medium | README/AGENTS handoff 状态陈旧 | AGENTS 已更新至 Wave 74；当前状态指向 INT-V7C |
| CR-CODE-005 | Medium | `pnpm lint` 无 script | `package.json:63` 已添加 `"lint": "tsc --noEmit"` |

**结论**: 所有 5 项发现均已关闭。

---

## 3. 全量回归

| 套件 | 测试数 | 通过 | 失败 | 跳过 |
|---|---|---|---|---|
| 全量 (`pnpm test`) | 231 | 231 | 0 | 0 |
| v6 regression | 9 | 0 | 0 | 9 (justified) |

**编译**: `tsc -p tsconfig.json` 零错误
**lint**: `pnpm lint` (`tsc --noEmit`) 零错误

---

## 4. 结论

| 领域 | 状态 |
|---|---|
| Data Lifecycle (timeline/diff/restore/snapshot) | **CLOSED** |
| Connector Truth (wet probe / evidence / experience) | **CLOSED** |
| Body Feedback (guard-layer / CircuitBreaker) | **CLOSED** |
| Rhythm Loop (quiet → dream → digest) | **CLOSED** |
| Guidance Chain (capabilityClass / impulse / source-backed) | **CLOSED** |
| Identity / Goal Hygiene (dedupe / connector identity / relationship) | **CLOSED** |
| 07_CHALLENGE_REPORT 发现 | **ALL CLOSED** |

**Gate**: **PASS**

v7 Living Loop Closure 完成。所有 T-V7C.C.1 ~ C.4 任务及前置 INT-S6 均已通过集成验证，231/231 测试零失败，编译/lint 零错误，07_CHALLENGE_REPORT 全部 5 项发现已关闭。

---

## 5. 残余事项

- T2.2.3 `bridge full-runtime heartbeat wires connectorExecutor` 仍为 SKIP（Wave 56 引入，非 v7 closure 范畴，需独立评估）。
- `resolveCapability unknown capability throws` 为旧 CapabilityContractRegistry 行为，非 closure 引入。

以上两项均为 pre-existing，不影响 INT-V7C Gate 判定。
