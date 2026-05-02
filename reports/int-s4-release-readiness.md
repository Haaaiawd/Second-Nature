# INT-S4 — Release readiness (partial)

**Date**: 2026-05-03  
**状态**: **里程碑 INT-S4 未勾选完成** — 依赖任务 `T1.2.2`, `T3.3.1`, `T1.4.1`, `T1.4.2`, `T7.1.1` 仍待交付；本文件记录**本波次已绿**项与阻塞项。

## 本波次已交付（可自动化证据）

| 项 | 证据 |
|----|------|
| T5.3.1 `queryExplain` / `exportAuditBundle` | `tests/integration/observability/explain-query-export.test.ts`；`pnpm test` |
| T1.2.1 ops explain surface + `explainSurfaceSubject` + 可选 `livedExperienceAuditStore` | `tests/integration/cli/t1-2-1-explain-read-models.test.ts`；`explainSurfaceSubject`：`src/cli/explain/explain-surface-subject.ts` |
| T1.3.1 `runHostSmoke`（含 `heartbeat_tool_invocation` / `docs_vs_observed_conflict` fixture） | `tests/integration/cli/host-smoke-heartbeat-tool.test.ts`；`src/cli/host-smoke/run-host-smoke.ts` |
| `pnpm exec tsc --noEmit` + `pnpm test`（含 `pnpm build:plugin`） | 全绿 |

## 仍为 `validation-needed` / `blocked_by`（INT-S4 退出标准）

| 阻塞 | 说明 |
|------|------|
| `T1.2.2` | operator `showOperatorFallback` / CLI fallback 视图 — INT-S4「fallback visibility」完整证据链 |
| `T3.3.1` | platform near-real path |
| `T1.4.1` / `T1.4.2` | README 边界 + release gate 报告模板 |
| `T7.1.1` | 文档 traceability review |
| **真实宿主冒烟** | `05_TASKS.md` INT-S4 要求仅在本 INT 执行；当前为 **fixture / near-real 逻辑**，非生产 OpenClaw E2E |

## 命令

```bash
pnpm exec tsc --noEmit
pnpm test
```
