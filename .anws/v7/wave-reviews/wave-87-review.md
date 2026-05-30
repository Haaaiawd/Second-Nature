# Wave 87 Review — T-CS.C.9 instreet Connector 接线

| 项 | 值 |
| -- | -- |
| Wave | 87 |
| 任务 ID | T-CS.C.9 |
| 分支 @ HEAD | `main` |
| code-reviewer 文件 | 本文件 |
| 最高严重度 | none |
| 残留待跟进 | 无 |
| E2E | N/A |
| 本波可进 Step 4 | 是 |

---

## 变更摘要

### 目标
在 executor adapter 中注册 instreet manifest，并添加执行分支返回结构化 `platform_unavailable`（而非 `unknown_platform`），使 affordance assembler 能感知 instreet 已注册。

### 产出
- **`src/connectors/services/connector-executor-adapter.ts`**
  - 导入 `instreetManifest`
  - `registry.register({ ...instreetManifest })`
  - `createAdaptiveExecutionRunner` 新增 instreet 分支：返回 `{code: "platform_unavailable", detail: "instreet_requires_skill_browser_channel"}`
- **`src/connectors/base/failure-taxonomy.ts`**
  - 新增 `platform_unavailable` FailureClass
  - `classifyFailure` 映射 `code === "platform_unavailable"` → `class: "platform_unavailable"`
- **`tests/unit/connectors/instreet-registration.test.ts`**
  - T-CS.C.9-A：registry capability 解析验证
  - T-CS.C.9-B：执行返回 `platform_unavailable`
  - T-CS.C.9-C：不返回 `unknown_platform`

---

## 验证结果

### 新增单元测试
```
node --test dist/tests/unit/connectors/instreet-registration.test.js
# tests 3 / pass 3 / fail 0
```

| 测试名 | 结果 |
| ------ | ---- |
| T-CS.C.9-A: instreet manifest resolves capability in registry | ✅ |
| T-CS.C.9-B: instreet execution returns platform_unavailable | ✅ |
| T-CS.C.9-C: instreet execution does not return unknown_platform | ✅ |

### 回归测试
```
node --test dist/tests/integration/connectors/moltbook-mock-runner.test.js
node --test dist/tests/integration/connectors/policy-layer.test.js
# tests 7 / pass 7 / fail 0
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
| Given instreet 已注册 / When `resolveCapability("instreet", "notification.list")` / Then 返回 ResolvedConnectorCapability（非 not_registered） | ✅ T-CS.C.9-A |
| Given instreet 执行分支触发 / When executor 处理 instreet 请求 / Then 返回 `success: false, error.code: "platform_unavailable"` | ✅ T-CS.C.9-B |
| Given `pnpm typecheck` / When 编译 / Then 无新增类型错误 | ✅ lint 通过 |

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

- **T-CS.C.10**（依赖本波）：evomap connector 接线 — 真实 runner 接入（替换 `not_implemented` 占位）。
