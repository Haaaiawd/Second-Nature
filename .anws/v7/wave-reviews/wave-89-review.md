# Wave 89 Review — T-ROS.C.6 Delivery Target 真实探测

| 项 | 值 |
| -- | -- |
| Wave | 89 |
| 任务 ID | T-ROS.C.6 |
| 分支 @ HEAD | `main` |
| code-reviewer 文件 | 本文件 |
| 最高严重度 | none |
| 残留待跟进 | 无 |
| E2E | N/A |
| 本波可进 Step 4 | 是 |

---

## 变更摘要

### 目标
替换 `ops-router.ts` 中 `checkDeliveryTarget` 的硬编码 `{status: "unknown", evidenceRefs: []}`，改为扫描 workspace connector manifest 中是否声明 `message.send`/`comment.reply` 能力，返回真实的 `target_available`/`target_none` 状态。

### 产出
- **`src/cli/ops/ops-router.ts`**
  - 导入 `scanConnectorManifests` + `parseConnectorManifestV6`
  - `createStaticUnknownAdapter` 新增 `workspaceRoot?: string` 参数
  - `checkDeliveryTarget` 实现：
    - 无 `workspaceRoot` → `target_none` + `reason: "no_workspace_root_provided"`
    - 扫描 `.second-nature/connectors/*/manifest.yaml`
    - manifest 声明 `message.send`/`comment.reply` → `target_available` + evidenceRefs（指向 manifest 文件）
    - 无匹配 manifest → `target_none` + `reason: "no_delivery_connector_found_in_workspace"`
  - `capability_probe` 命令 dispatch 传入 `deps.workspaceRoot`
- **`tests/unit/cli/delivery-target-probe.test.ts`**
  - 3 个测试：workspace 有 delivery / 无 delivery / 无 workspaceRoot

---

## 验证结果

### 新增单元测试
```
node --test dist/tests/unit/cli/delivery-target-probe.test.js
# tests 3 / pass 3 / fail 0
```

| 测试名 | 结果 |
| ------ | ---- |
| T-ROS.C.6-A: workspace with message.send returns target_available | ✅ |
| T-ROS.C.6-B: workspace without delivery connector returns target_none | ✅ |
| T-ROS.C.6-C: no workspaceRoot returns target_none | ✅ |

### 回归测试
```
node --test dist/tests/integration/connectors/life-evidence-chain.test.js
node --test dist/tests/integration/connectors/moltbook-mock-runner.test.js
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
| Given workspace 有 message.send 能力的 connector manifest / When `checkDeliveryTarget()` / Then 返回 `status: "available"` 且 evidenceRefs 非空 | ✅ T-ROS.C.6-A |
| Given workspace 无 delivery connector / When `checkDeliveryTarget()` / Then 返回 `status: "unavailable"` 且有 reason（非 unknown） | ✅ T-ROS.C.6-B/C |
| Given static probe 路径无 plugin context / When `checkDeliveryTarget()` / Then 结构化返回（不抛异常） | ✅ T-ROS.C.6-C |

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

- **T-CS.C.11**（依赖 T-ROS.C.6）：声明式 Workspace Connector — Scriptable Runner 框架。
