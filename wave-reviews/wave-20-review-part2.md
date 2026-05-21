# Wave 20 Part 2 Code Review — 2026-05-11

## 1. 总结结论

**Pass** — 4 个 host-safe 路径一致性修复 + 1 个 observability retention 清理函数，全部通过 305 测试。

## 2. 审查范围

**修改文件**（7 个）：
- `plugin/index.ts` — host-safe 路径 4 个命令降级
- `src/observability/services/observability-retention.ts` — 新增
- `tests/integration/observability/observability-retention-cleanup.test.ts` — 新增
- `plugin/index.js` — 编译产物
- `plugin/workspace-ops-bridge.js` — 编译产物
- `plugin/runtime/` — 编译产物（build:plugin 生成）

## 3. Lens 结果摘要

### Lens 1: 契约忠实度 — ✅ 通过
- `policy show` host-safe 返回 `HOST_SAFE_POLICY_SHOW_UNAVAILABLE`（结构化 `error` 对象 + `message`），与 `createUnavailableActionError` 模式一致。
- `audit` host-safe 返回 `HOST_SAFE_AUDIT_UNAVAILABLE`，与 `credential`/`fallback` 等既有 host-safe 降级模式对齐。
- `capability_probe` / `near_real_smoke` host-safe 返回各自 `HOST_SAFE_*_UNAVAILABLE`，不再返回 "Unknown Second Nature command"。
- `pruneObservabilityTables` 删除早于阈值的 `decision_ledger` 和 `execution_attempts`，返回诚实计数。

### Lens 2: 任务兑现 — ✅ 通过
- 4 个 host-safe 降级修复均对应 P1 级发现，集成测试覆盖（通过 `plugin-runtime-registration` 等既有测试的 host-safe 路径隐式验证）。
- retention 函数有 2 个集成测试：删除旧记录 / 过去日期不删除。

### Lens 3: 架构适配 — ✅ 通过
- host-safe 降级使用统一的 `createUnavailableActionError` 工厂函数，无代码重复。
- retention 函数仅操作 observability DB，不碰 state DB，边界清晰。
- `notImplemented` 函数在 `plugin/index.ts` 中仍定义但不再被引用，可作为未来命令的 fallback 保留。

### Lens 4: 静态运行风险 — ✅ 通过
- host-safe 降级均为只读（返回 JSON），不改状态。
- retention `pruneObservabilityTables` 是显式调用函数（非 cron），调用方控制 `beforeDate`，无意外数据丢失风险。
- `count before delete` 模式确保返回值准确，但需注意并发场景下 count 和 delete 之间可能有新插入（SQLite 单线程写通常无此问题，但文档已注明）。

### Lens 5: 验证证据 — ✅ 通过
- 305 测试全绿（+2 个新 retention 测试）。
- 编译产物 `plugin/index.js` 已验证包含全部 4 个修复。

### Lens 6: 回流一致性 — ✅ 通过
- `plugin/index.ts` 源文件与编译产物 `plugin/index.js` 一致（本次 commit 前执行了 `build:plugin`）。

## 4. Issues

### Low-01: `notImplemented` 函数未使用但仍定义
- **位置**: `plugin/index.ts:745`
- **说明**: `notImplemented` 现在无任何调用方。可安全保留作为未来命令占位模板，或后续清理。
- **建议**: 无阻塞，可选在后续 wave 中移除。

### Low-02: retention 函数无自动调度入口
- **位置**: `src/observability/services/observability-retention.ts`
- **说明**: `pruneObservabilityTables` 是库函数，尚未接入 heartbeat cycle 或 cron。当前需要 operator 显式调用（如通过 CLI `second_nature_ops` 命令或手动脚本）。
- **建议**: 可在 INT-S4 后新增 `retention` CLI 命令或 heartbeat 钩子。当前不阻塞。

## 5. 安全 / 测试覆盖补充

- **测试覆盖**: sufficient（2 个 retention 测试 + 303 个既有测试全绿）。
- **安全边界**: 无新增鉴权入口、无新增外部网络调用。
