# INT-S4 — Release readiness (partial)

**Date**: 2026-05-04（更新）  
**状态**: **里程碑 INT-S4 仍未勾选完成** — T1.1.4 相关 **J-HOST-01 与未设根工具链**已在 OpenClaw（隧道 UI）跑通并完成 JSON 归档；**J-HOST-02 Step1（网关 env 证明）** 与 **CH-11-01 宿主沙箱独占证** 仍 `partial/⏳`（宿主 JSON 与 Claw 节律见 **`reports/openclaw-carrier-host-brief.md`**；旅程表见 `docs/validation/e2e-t1-1-4-workspace-bridge-and-host-verification.md`）。

## 本波次已交付（可自动化证据）


| 项                                                                                          | 证据                                                                                                                              |
| ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| T5.3.1 `queryExplain` / `exportAuditBundle`                                                | `tests/integration/observability/explain-query-export.test.ts`；`pnpm test`                                                      |
| T1.2.1 ops explain surface + `explainSurfaceSubject` + 可选 `livedExperienceAuditStore`      | `tests/integration/cli/t1-2-1-explain-read-models.test.ts`；`explainSurfaceSubject`：`src/cli/explain/explain-surface-subject.ts` |
| T1.2.2 `showOperatorFallback` / CLI `fallback`                                             | `tests/unit/cli/operator-fallback-view.test.ts`；相关 CLI 集成测                                                                      |
| T1.3.1 `runHostSmoke`（含 `heartbeat_tool_invocation` / `docs_vs_observed_conflict` fixture） | `tests/integration/cli/host-smoke-heartbeat-tool.test.ts`；`src/cli/host-smoke/run-host-smoke.ts`                                |
| T3.3.1 near-real connector smoke                                                           | `tests/integration/connectors/near-real-connector-smoke.test.ts`                                                                |
| T1.4.1 README current / target / validation-needed                                         | `README.md`、`README.zh-CN.md`                                                                                                   |
| T1.4.2 release gate 汇总                                                                     | `reports/release-gate-v5-s4.md`                                                                                                 |
| T7.1.1 文档追溯 checklist                                                                      | `reports/t7-1-1-documentation-traceability-checklist.md`                                                                        |
| `pnpm exec tsc --noEmit` + `pnpm test`（含 `pnpm build:plugin`）                              | 全绿                                                                                                                              |
| T1.1.4 / INT-S4 **J-HOST-01 + 未设根四连调**（OpenClaw UI + 同提交 JSON 归档） | `reports/openclaw-carrier-host-brief.md`；`docs/validation/e2e-t1-1-4-workspace-bridge-and-host-verification.md`（J-HOST-02/03/04 **partial**，网关 env 证明 **⏳**） |


## 仍为 `validation-needed`（INT-S4 退出标准）


| 阻塞               | 说明                                                                                |
| ---------------- | --------------------------------------------------------------------------------- |
| **真实宿主冒烟**       | `05_TASKS.md` INT-S4：仅在目标 OpenClaw 宿主执行并记录 pass/fail/unknown；CI fixture **不**闭合此项 |
| **INT-S4 里程碑勾选** | 需在完成上项后更新 `.anws/v5/05_TASKS.md` 中 `INT-S4` 与 `AGENTS.md` Wave 结算                 |


## 命令

```bash
pnpm exec tsc --noEmit
pnpm test
```

**真实宿主冒烟（E2E / 手动）**：按步骤与证据表执行并回填  
`docs/validation/int-s4-host-smoke-testing-guide.md`。