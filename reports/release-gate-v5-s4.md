# Release gate — v5 Sprint 4 (packaging / ops / docs)

**Task**: `.anws/v5/05_TASKS.md` **T1.4.2**  
**Date**: 2026-05-03  
**Template**: 对照 `04_SYSTEM_DESIGN/cli-system.md` §12.2 与 INT-S4 验收口径。

## Summary

| Gate | Result | Notes |
|------|:------:|-------|
| Package contents / `plugin/runtime/` | **pass** | `pnpm test` → `build:plugin`; `tests/unit/cli/runtime-artifact-boundary.test.ts`; `tests/integration/storage/packaged-runtime-smoke.test.ts` |
| Plugin install path (doc + layout) | **pass** | `README.md` / `README.zh-CN.md` OpenClaw extension layout |
| `heartbeat_check` surface | **pass** | T1.1.3 integration; `tests/integration/cli/cli-ops-surface.test.ts` 等 |
| Delivery target / `target_none` semantics (code + audit) | **pass** | 控制面 + T5.2.1；非生产宿主矩阵见下 |
| Ack drop / host policy | **pass** | 单测/集成分类；真实宿主 ⏳ |
| `heartbeat_tool_not_invoked` | **pass** (fixture) | `tests/integration/cli/host-smoke-heartbeat-tool.test.ts` |
| Fallback operator visibility (`not_sent`) | **pass** | T1.2.2；`tests/unit/cli/operator-fallback-view.test.ts` |
| Storage mode smoke | **pass** | T4.1.4；`tests/integration/storage/storage-mode-smoke.test.ts` |
| Near-real connector path | **pass** | T3.3.1；`tests/integration/connectors/near-real-connector-smoke.test.ts` |
| README current / target / validation-needed | **pass** | T1.4.1；本仓库 `README*.md` |
| **真实 OpenClaw 宿主会话冒烟** | **unknown** | 不在 CI；由操作者在目标宿主执行后更新 `reports/int-s4-release-readiness.md` |

## 阻塞下一版「对外宣称已宿主验证」的风险

1. **unknown — 物理宿主**：未在此报告生成环境执行生产 OpenClaw；`heartbeat_tool_not_invoked` 与真实 delivery 仍为现场变量。  
2. **low — 文档漂移**：若 README 与 `.anws/v5` 冲突，以 `.anws/v5` 为准（PRD US-008）。

## 引用证据索引

- INT-S1 / INT-S2 / INT-S3：`reports/int-s-*.md`  
- 部分就绪跟踪：`reports/int-s4-release-readiness.md`  
- 命令：`pnpm exec tsc --noEmit`；`pnpm test`
