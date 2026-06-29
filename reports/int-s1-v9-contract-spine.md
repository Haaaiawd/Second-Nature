# INT-S1 — v9 S1 Contract Spine 集成验证报告

**项目**: Second Nature  
**架构版本**: `.anws/v9`  
**日期**: 2026-06-23  
**触发**: Wave 119 `/forge` 完成 T5.1.1 / T5.1.2 / T5.2.3 后执行 S1 退出门  

---

## 验证范围

| 任务 | 验证重点 |
|------|----------|
| T5.1.1 | v9 shared contracts 编译通过；canonical types 导出完整；guard DSL / reason code / 边界类型可构造 |
| T5.1.2 | v9 schema fresh bootstrap 与 v8 升级迁移通过；activity thread/step 持久化与幂等更新 |
| T5.2.3 | v8 `judgment_verdict` → v9 `AttentionSignal` 映射返回 degraded、无 action suggestions、reason = `v8_legacy_judgment_mapped` |

---

## 执行命令与证据

### 1. 编译检查

```bash
pnpm typecheck
```

**结果**: ✅ 通过（无错误、无警告）

### 2. v9 Shared Contracts 单元测试

```bash
node --test dist/tests/unit/contracts/v9-shared-contracts.test.js
```

**结果**: 14/14 PASS

覆盖点：
- 导出无本地重定义
- `AttentionSignal` body-attention 边界（`possibleActions` 不含最终 judgment）
- `ActivityThread` bounded step scaffold
- `SelfContinuityCard` canonical section ordering
- `CharacterRefreshInput` source-backed / redaction 字段
- `ToolRoutineGuardSchema` DSL canonical version
- `ConnectorEvolutionPlan` / `ConnectorVersion` `GateResult` 共享
- `AutonomousChangeLedgerEntry` source refs 要求
- `ActionClosureRecord` provenance tiers
- `EmbodiedContext` v9 slices
- `EvidenceItem` 身份字段（`observedAt` 不参与 logical key）
- `ActionProposal` authoring boundary
- `CharacterFrame` contestable lifecycle
- `V9ReasonCode` attention + legacy 覆盖

### 3. v9 Storage Schema 集成测试

```bash
node --test dist/tests/integration/storage/v9-schema-migration.test.js
```

**结果**: 7/7 PASS

覆盖点：
- Fresh bootstrap 创建 10 个 v9 表
- `evidence_item` v9 identity 列存在
- `action_closure_record` v9 linkage 列存在
- Migration 在已有 v8 DB 上幂等
- AttentionSignal 写入/读取；缺失 sourceRefs 被拒绝
- ActivityThread 写入 + step append + progress update

### 4. Legacy Judgment Adapter 单元测试

```bash
node --test dist/tests/unit/memory/v9-legacy-judgment-adapter.test.js
```

**结果**: 3/3 PASS

覆盖点：
- 存在 v8 judgment row → degraded AttentionSignal
- 缺失 id → `not_found`
- `riskPosture` 映射保持 high/low

### 5. 构建与插件包

```bash
pnpm build
pnpm build:plugin
```

**结果**: ✅ build 通过；`build:plugin` 通过

---

## 发现与处理

| 严重度 | 发现 | 处理 |
|--------|------|------|
| 无 | 无阻塞问题 | — |

---

## 残留待跟进

- 无

---

## 结论

S1 Contract Spine 集成门 **通过**。v9 shared contracts、storage schema/migration、v8 legacy adapter 已就绪，可进入 S2 Attention + Context 实现。
