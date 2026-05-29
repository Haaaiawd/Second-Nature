# Wave 86 Review — T-CS.C.8 Life Evidence 端到端写入集成验证

| 项 | 值 |
| -- | -- |
| Wave | 86 |
| 任务 ID | T-CS.C.8 |
| 分支 @ HEAD | `main` |
| code-reviewer 文件 | 本文件 |
| 最高严重度 | none |
| 残留待跟进 | 无 |
| E2E | N/A（本波为集成测试；实机 DB growth 待 T-V7C.C.6 范围验证） |
| 本波可进 Step 4 | 是 |

---

## 变更摘要

### 目标
以 T-CS.C.7 修复为基础，验证完整链路：moltbook mock runner → policy layer → `ConnectorResult` → `mapLifeEvidence` → `appendLifeEvidence` → `life_evidence_index` DB 增长。

### 产出
- **新增集成测试文件**: `tests/integration/connectors/life-evidence-chain.test.ts`
  - `T-CS.C.8-A`：完整链路验证（executor → policy → mapLifeEvidence → appendLifeEvidence → DB row + artifact）
  - `T-CS.C.8-B`：policy-layer 包裹与 `extractSourceRefs` 递归对齐验证
  - `T-CS.C.8-C`：`feed.read` 返回 `platform_browse` evidenceType candidate 验证

### 关键发现
- policy-layer 返回的 `ConnectorResult.data` 结构为 `{capability, channel, data: {source, items}}`，`extractSourceRefs` 的 `record.data` 递归穿透已正确覆盖此层级，无需额外修复。
- `mapLifeEvidence` 对真实 executor 返回的 policy-wrapped payload 能正常生成非 null candidate。
- `appendLifeEvidence` 对 `:memory:` 和真实 workspace 路径均能正确写入 SQLite row + JSON artifact。

---

## 验证结果

### 新增集成测试
```
node --test dist/tests/integration/connectors/life-evidence-chain.test.js
# tests 3 / pass 3 / fail 0
```

| 测试名 | 结果 |
| ------ | ---- |
| T-CS.C.8-A: full chain produces life_evidence_index row and artifact | ✅ |
| T-CS.C.8-B: policy-wrapped payload is penetrated by extractSourceRefs | ✅ |
| T-CS.C.8-C: feed.read returns platform_browse evidenceType candidate | ✅ |

### 回归测试
```
node --test dist/tests/integration/connectors/t3-3-1-real-connector-evidence.test.js
node --test dist/tests/integration/connectors/moltbook-mock-runner.test.js
# tests 6 / pass 6 / fail 0
```

### 编译检查
```
pnpm lint (tsc --noEmit)
# 零类型错误
```

---

## 验收标准对照

| 验收标准 | 状态 |
| -------- | ---- |
| Given moltbook mock runner 已配置 / When 触发 feed.read 执行 / Then `life_evidence_index` 行数在执行后增加（DB before/after） | ✅ T-CS.C.8-A |
| Given policy layer 包裹 ConnectorResult.data / When extractSourceRefs 递归 / Then 识别内层平台数组 | ✅ T-CS.C.8-B |
| Given `feed.read` intent 成功 / When `mapLifeEvidence` 处理 / Then 返回 `evidenceType: "platform_browse"` 的非 null candidate | ✅ T-CS.C.8-C |

---

## 严重度评估

- **Critical**: 0
- **High**: 0
- **Medium**: 0
- **Low**: 0

---

## 残留待跟进

无。

---

## 下一步

- **T-CS.C.9**（依赖本波）：instreet connector 接线 — 注册 + platform_unavailable 标记。
