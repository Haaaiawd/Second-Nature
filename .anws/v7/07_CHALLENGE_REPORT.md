# 07_CHALLENGE_REPORT — Second Nature v7

**生成日期**: 2026-05-24  
**REVIEW_MODE**: CODE  
**TARGET_DIR**: `.anws/v7`  
**审查范围**: `.anws/v7` contracts + `src/` + `plugin/` + `tests/` + `reports/` + README/AGENTS handoff docs  
**审查方法**: `/challenge CODE` + `code-reviewer` Lens 1-6 + sequential-thinking audit  
**静态边界**: 未启动项目、未运行测试、未连接真实 OpenClaw 或外部 connector；运行时和宿主 E2E 只能判定为需验证。

---

## 问题总览

| 轮次 | 范围 | Critical | High | Medium | Low | Gate |
|---|---|---:|---:|---:|---:|---|
| Design Round | v7 8 个系统设计 | 0 open | 0 open | 0 open | 0 | PASS |
| Task Final Recheck | 05A + 05B | 0 | 0 | 1 | 0 | PASS |
| Code Review Round | v7 completion / release readiness | 0 | 3 | 2 | 0 | HOLD |

**本轮判断**: v7 implementation is partially delivered, but it is not release-complete because INT-S6 is open, restore does not execute the contracted restore path, and the v6 regression gate still contains failing tests.

---

## 审查摘要

| 项 | 结论 | 证据 |
|---|---|---|
| REVIEW_MODE | CODE | 用户明确请求 `/challenge code review` |
| latest target | `.anws/v7` | 最大架构版本目录 |
| code-reviewer execution | current session fallback | Host exposed multi-agent tools, but tool policy requires explicit user authorization for sub-agents |
| overall result | Partial Pass / HOLD | High issues remain |
| not executed | tests / build / OpenClaw E2E | code-reviewer static boundary |

### 输入证据

| 类别 | 路径 | 状态 |
|---|---|---|
| PRD / Architecture / ADR | `.anws/v7/01_PRD.md`, `02_ARCHITECTURE_OVERVIEW.md`, `03_ADR/` | sampled for anchors |
| System Design | `.anws/v7/04_SYSTEM_DESIGN/` | present |
| Tasks | `.anws/v7/05A_TASKS.md` | read |
| Verification | `.anws/v7/05B_VERIFICATION_PLAN.md` | read |
| Implementation | `src/`, `plugin/` | static review |
| Evidence | `tests/`, `reports/`, `.anws/v7/wave-reviews/` | static review |

---

## 契约模型摘要

| 类型 | 摘要 | 来源 | 失真风险 |
|---|---|---|---|
| 结果 | S6 exit requires plugin load, wet truth, self_health P95, heartbeat E2E, v6 regression, docs | `05A_TASKS.md:892-1005`, `05B_VERIFICATION_PLAN.md:635-644` | release gate can be claimed before evidence exists |
| 状态 | INT-S6 remains unchecked and no release gate report exists | `05A_TASKS.md:998-1004`, `05B_VERIFICATION_PLAN.md:644` | completion status can drift from actual gate |
| 错误 | v6 regression must pass or use justified skips | `05A_TASKS.md:979-987` | pre-existing failures can be mislabeled as passed |
| 运行 | `restore` command must trigger RestoreSnapshotStore + RestoreAuditService | `05A_TASKS.md:899-908` | audit-only restore can look successful without state restore |
| 安全 | secret and credential plaintext must never be restored or exposed | `05A_TASKS.md:908`, `README.md:84-90` | no issue found in sampled secret paths |
| 观测 | host E2E needs screenshots/logs, self_health dimensions JSON, heartbeat P95 report | `05B_VERIFICATION_PLAN.md:641-644`, `05B_VERIFICATION_PLAN.md:758-761` | static tests can be mistaken for host proof |

---

## Code Reviewer 摘要

| Lens | 结论 | 证据 |
|---|---|---|
| L1 Contract Fidelity | Partial | v7 commands are present, but `restore` is audit-only despite restore contract |
| L2 Task Fulfillment | Partial | `INT-S6` is unchecked and required release report is missing |
| L3 Architecture Fit | Basically covered | module boundaries mostly match v7 slices; no new structural blocker found |
| L4 Static Runtime/Safety Risk | Partial | restore command reports success without static evidence of state restore |
| L5 Verification Evidence | Partial | v6 regression has 9 failures and `pnpm lint` is planned but absent |
| L6 Backflow & Handoff | Partial | README and AGENTS status are stale relative to Wave 68 |

---

## 核心发现清单

| ID | 严重度 | Lens | 位置 | 发现 | 影响 | 建议 |
|---|---|---|---|---|---|---|
| CR-CODE-001 | High | L2+L5 | **`.anws/v7/05A_TASKS.md:998`**, **`.anws/v7/05B_VERIFICATION_PLAN.md:641`**, **`.anws/v7/05B_VERIFICATION_PLAN.md:644`** | INT-S6 remains open and the required `reports/int-s6-e2e-release-gate-v7.md` evidence is absent. | v7 cannot be honestly called release-complete because the final E2E/regression/docs gate has not closed. | Run `/forge` for INT-S6 and produce the release gate report with the required host/E2E evidence. |
| CR-CODE-002 | High | L1+L4 | **`.anws/v7/05A_TASKS.md:900`**, **`.anws/v7/05A_TASKS.md:908`**, **`src/cli/ops/ops-router.ts:786`**, **`src/cli/ops/ops-router.ts:852`** | The `restore` runtime command writes RestoreAudit but assumes the state restore was already attempted by the caller. | Operators can receive `ok=true` for a restore surface that never invoked RestoreSnapshotStore or applied bounded state restoration. | Wire a real restore operation port into `restore` or downgrade the command contract and tasks to audit-only through `/change`. |
| CR-CODE-003 | High | L2+L5 | **`.anws/v7/05A_TASKS.md:983`**, **`.anws/v7/05A_TASKS.md:986`**, **`reports/v6-regression-gate-v7.md:12`**, **`reports/v6-regression-gate-v7.md:14`** | T-ROS.C.5 requires all v6 tests to pass or have justified skips, but the regression report records 9 failures and 0 skips. | A no-new-regression statement does not satisfy the release gate contract and leaves migration/audit/bridge failures open. | Fix or formally convert each failure into an explicit justified skip with owner, scope, and release acceptance. |
| CR-CODE-004 | Medium | L6 | **`README.md:34`**, **`README.md:38`**, **`AGENTS.md:201`**, **`AGENTS.md:202`**, **`AGENTS.md:369`** | README still says v7 is in Genesis/design and not forge-ready, while AGENTS current status points to Wave 62/Wave 61 despite Wave 68 saying INT-S6 is next. | Fresh recovery sessions and users will route from stale status and may repeat completed workflow steps. | Update README and the AGENTS current-status block to state Wave 68 complete and INT-S6 pending. |
| CR-CODE-005 | Medium | L5 | **`.anws/v7/05B_VERIFICATION_PLAN.md:31`**, **`package.json:61`**, **`package.json:65`** | The verification plan names `pnpm lint`, but `package.json` has no `lint` script. | The release gate has a documented quality check that cannot be invoked as written. | Add a lint script or amend 05B to use the actual available static checks. |

---

## Issues — code-reviewer 字段契约

| Severity | Lens | Title | Evidence | Impact | Minimum fix | Anchor |
|---|---|---|---|---|---|---|
| High | L2+L5 | Release Gate Evidence Gap | **`.anws/v7/05A_TASKS.md:998`**, **`.anws/v7/05B_VERIFICATION_PLAN.md:644`** | v7 completion is unproven. | Produce `reports/int-s6-e2e-release-gate-v7.md` and close INT-S6. | INT-S6 |
| High | L1+L4 | Restore Contract Drift | **`src/cli/ops/ops-router.ts:786`**, **`src/cli/ops/ops-router.ts:852`** | Restore can report audit success without restoring state. | Wire RestoreSnapshot/apply port or change the public contract. | T-ROS.C.1 / REQ-011 |
| High | L2+L5 | Regression Gate Not Closed | **`reports/v6-regression-gate-v7.md:12`**, **`reports/v6-regression-gate-v7.md:14`** | Failing tests remain inside a P0 release gate. | Fix failures or document justified skips. | T-ROS.C.5 |
| Medium | L6 | Handoff Status Drift | **`README.md:38`**, **`AGENTS.md:201`**, **`AGENTS.md:369`** | Recovery routing is stale. | Update handoff docs. | T-ROS.C.4 |
| Medium | L5 | Missing Lint Entry | **`.anws/v7/05B_VERIFICATION_PLAN.md:31`**, **`package.json:61`** | A planned check is not executable. | Add `lint` or update verification contract. | 05B verification layers |

---

## 承诺闭合验证

| 维度 | 结论 | 证据 | 对应问题 |
|---|---|---|---|
| 重复态 | Pass | write queue/manual run coverage exists in Wave 68 tests | none |
| 失败态 | Partial | regression failures remain open | CR-CODE-003 |
| 默认态 | Partial | README/AGENTS default recovery text is stale | CR-CODE-004 |
| 运行态 | Partial | restore command lacks state restore path | CR-CODE-002 |
| 并发态 | Pass | ManualRunDispatcher and write queue tests exist | none |
| 观测态 | Partial | release gate E2E evidence missing | CR-CODE-001 |
| 事务/回滚 | Partial | RestoreSnapshotStore exists, but restore command does not use it | CR-CODE-002 |
| 配置/秘钥 | Pass | README states key plaintext must not be recorded | none |
| 验证责任 | Partial | `pnpm lint` contract has no script | CR-CODE-005 |

---

## 安全与测试覆盖补充

- Static review found no sampled path that exposes `SECOND_NATURE_ENCRYPTION_KEY` plaintext, but true recovery behavior still requires INT-S6 host evidence.
- OpenClaw tool visibility, wet endpoint truth, self_health P95, heartbeat P95, and screenshot/log artifacts cannot be confirmed statically.
- `reports/v6-regression-gate-v7.md` is useful as a Wave 68 no-new-regression report, but it is not sufficient as a release gate pass.

---

## 建议行动

| 优先级 | 行动 | 完成信号 |
|---|---|---|
| P1 | Fix or re-contract `restore` so the runtime command either applies RestoreSnapshot-backed state restoration or is explicitly audit-only. | Tests cover restore state before/after, not only audit writes. |
| P1 | Execute INT-S6 through `/forge`. | `05A_TASKS.md` marks INT-S6 complete and `reports/int-s6-e2e-release-gate-v7.md` exists. |
| P1 | Resolve the 9 v6 regression failures or convert them into explicit justified skips. | Regression report shows pass or named skips, not raw failures. |
| P2 | Update README/AGENTS handoff state. | README no longer says Genesis/design phase and AGENTS current-status block says Wave 68 complete, INT-S6 pending. |
| P2 | Align lint verification with package scripts. | `pnpm lint` exists or 05B names the real static check. |

---

## 最终判断

**Gate**: HOLD_FOR_INT_S6  
**Reason**: 0 Critical but 3 High remain, and release completion is not statically supported.  
**Route**: Use `/forge` for INT-S6 and the restore/regression fixes; use `/change` first only if the intended restore contract is audit-only rather than state-changing.

