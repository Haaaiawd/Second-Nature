# Wave 52 Review — T-SMS.C.6 + T-SMS.C.7 + T-CS.C.2 + T-CS.C.3

## 最高严重度

none

## 变更清单

| 文件 | 变更 |
|------|------|
| `src/storage/services/restore-snapshot-store.ts` | 新增：RestoreSnapshotStore（6 类 entity 白名单 + 默认排除 sensitive kinds + 3 版 retention） |
| `src/storage/services/runtime-secret-anchor-store.ts` | 新增：RuntimeSecretAnchorStore（只存 locationRef/health/rotationPolicyRef，gate 拒绝 key 明文） |
| `src/storage/services/diary-dream-store.ts` | 新增：DiaryDreamStore（DailyDiary UPSERT by day + DreamOutput append + lifecycle 状态机） |
| `src/storage/services/history-digest-store.ts` | 新增：HistoryDigestStore（NarrativeTimeline append-only + HeartbeatDigest day-keyed UPSERT） |
| `src/connectors/base/wet-probe-runner.ts` | 新增：WetProbeRunner（HTTP GET safe endpoint + strict idempotencyClass → probe_policy_denied） |
| `src/connectors/base/effect-commit-ledger-sqlite.ts` | 新增：EffectCommitLedger SQLite 实现（idempotency-key UNIQUE + 进程重启存活） |
| `src/connectors/base/structured-unavailable-reason.ts` | 新增：7 类 reason code Builder + factory 函数 |
| `src/connectors/base/contract.ts` | 更新：ConnectorResult 新增 `executionId?: string`（T-CS.C.3） |
| `src/shared/types/v7-entities.ts` | 更新：DreamOutput 新增 `createdAt?: string` |
| `src/storage/db/migrations/v7-001-foundation.ts` | 更新：`daily_diary_index.day` + `heartbeat_digest.day` 添加 UNIQUE 约束 |
| `src/storage/db/migrations/v7-002-effect-commit-ledger.ts` | 新增：effect_commit_ledger 表 + 索引 |
| `src/storage/db/migrations/index.ts` | 更新：注册 v7-002 迁移 |

## 回归检查

- 已运行 `node --test dist/tests/unit/**/*.test.js`
- **预先存在失败**: `resolveCapability unknown capability throws` (`tests/unit/connectors/t3-1-2-capability-registry.test.ts:97`) — 旧 `CapabilityContractRegistry` 在 namespace 模式下不验证 capability 是否在 supportedCapabilities 中，与 `manifest.ts` 代码行为一致，非 Wave 52 引入
- 其余测试全部通过

## 测试矩阵

| 测试文件 | 通过 | 失败 |
|---------|:----:|:----:|
| `tests/unit/storage/restore-snapshot-store.test.ts` | 7 | 0 |
| `tests/unit/storage/runtime-secret-anchor-store.test.ts` | 4 | 0 |
| `tests/unit/storage/diary-dream-store.test.ts` | 6 | 0 |
| `tests/unit/storage/history-digest-store.test.ts` | 4 | 0 |
| `tests/unit/connectors/wet-probe-runner.test.ts` | 5 | 0 |
| `tests/unit/connectors/effect-commit-ledger-sqlite.test.ts` | 5 | 0 |
| `tests/unit/connectors/structured-unavailable-reason.test.ts` | 10 | 0 |
| **合计** | **41** | **0** |

## 设计一致性

- T-SMS.C.6: RestoreSnapshot entity 白名单 = 6 类（ADR-007, DR-017）；excludedSensitiveKinds 默认值 5 类；retention = 3
- T-SMS.C.7: DreamOutput VALID_TRANSITIONS 状态机与 PRD 一致（candidate→accepted→archived）；partial 为终端状态
- T-CS.C.2: WetProbeRunner 严格遵循 DR-006 双重验证（idempotencyClass check + safeEndpoint）；EffectCommitLedger 实现 `EffectCommitLedgerPort` 接口
- T-CS.C.3: 7 类 reason code 全覆盖（credentials_missing / not_registered / trust_denied / circuit_open / platform_error / probe_failed / probe_policy_denied）；ConnectorResult.executionId 新增

## 安全与治理

- RuntimeSecretAnchorStore 通过 WriteValidationGate 扫描 key 明文（sensitivityScan 的 32+ 字符 API key 模式）
- RestoreSnapshot 自动排除 credential/raw_private_message/raw_prompt/encryption_key/session_token
- WetProbeRunner 对 strict idempotencyClass 绝不执行 HTTP

## 下一步

- T-SMS.C.6~C.7 + T-CS.C.2~C.3 全部完成
- 05A: 对应任务打勾
- 下一波 Wave 53 候选：T-BTS.C.1 (AffordanceAssembler) 或 INT-S2 (S2 集成验证)
