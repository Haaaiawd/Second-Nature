# Wave 20 Code Review — 2026-05-11

## 1. 总结结论

**Pass** — Wave 20 五项编码任务（T1.2.9 / T1.2.6 / T1.2.7 / T1.2.8 / T3.3.2）实现与 05_TASKS.md 验收标准对齐，契约映射已同步。全量 303 测试通过（含 16 个新增集成测试）。

## 2. 审查范围与静态边界

**审查文件**（14 个）：
- `src/cli/read-models/types.ts`
- `src/cli/read-models/index.ts`
- `src/cli/commands/index.ts`
- `src/cli/ops/ops-router.ts`
- `src/cli/index.ts`
- `plugin/index.ts`
- `plugin/workspace-ops-bridge.ts`
- `tests/integration/cli/t1-2-6-policy-show-non-shell.test.ts`
- `tests/integration/cli/t1-2-7-audit-command-minimal-closure.test.ts`
- `tests/integration/cli/t1-2-8-capability-probe-ops-surface.test.ts`
- `tests/integration/cli/t1-2-9-decision-denied-not-degraded.test.ts`
- `tests/integration/cli/t3-3-2-near-real-smoke-cli-bridge.test.ts`
- `.anws/v5/05_TASKS.md`
- `AGENTS.md`

**未执行**：不启动宿主、不连外部服务、不执行运行时。

## 3. 契约 → 代码映射摘要

| 任务 | 验收标准 | 实现位置 | 测试 |
|------|---------|---------|------|
| T1.2.9 | `decision_denied` → `awaiting_sources` | `read-models/index.ts:mapRuntimeStatus` | t1-2-9 (3 cases) |
| T1.2.6 | `policy show` 返回结构化 data | `commands/index.ts:policy` → `readModels.loadPolicy` | t1-2-6 (3 cases) |
| T1.2.7 | `audit` 非占位，可解析 JSON | `commands/index.ts:audit` → `readModels.loadAuditSummary` | t1-2-7 (3 cases) |
| T1.2.8 | `capability_probe` 接入 ops surface | `ops-router.ts:dispatch` + `commands/index.ts` + `plugin/index.ts` | t1-2-8 (4 cases) |
| T3.3.2 | `near_real_smoke` CLI/bridge 入口 | `ops-router.ts:dispatch` + `commands/index.ts` + `plugin/index.ts` | t3-3-2 (3 cases) |

## 4. Lens 结果摘要

### Lens 1: 契约忠实度 — ✅ 通过
- `RuntimeSummary.serviceStatus` 枚举扩展 `awaiting_sources`，与 `mapRuntimeStatus` 返回值一致（`types.ts:8-13` / `read-models/index.ts:190-191`）。
- `policy show` 返回 `RhythmPolicySnapshot` 全字段（含默认值），不含占位文案（`commands/index.ts:75`）。
- `audit` 返回 `{ totalEvents, events[] }`，空 store 返回 honest empty（`read-models/index.ts:loadAuditSummary`）。
- `capability_probe` 返回 JSON 子集含 `reportId`/`deliveryTarget`/`pluginLoad.verdict` 等，与 `HostCapabilityReport` 结构对齐（`ops-router.ts:194-206`）。
- `near_real_smoke` 返回 `NearRealConnectorSmokeResult` 完整结构，含 `taskClaimDryRunOk`/`feedReadEvidenceId`（`ops-router.ts:234`）。

### Lens 2: 任务兑现与交付闭合 — ✅ 通过
- 五项任务均有实现 + 集成测试覆盖。无 Mock/Stub 误用于正式路径。
- `CreateCliRuntimeDepsOptions` 新增 `livedExperienceAuditStore` 透传，测试注入与实际命令路径一致（`cli/index.ts:53-55`）。

### Lens 3: 架构适配与复杂度健康 — ✅ 通过
- `OpsRouterDeps` 以**可选字段**扩展（`observabilityDb`/`state`/`workspaceRoot`），不影响现有调用方。
- `mapRuntimeStatus` 新增 `decision_denied` 分支位于**最前**，优先级正确，不被后续 `failureClass || failed` 覆盖。
- `createStaticUnknownAdapter` 内聚于 `ops-router.ts`，无向 core 泄漏 CLI 特定适配器。
- `WORKSPACE_BRIDGE_COMMANDS` 扩展 3 个命令，与 `isWorkspaceBridgeCommand` 现有模式兼容。

### Lens 4: 静态运行风险与安全边界 — ✅ 通过
- `near_real_smoke` deps 缺失时返回诚实 JSON 错误（`NEAR_REAL_SMOKE_DEPS_UNAVAILABLE`），不 throw（`ops-router.ts:217-227`）。
- `capability_probe` 无 `observabilityDb` 时跳过持久化，仍返回安全 JSON（`ops-router.ts:188-189`）。
- `audit` 命令不读取文件系统，仅访问 in-memory store，无 PII 泄露风险。
- `loadAuditSummary` 仅暴露 `eventId`/`family`/`plane`/`createdAt`/`sensitivity`，不暴露 payload 内容，符合 redaction 契约。

### Lens 5: 验证证据与可观测性 — ✅ 通过
- 新增 16 个集成测试，覆盖五项任务的全部验收标准。
- 全量 303 测试通过（`npm test`）。
- 断言强度：equal/ok/deepEqual 结合，无过弱 false-positive 风险。

### Lens 6: 回流一致性与交接证据 — ✅ 通过
- `05_TASKS.md` 任务标记 `[x]` 已更新，契约映射表 `⏳` → `✅` 已同步。
- `AGENTS.md` 新增 Wave 20 块，总任务状态已刷新。
- 变更已 commit + push。

## 5. Issues

### Low-01: `OpsReadModelPort` 未同步新增 read model 方法
- **位置**: `src/cli/read-models/index.ts:70-79`
- **发现**: `OpsReadModelPort` 未包含 `loadPolicy` / `loadAuditSummary`。
- **影响**: 当前 `OpsReadModelPort` 仅用于 `showOperatorFallback` 和 heartbeat runner 的 readModels 注入；`policy`/`audit` 命令通过 `CliCommandDeps` 完整 `readModels` 访问，不影响功能。但若未来 ops surface 需要暴露 policy/audit，需扩展此 Pick。
- **最小修复**: 在后续 wave 中按需扩展 `OpsReadModelPort`，或在 T1.2.6/T1.2.7 验收中注明 "CLI 路径已闭合，OpsReadModelPort 子集不含 policy/audit 为设计意图"。

### Low-02: `createStaticUnknownAdapter` 的 `observedAt` 为实例常量
- **位置**: `src/cli/ops/ops-router.ts:55`
- **发现**: 同一适配器实例的所有 checks 共享同一个 `now` 时间戳。
- **影响**: 纯 cosmetic，`verdict: "unknown"` 时时间戳一致性不影响诊断价值。
- **最小修复**: 无。如需各 check 独立时间戳，可改为每次调用 `new Date().toISOString()`。

### Low-03: `@ts-ignore` 注释在 `plugin/workspace-ops-bridge.ts`
- **位置**: `plugin/workspace-ops-bridge.ts:90-92`
- **发现**: 动态导入无 `.d.ts` 的 runtime artifact，使用 `@ts-ignore` 压制 TS7016。
- **影响**: 编译通过，但 `@ts-ignore` 是全局压制（压制下一行所有 TS 错误）。若未来该行出现其他类型错误，会被静默忽略。
- **最小修复**: 长期建议为 `plugin/runtime/cli/index.js` 生成最小 `.d.ts` 声明，或改用 `// @ts-expect-error` 配合 `as unknown`（需确保编译器确实报错）。当前为已知技术债，不阻塞交付。

## 6. 安全 / 测试覆盖补充

- **测试覆盖**: sufficient（16 个新增集成测试覆盖 5 项任务全部验收路径）。
- **安全边界**: 无新增鉴权入口、无新增外部网络调用、无 PII 暴露。`audit` 返回 redacted summary 仅含元数据。
- **无法静态确认**: 真实宿主上 `capability_probe` 静态 unknown 适配器是否足够（需 INT-S4 实际运行确认）。
