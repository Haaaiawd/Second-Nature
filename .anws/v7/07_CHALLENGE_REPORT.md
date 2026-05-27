# 07_CHALLENGE_REPORT — Second Nature v7

**生成日期**: 2026-05-27
**REVIEW_MODE**: CODE
**TARGET_DIR**: `.anws/v7`
**审查范围**: Wave 78 (T-V7C.C.7) + Wave 79 (INT-V7C.R) code changes in `src/guidance/`, `src/core/second-nature/guidance/`, `src/cli/ops/`, `src/observability/`, `plugin/agent-inner-guide.md`
**审查方法**: `/challenge CODE` + static code review + Pre-Mortem
**静态边界**: 未启动项目、未运行测试；依赖 Wave 78/79 已报告的测试证据

---

## 问题总览

| 轮次 | 范围 | Critical | High | Medium | Low | Gate |
|---|---|---:|---:|---:|---:|---|
| Design Round | v7 8 个系统设计 | 0 | 0 | 0 | 0 | PASS |
| Task Final Recheck | 05A + 05B | 0 | 0 | 1 | 0 | PASS |
| Code Review Round (Wave 68) | v7 completion / release readiness | 0 | 3 | 2 | 0 | HOLD |
| **Code Review Round (Wave 78/79)** | **T-V7C.C.7 guidance semantics + INT-V7C.R regression** | **0** | **0** | **2** | **2** | **PASS** |

**历史归档**: Wave 68 轮 CR-CODE-001~005 已在 Wave 69 全部关闭（INT-S6/restore/regression/README/lint）。详情已压缩，仅保留总览行。

**本轮判断**: Wave 78/79 实现符合 T-V7C.C.7 验收标准，向后兼容层完整，测试覆盖充分。Medium 项为已知设计权衡（语义漂移风险、preview 不一致），已在 wave-reviews 中记录。

---

## 审查摘要

| 项 | 结论 | 证据 |
|---|---|---|
| REVIEW_MODE | CODE | 用户明确请求 "code reviewer检查" |
| latest target | `.anws/v7` | Wave 78/79 增量审查 |
| code-reviewer execution | current session fallback | `.agents/skills/code-reviewer/SKILL.md` 不存在；本会话执行静态 review |
| overall result | PASS with accepted Medium | 0 Critical / 0 High；2 Medium 已记录在 wave-78-review.md |
| test evidence | Wave 78/79 reports | 170/170 PASS (guidance+heartbeat), ~231 total PASS |

### 输入证据

| 类别 | 路径 | 状态 |
|---|---|---|
| PRD / Architecture / ADR | `.anws/v7/01_PRD.md`, `02_ARCHITECTURE_OVERVIEW.md`, `03_ADR/` | Wave 68 已审；本次增量 |
| Tasks | `.anws/v7/05A_TASKS.md` | T-V7C.C.7 / INT-V7C.R checkbox 已关闭 |
| Verification | `.anws/v7/05B_VERIFICATION_PLAN.md` | T-V7C.C.7 / INT-V7C.R 验证标准已覆盖 |
| Implementation | `src/guidance/`, `src/core/second-nature/guidance/`, `src/cli/ops/`, `src/observability/` | 静态 review |
| Evidence | `tests/`, `reports/`, `.anws/v7/wave-reviews/` | 测试通过 |

---

## 契约模型摘要（Wave 78 增量）

| 类型 | 摘要 | 来源 | 失真风险 |
|---|---|---|---|
| 结果 | expressionBoundary 只塑造表达，不决定 allow/deny，不规定格式 | `05B#t-v7c-c-7` | 消费者可能把 avoid/prefer 约束误解为 hard guard |
| 状态 | outputGuard 兼容层保留，_semanticNote 标注弃用意图 | `src/guidance/output-guard.ts:39` | JSON 序列化中 `@deprecated` 不可见；外部消费者仍可能误读 |
| 时间 | atmosphere 短约束 ≤120 字，替代长 baseline | `src/guidance/template-registry.ts` | 复杂并发场景下可能过于抽象 |
| 错误 | guidance_payload preview 使用固定 active/low | `src/cli/ops/ops-router.ts` | preview 与 production atmosphere 不一致 |
| 运行 | getBaselineAtmosphereTemplate 长文本仍编译进 runtime | `src/guidance/template-registry.ts:8` | 增加 plugin 包体积 |

---

## 核心发现清单

| ID | 严重度 | 位置 | 发现 | 影响 | 建议 |
|---|---|---|---|---|---|
| CR-CODE-006 | Medium | `src/guidance/output-guard.ts:34-41`, `src/guidance/types.ts:64-68` | outputGuard 兼容层保留 `hardGuardPriority: true` 并进入 JSON API；运行时无 `@deprecated` 可见性。 | 外部消费者或新开发者继续将 outputGuard 误解为 hard guard，与 expressionBoundary 新语义冲突。 | 在下一个 breaking-change 窗口（v8）移除 outputGuard；或添加运行时 deprecation header/comment。 |
| CR-CODE-007 | Medium | `src/cli/ops/ops-router.ts:1650` | guidance_payload preview 固定使用 `getShortAtmosphereTemplate("active", "low")`，忽略输入 scene 的真实 mode/risk。 | Claw 操作员 preview 时看到的 atmosphere 与真实 heartbeat（如 quiet/high）不一致，可能导致调试误导。 | 在 guidance_payload input 中扩展可选 `mode`/`riskLevel` 参数，或显式标注 "preview atmosphere is representative only"。 |
| CR-CODE-008 | Low | `src/guidance/template-registry.ts:8-14` | getBaselineAtmosphereTemplate 长文本 (~400 字) 标记为 `@deprecated`，但仍被编译进 dist/ 和 plugin runtime。 | 无运行时功能价值，轻微增加 plugin 包体积。 | 下一版本从 runtime export 中移除，或改为按需动态加载。 |
| CR-CODE-009 | Low | `src/guidance/output-guard.ts:54-59` | ExpressionConstraintId 与 OutputGuardConstraintId 类型定义完全重复，仅名称不同。 | 维护时需要同步修改两处；增加偶然复杂度。 | 统一为一个底层 ConstraintId 类型，或让 ExpressionConstraintId = OutputGuardConstraintId。 |

---

## 承诺闭合验证

| 维度 | 结论 | 证据 | 对应问题 |
|---|---|---|---|
| 重复态 | Pass | expressionBoundary 与 outputGuard 同时存在，旧消费者读取不受影响 | none |
| 失败态 | Pass | buildMinimalGuidanceFallback 同时携带 expressionBoundary | none |
| 默认态 | Partial | guidance_payload 默认 active/low，非真实场景默认 | CR-CODE-007 |
| 运行态 | Partial | outputGuard hardGuardPriority 仍在 JSON 中暴露 | CR-CODE-006 |
| 并发态 | Pass | 无并发修改 guidance 结构 | none |
| 观测态 | Pass | guidance-audit.ts 已识别 expression_boundary | none |
| 健壮性 | Pass | 兼容层回退链完整 | none |
| 验证责任 | Pass | 12 项新测试 + 170/170 回归 PASS | none |

---

## 建议行动

| 优先级 | 行动 | 完成信号 |
|---|---|---|
| P2 | 评估 outputGuard 移除时间表（v8 breaking change）或添加运行时 deprecation 标记 | ADR 或 task 记录移除计划 |
| P2 | guidance_payload 支持 mode/riskLevel 参数，或添加 preview 免责声明 | ops-router input schema 更新 |
| P3 | 移除 getBaselineAtmosphereTemplate 长文本的 runtime 编译，或改为动态加载 | plugin 包体积减小 |
| P3 | 统一 ExpressionConstraintId / OutputGuardConstraintId | 类型定义合并 |

---

## 最终判断

**Gate**: PASS  
**Reason**: 0 Critical / 0 High；2 Medium 为已知设计权衡，已在 wave-78-review.md 中记录并 accepted。Wave 78/79 实现、测试、文档均满足验收标准。  
**Route**: 无阻塞项。v7 S8 可视为本地验证完成；实机复测待 Claw 0.1.38+ 环境补充。
