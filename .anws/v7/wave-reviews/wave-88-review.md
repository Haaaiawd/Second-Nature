# Wave 88 Review — T-CS.C.10 evomap Connector 真实 Runner 接入

| 项 | 值 |
| -- | -- |
| Wave | 88 |
| 任务 ID | T-CS.C.10 |
| 分支 @ HEAD | `main` |
| code-reviewer 文件 | 本文件 |
| 最高严重度 | none |
| 残留待跟进 | 无 |
| E2E | N/A |
| 本波可进 Step 4 | 是 |

---

## 变更摘要

### 目标
将 evomap 执行分支从 `not_implemented` 占位替换为真实 `createEvoMapRunner` 调用，实现 `EvoMapSecretPort` 持久化、HTTP fetch 函数，并读取 `SECOND_NATURE_EVOMAP_BASE_URL`。

### 产出
- **`src/connectors/services/connector-executor-adapter.ts`**
  - 导入 `createEvoMapRunner` / `EvoMapSecretPort`
  - 导出 `createEvoMapSecretPort`：复用 credential vault 存储 `evomap_node_secret`，`loadCredentialContext` 已自动解密，secretPort 直接返回明文
  - `fetchEvoMapJson` / `joinEvoMapUrl`：类 `fetchAgentWorldJson` 的 HTTP 辅助函数，支持 `nodeSecret` Bearer 鉴权
  - evomap 执行分支替换：未配置 base URL → `configuration_missing`；已配置 → 组装 `EvoMapApiClient` + `EvoMapA2AClient` + `secretPort` 并执行
- **`src/connectors/base/failure-taxonomy.ts`**
  - 新增 `configuration_missing` FailureClass 与 `classifyFailure` 映射（支持 evomap/agent-world 配置缺失场景）
- **`tests/unit/connectors/evomap-runner.test.ts`**
  - 6 个单元测试：register/heartbeat/discover/claim/missing_secret/unsupported_intent
- **`tests/integration/connectors/evomap-secret-port.test.ts`**
  - 2 个集成测试：configuration_missing 语义、secret port save/load round-trip

---

## 验证结果

### 新增测试
```
node --test dist/tests/unit/connectors/evomap-runner.test.js
node --test dist/tests/integration/connectors/evomap-secret-port.test.js
# tests 8 / pass 8 / fail 0
```

| 测试名 | 结果 |
| ------ | ---- |
| T-CS.C.10-G: evomap configuration_missing when base URL unset | ✅ |
| T-CS.C.10-H: secret port saveNodeSecret / loadNodeSecret round-trip | ✅ |
| T-CS.C.10-A: agent.register via a2a saves node_secret | ✅ |
| T-CS.C.10-B: agent.heartbeat via api_rest with node_secret | ✅ |
| T-CS.C.10-C: work.discover via a2a with node_secret | ✅ |
| T-CS.C.10-D: task.claim via api_rest with node_secret | ✅ |
| T-CS.C.10-E: missing node_secret throws verification_required | ✅ |
| T-CS.C.10-F: unsupported intent throws protocol_mismatch | ✅ |

### 回归测试
```
node --test dist/tests/integration/connectors/moltbook-mock-runner.test.js
node --test dist/tests/integration/connectors/life-evidence-chain.test.js
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
| Given `SECOND_NATURE_EVOMAP_BASE_URL` 未设置 / When 执行 evomap 任意 intent / Then 返回 `error.code: "configuration_missing"`（非 `"not_implemented"`） | ✅ T-CS.C.10-G |
| Given base URL 已设置且 node_secret 已存在 / When 执行 `agent.heartbeat` / Then 向配置 URL 发送真实 HTTP 请求 | ✅ runner 组装验证（T-CS.C.10-B） |
| Given `agent.register` 成功 / When `saveNodeSecret` 后 / Then `loadNodeSecret` 可读回 node_secret | ✅ T-CS.C.10-H |
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

- **T-ROS.C.6**（依赖 T-CS.C.10）：Delivery Target 真实探测（替换硬编码 unknown）。
