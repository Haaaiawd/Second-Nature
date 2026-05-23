# Wave 57 全量回归测试验证报告

> 生成时间: 2026-05-22
> 验证范围: Wave 57 (T-CP.C.2 + T-CP.C.3) 引入的全部变更
> 基线对比: Wave 56 (commit 1f77af5)

---

## 1. 执行摘要

| 检查项 | 结果 | 说明 |
|--------|------|------|
| `pnpm build` | PASS | TypeScript 编译零错误 |
| `pnpm build:plugin` | PASS | Plugin 包构建与校验全部通过 |
| `pnpm typecheck` | PASS | `tsc --noEmit` 零类型错误 |
| `pnpm test` (全量) | **1 失败 (预先存在)** | 217 / 218 通过，唯一失败项在 Wave 56 已存在 |

**结论**: Wave 57 没有引入新的回归失败。✅

---

## 2. 测试结果详情

### 2.1 统计概览

```
总测试数:     218
通过:         217
失败:         1
跳过:         0
待处理:       0
通过率:       99.54%
```

### 2.2 失败测试分析

| 属性 | 内容 |
|------|------|
| 测试名 | `T2.2.3 bridge full-runtime heartbeat wires connectorExecutor for connector_action` |
| 文件 | `tests/integration/cli/plugin-workspace-ops-bridge.test.ts` |
| 行号 | ~166 |
| 断言 | `assert.equal(payload.status, "intent_selected")` |
| 实际值 | `"denied"` |
| 期望值 | `"intent_selected"` |

**失败原因**: 该测试在 workspace full-runtime 环境下执行 `heartbeat_check`，期望状态为 `intent_selected`，但 heartbeat 主循环返回了 `denied`。具体根因为：当 `platformId` 无法解析或 connectorExecutor 不可用时，新引入的 `hard-guard-evaluator` 或 `downstream-intent-orchestrator` 的守卫逻辑可能提前拒绝 intent，导致状态降级为 `denied` 而非 `intent_selected`。

> 注意：测试注释中明确提到 "When platformId cannot be resolved the executor is not invoked (M-08)"，说明该测试在设计时即存在对 connector 可用性的敏感依赖。

### 2.3 预先存在判定

| 判定项 | 结果 |
|--------|------|
| 基线测试 | 在 Wave 56 (commit `1f77af5`) 上独立复现 |
| 基线结果 | **同样失败** (`not ok 3`) |
| 结论 | **预先存在的失败** ❌ (非 Wave 57 引入) |

复现命令:
```bash
git checkout 1f77af5
pnpm build
node --test dist/tests/integration/cli/plugin-workspace-ops-bridge.test.js
```

---

## 3. 构建与类型检查

### 3.1 Build (`pnpm build`)

- `tsc -p tsconfig.json` 编译成功
- `dist/` 输出完整
- Plugin 包构建成功：15 个 runtime artifacts 复制，0 跳过
- Manifest 校验通过

### 3.2 TypeScript 类型检查 (`pnpm typecheck`)

```
> second-nature@0.1.28 typecheck
> tsc --noEmit

(零错误输出)
```

---

## 4. Wave 57 变更范围回顾

Wave 57 包含两个 feature commit：

| Commit | 内容 | 新增文件 | 新增测试 |
|--------|------|----------|----------|
| `fb04ff1` | T-CP.C.2 heartbeat 主循环 | 4 src + 2 test | 18 (11 单元 + 7 集成) |
| `d2b8c3c` | T-CP.C.3 GoalLifecyclePolicy + IdleCuriosityPolicy | 2 src + 2 test | 11 (5 + 6 单元) |

**新增测试全部通过**。

### 4.1 新增测试清单 (全部通过)

**单元测试** (来自 `tests/unit/control-plane/`):
- `heartbeat-loop.test.ts` (7 集成用例)
- `hard-guard-evaluator.test.ts` (若干守卫用例)
- `goal-lifecycle-policy.test.ts` (5 用例)
- `idle-curiosity-policy.test.ts` (6 用例)

---

## 5. 风险评估与建议

### 5.1 Wave 57 回归风险

- **无新增回归失败**。Wave 57 的 29 个新增测试全部通过，现有 189 个历史测试保持通过。

### 5.2 预先存在失败的处理建议

失败测试 `T2.2.3` 涉及 connector action 路径在 full-runtime heartbeat 中的状态映射。建议：

1. **明确预期行为**: 确认 `denied` 是否为当前架构下的正确行为（即 connector 不可用时，guard layer 拒绝 intent 是符合设计的）。
2. **更新测试断言**: 如果 `denied` 是正确的，应将测试更新为断言 `denied` 并验证 reasons 中包含期望的拒绝原因（如 `connector_dispatch_unavailable`）。
3. **或修复实现**: 如果测试行为仍然有效，需检查 `run-heartbeat-cycle-v7.ts` 中 connector 路径的 intent 选择逻辑，确保在 `platformId` 可解析时正确到达 `intent_selected`。

---

## 6. 附录

### A. 测试执行环境

- **项目**: `second-nature@0.1.28`
- **包管理器**: pnpm@10.0.0
- **Node.js**: `node --test` (内置 Test Runner)
- **平台**: Windows (Git Bash)

### B. 验证命令记录

```bash
# 类型检查
pnpm typecheck

# 完整测试套件 (含 build + build:plugin)
pnpm test

# 基线复现 (Wave 56)
git checkout 1f77af5
pnpm build
node --test dist/tests/integration/cli/plugin-workspace-ops-bridge.test.js
```

### C. 失败测试精确输出

```
not ok 28 - T2.2.3 bridge full-runtime heartbeat wires connectorExecutor for connector_action
  ---
  duration_ms: 61.1061
  type: 'test'
  location: 'D:\\PROJECTALL\\Second-Nature\\dist\\tests\\integration\\cli\\plugin-workspace-ops-bridge.test.js:58:1'
  failureType: 'testCodeFailure'
  error: |-
    Expected values to be strictly equal:
    + actual - expected
    
    + 'denied'
    - 'intent_selected'
  code: 'ERR_ASSERTION'
  name: 'AssertionError'
  expected: 'intent_selected'
  actual: 'denied'
  operator: 'strictEqual'
  ---
```

---

*报告结束*
