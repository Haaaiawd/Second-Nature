# INT-S5 Observability 集成验证报告 — v7

**报告日期**: 2026-05-23  
**分支**: feature/v7-wave61-dqs-c3  
**测试文件**: `tests/integration/s5-exit/int-s5-observability.test.ts`  
**构建命令**: `pnpm build && node --test dist/tests/integration/s5-exit/int-s5-observability.test.js`  
**结果**: **22/22 通过，0 失败**

---

## 退出标准验证

| # | 标准 | 任务 | 状态 | 覆盖 |
|---|------|------|------|------|
| 1 | Audit chain 完整性可验证 | T-OBS.C.1 | PASS | 4 tests |
| 2 | SelfHealthSnapshot 最小维度集完整 + 探针超时隔离 | T-OBS.C.2 | PASS | 3 tests |
| 3 | HeartbeatDigest 按平台分类计数正确 + nothing_significant | T-OBS.C.3 | PASS | 3 tests |
| 4 | NarrativeTimeline cursor 分页正常 + 90 日范围限制 | T-OBS.C.5 | PASS | 3 tests |
| 5 | RestoreAudit 每次写入 + partial_restore_error 记录实体列表 | T-OBS.C.6 | PASS | 4 tests |
| 6 | RuntimeSecretAnchorView 三种 reasonCode 均含 recoverySteps | T-OBS.C.7 | PASS | 5 tests |

---

## 测试详情

### Suite 1 — Audit Chain Integrity (T-OBS.C.1)

| 用例 | 结果 |
|------|------|
| per-family hash chain links correctly across 5 events | PASS |
| detects chain corruption: previousHash mismatch throws | PASS |
| seedFamilyHash enables backfill after process restart | PASS |
| two families maintain independent chains | PASS |

**关键验证**:
- `AppendOnlyAuditStore.append()` 对 `previousHash` 做链式验证，mismatch 时 throw `audit_previous_hash_mismatch`
- 不同 family 各维护独立 hash cache（per-family O(1) lookup）
- `seedFamilyHash()` 支持进程重启后回填 DB 最新 hash

### Suite 2 — SelfHealthSnapshot (T-OBS.C.2)

| 用例 | 结果 |
|------|------|
| minimum required dimensions all present in snapshot | PASS |
| single probe timeout does not block overall snapshot | PASS |
| dynamic probe registration works | PASS |

**关键验证**:
- `MINIMUM_REQUIRED_DIMENSIONS` 中的所有维度均出现在 snapshot
- 100ms timeout 的 slow probe 在 ~100ms 后返回 `unknown`，不阻塞其他探针
- 动态注册 `custom_v7_dim` 后立即出现在 snapshot 且状态为 `healthy`

### Suite 3 — HeartbeatDigest (T-OBS.C.3 + T-OBS.C.4)

| 用例 | 结果 |
|------|------|
| per-platform counts correct for connector attempts | PASS |
| nothing_significant on empty audit store | PASS |
| digest does not contain credential / raw payload fields | PASS |

**关键验证**:
- moltbook: success=2, failure=1, circuitOpen=1（正确聚合）
- instreet: blocked=1（正确聚合）
- 空 audit store → `isNothingSignificant = true`, `connectorSummary.length = 0`
- digest JSON 不含 `password`, `raw_payload`, `private_message`, `Bearer ` 等禁止字段

### Suite 4 — NarrativeTimeline (T-OBS.C.5)

| 用例 | 结果 |
|------|------|
| cursor pagination returns correct pages | PASS |
| 90-day range exceeded throws NarrativeQueryRangeError | PASS |
| narrativeDiff returns field-level changes between two versions | PASS |

**关键验证**:
- page1 返回 10 条，带 nextCursor；page2 无重叠
- 91 天范围抛出 `NarrativeQueryRangeError`（精确类型匹配）
- `queryNarrativeDiff(v1, v3)` 返回含 `changes` 数组的 diff 对象

### Suite 5 — RestoreAudit (T-OBS.C.6)

| 用例 | 结果 |
|------|------|
| successful restore writes audit with from/to/reason | PASS |
| partial_restore_error records completed and failed entity lists | PASS |
| credential field value never written to audit | PASS |
| audit write failure is fire-and-forget (returns ok:true + warning) | PASS |

**关键验证**:
- `writeRestoreAudit()` 写入后 `store.list().length === 1`，payload 含 fromVersion/toVersion/reason
- partial restore: `completedEntities=["goal"]`, `failedEntities=["evidence","relationship"]`, `isPartialRestore=true`
- `excludedFields` 仅记录字段名，不写入 credential 值
- store.append() throw 后函数返回 `{ ok: true, warnings: ["...simulated_db_write_failure..."] }`（fire-and-forget）

### Suite 6 — RuntimeSecretAnchorView (T-OBS.C.7)

| 用例 | 结果 |
|------|------|
| healthy anchor returns verified status | PASS |
| wrong key returns credential_recovery_required + recoverySteps | PASS |
| decrypt error returns runtime_secret_unavailable + recoverySteps | PASS |
| missing key path returns runtime_secret_anchor_missing | PASS |
| anchor view never contains encryption key plaintext | PASS |

**关键验证**:
- 三种 reasonCode 均有 recoverySteps（非空数组）
- view JSON 不含 `sk-`, `Bearer ` 等 credential 明文

---

## 结论

INT-S5 所有 6 项退出标准均已通过。S5 Observability 阶段正式完成，满足进入 S6 Runtime Ops 阶段的前置条件。
