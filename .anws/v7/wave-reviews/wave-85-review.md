# Wave 85 Review — T-CS.C.7 Life Evidence 链路修复

| 项 | 值 |
| -- | -- |
| Wave | 85 |
| 任务 ID | T-CS.C.7 |
| 分支 @ HEAD | `main` |
| code-reviewer 文件 | 本文件 |
| 最高严重度 | none |
| 残留待跟进 | 无 |
| E2E | N/A（本波为单元测试 + 回归；T-CS.C.8 将做端到端 DB growth 验证） |
| 本波可进 Step 4 | 是 |

---

## 变更摘要

### 问题
`extractSourceRefs`（`src/connectors/base/map-life-evidence.ts`）只识别 `sourceRefs` 和 `items` 数组字段。真实平台 API 返回的数据使用 `posts`/`agents`/`nodes`/`edges`/`results`/`entries` 等通用数组字段，导致 moltbook `{posts: [...]}` 和 agent-world `{agents: [...]}` 等返回无法生成有效 SourceRef，进而 `mapLifeEvidence` 返回 `null`，life evidence 永远无法写入。

### 修复
1. **新增 `PLATFORM_ARRAY_KEYS`**：`posts`, `nodes`, `agents`, `edges`, `results`, `entries`
2. **新增 `extractFromPlatformArray`**：遍历上述字段，提取数组元素中的 `id`（必需）和 `url`/`uri`/`link`（可选，用于构造 URI）。无 URL 时回退到 `platform://{platformId}/item/{id}`。
3. **保持递归穿透**：`record.data` 嵌套递归逻辑不变，确保 policy-layer 包裹的 `{capability, channel, data: {posts: [...]}}` 能正确到达。
4. **保持回归兼容**：`sourceRefs` 和 `items` 原有分支顺序和逻辑未变，仅在上述分支均不匹配时才尝试平台数组。

### 修改文件
- `src/connectors/base/map-life-evidence.ts` — 新增平台数组识别（+49 行）
- `tests/unit/connectors/t3-3-1-evidence-mapper.test.ts` — 新增 5 个测试用例

---

## 验证结果

### 单元测试
```
node --test dist/tests/unit/connectors/t3-3-1-evidence-mapper.test.js
# tests 10 / pass 10 / fail 0
```

| 测试名 | 结果 |
| ------ | ---- |
| T3.3.1 success result with sourceRefs maps to LifeEvidenceCandidate | ✅ |
| T3.3.1 empty data returns null | ✅ |
| T3.3.1 policy-wrapped connector payload maps nested data items | ✅ |
| T3.3.1 failure status returns null | ✅ |
| T3.3.1 missing sourceRefs returns null | ✅ |
| **T-CS.C.7 moltbook posts array generates sourceRefs** | ✅ |
| **T-CS.C.7 agent-world agents array generates sourceRefs** | ✅ |
| **T-CS.C.7 deeply nested data posts array is reached through recursion** | ✅ |
| **T-CS.C.7 legacy sourceRefs path still works (regression)** | ✅ |
| **T-CS.C.7 legacy items path still works (regression)** | ✅ |

### 回归测试
```
node --test dist/tests/unit/connectors/connector-manifest-and-evidence-map.test.js
# tests 5 / pass 5 / fail 0
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
| Given moltbook feed.read 返回 `{posts: [{id, url}]}` / When `extractSourceRefs` 处理 / Then 返回 SourceRef 数组且长度 > 0 | ✅ 测试覆盖 |
| Given agent-world feed.read 返回 `{agents: [{id}]}` / When `extractSourceRefs` 处理 / Then 返回 SourceRef 数组且长度 > 0 | ✅ 测试覆盖 |
| Given 深层嵌套 `{data: {posts: [...]}}` / When `extractSourceRefs` 递归 / Then 正确穿透并识别 posts 数组 | ✅ 测试覆盖 |
| Given 已有 sourceRefs/items 字段 / When 处理 / Then 不破坏原有分支逻辑（回归） | ✅ 测试覆盖 |

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

- **T-CS.C.8**（依赖本波）：Life Evidence 端到端写入集成验证 — 验证 heartbeat → policy layer → mapLifeEvidence → appendLifeEvidence → `life_evidence_index` DB growth 完整链路。
