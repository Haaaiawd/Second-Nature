# Second Nature v6 质疑报告

> **审查日期**: 2026-05-16  
> **TARGET_DIR**: `.anws/v6`，按 `.anws/` 下最大数字版本定位。  
> **REVIEW_MODE**: FULL-DOC（DESIGN + TASKS；跳过 CODE）。  
> **审查范围**: `01_PRD.md`、`02_ARCHITECTURE_OVERVIEW.md`、`03_ADR/*`、`04_SYSTEM_DESIGN/*`、`05A_TASKS.md`、`05B_VERIFICATION_PLAN.md`、根 `AGENTS.md` 的 v6 锚点。  
> **跳过项**: 未执行 code-reviewer，因为本轮用户明确要求 design 与 tasks 双 review，且目标是 forge 前文档契约闭合。  
> **sequential-thinking**: `Get-Command sequential-thinking` 未发现可执行 CLI；本轮按 `/challenge` 的 Pre-Mortem 结构手工完成失败预演，并在本报告中显式记录该工具缺口。

---

## 总体判断

v6 的系统设计主体仍然成立：Dream output lifecycle、connector trust policy、goal governance、NarrativeTrace、ConnectorInventoryAudit、redaction 与 host-safe ops envelope 都有明确 owner 和契约锚点。

本轮 design + tasks 双审发现的 High 级任务契约缺口已通过 Round 6 `/change` 回流：`05A_TASKS.md` 新增 T1.2.4 `goal` command、T1.2.5 `cycle:recent` read model、T1.2.6 v6 `status` aggregate；`05B_VERIFICATION_PLAN.md` 同步补齐 Task-by-Task、Contract Coverage、Testing Coverage 与 Verification Traceability Matrix。

结论：**Round 6 回流后，不再保留 Critical / High forge blocker**。可以进入 `/forge`，但实现阶段必须同时读取 05A/05B，按新增 T1.2.4-T1.2.6 承接 S4 ops surface，别再让 INT 冒烟替生产任务背锅。

---

## 问题总览

| ID | 严重度 | 类别 | 发现 | 状态 |
| --- | --- | --- | --- | --- |
| CH-V6-01 | Critical | Forge blocker | `05_TASKS.md` 曾引用不存在的 `04_SYSTEM_DESIGN/*.md`。 | 已通过 Round 2-4 补齐 |
| CH-V6-02 | Critical | 安全边界 | 动态 connector 曾未区分声明式 manifest 与任意本地代码执行。 | 已回流 PRD/ADR/Tasks |
| CH-V6-03 | Critical | 记忆治理 | Dream output 曾缺少 candidate/accepted/archived 生命周期。 | 已回流 ADR/Tasks |
| CH-V6-04 | High | 外部事实 / 性能 | Dream 曾把完整 LLM job 写成 5 分钟 P95。 | 已修正为规则阶段目标与 async timeout |
| CH-V6-05 | High | 授权治理 | agent-proposed goal 曾缺少 risk/policy/owner gate。 | 已回流 PRD/ADR |
| CH-V6-06 | High | 范围失真 | 15+ connector 曾被写成 v6 架构完成标准。 | 已修正为后续内容建设 |
| CH-V6-07 | Medium | 实现基线漂移 | v6 曾缺少足够详细设计承接 Dream/Agent Self。 | 已由 S0 设计门禁承接 |
| CH-V6-08 | Medium | LLM 接口 | v6 曾暗示复用 guidance fetch adapter 而非通用 model port。 | 已改为 ModelAssistPort / DreamModelPort |
| DR3-01 | Medium | 任务承接 | `NarrativeTrace` 与 `ConnectorInventoryAudit` 曾未在任务清单单独承接。 | 已回流 |
| DR5-01 | High | 版本与门禁锚点 | 根 `AGENTS.md` 曾声明最新架构为 v5，而 v6 文档声明 design gate closed。 | 已回流 |
| DR5-02 | High | 验证契约 | v6 曾缺少 canonical `05A_TASKS.md` / `05B_VERIFICATION_PLAN.md`，且 INT-S1~S4 只被引用未被定义为任务体。 | 已回流 |
| DR5-03 | Medium | 任务验收细节 | `connector init` 任务验收曾未显式检查 pending-trust/no-overwrite/path-safety。 | 已回流 |
| DR6-01 | High | 任务承接 / Ops surface | `goal`、`cycle:recent`、`status` 是设计契约，但 05A/05B 曾缺少对应实现与验证任务。 | 已通过 Round 6 `/change` 回流 |

---

## 审查摘要

| 项目 | 结论 | 证据 |
| --- | --- | --- |
| 定位架构版本 | Pass | `.anws/` 中最大数字版本为 `v6` |
| 设计文档存在性 | Pass | `04_SYSTEM_DESIGN/` 已含 7 个系统 L0 设计及若干 L1 detail |
| 任务文档存在性 | Pass | `05A_TASKS.md` 与 `05B_VERIFICATION_PLAN.md` 均存在 |
| REVIEW_MODE | FULL-DOC | 用户明确要求 design 与 tasks 双 review |
| Design review | Partial Pass | 设计契约主体闭合，但 cli-system 的 ops surface 需要任务层完整承接 |
| Task review | High finding | 6 个 REQ 均有粗粒度覆盖，但 v6 ops command 契约覆盖不完整 |
| Code review | Skipped | 本轮未审 `src/`，因为用户请求对象是 design + tasks |

### 证据来源

| 类型 | 来源 |
| --- | --- |
| 产品契约 | `.anws/v6/01_PRD.md` |
| 架构契约 | `.anws/v6/02_ARCHITECTURE_OVERVIEW.md`、`.anws/v6/03_ADR/*` |
| 系统设计契约 | `.anws/v6/04_SYSTEM_DESIGN/*.md` |
| 任务与验证契约 | `.anws/v6/05A_TASKS.md`、`.anws/v6/05B_VERIFICATION_PLAN.md` |
| 工作流锚点 | `AGENTS.md`、`.codex/skills/anws-system/references/challenge.md` |

---

## 规范来源与承诺模型

| 类型 | 摘要 | 来源 | 失真风险 |
| --- | --- | --- | --- |
| 结果承诺 | Dream 输出独立 MemoryStore、insight、narrative update 与 relationship update。 | `01_PRD.md` US-001；`dream-system.md` | candidate 被误消费或输出不可见 |
| 状态承诺 | NarrativeState、RelationshipMemory、AgentGoal、MemoryStore 由 state-system 持久化。 | `02_ARCHITECTURE_OVERVIEW.md` §System 4；`state-system.md` | prompt-only 或状态不可迁移 |
| 安全承诺 | 动态 connector custom adapter 默认 pending trust，不自动执行 workspace code。 | ADR-002；`connector-system.md` | 任意代码执行 |
| 运行承诺 | Dream async，不阻塞 heartbeat；heartbeat 决策 P95 < 2s。 | `01_PRD.md` §6.1；`control-plane-system.md` §10 | LLM job 阻塞主链 |
| 审计承诺 | DreamTrace、NarrativeTrace、ConnectorInventoryAudit 支撑 explain/read model。 | `observability-system.md`；`05B_VERIFICATION_PLAN.md` | 失败不可解释 |
| Ops 承诺 | `narrative`、`goal`、`dream:recent`、`connector:*`、`cycle:recent`、`status` 通过 JSON-first ops surface 暴露。 | `cli-system.md` §1/§5；`01_PRD.md` US-006；`05A_TASKS.md` T1.2.1-T1.2.6；`05B_VERIFICATION_PLAN.md` T1.2.1-T1.2.6 | 设计命令必须有 producer task 与验证锚点 |

---

## Pre-Mortem

| 失败原因 | 失真契约 | Root Cause | 回流证据 | 状态 |
| --- | --- | --- | --- | :---: |
| S4 验收要求 `cycle:recent` 或 v6 `status`，但实现阶段没有任务负责对应 read model。 | Ops surface / Verification | INT 任务只验收结果，没有分解生产该结果的 Level-3 任务。 | T1.2.5 `cycle:recent` read model；T1.2.6 v6 `status` aggregate；INT-S4 依赖 T1.2.1-T1.2.6。 | Mitigated |
| Owner 可以设置 Goal 的产品承诺落到 state store，而不是 CLI/tool 命令。 | User operation / State transition | `AgentGoal` storage 任务能写 owner-set goal，但没有 `sn goal set/list/accept/reject` 的 ops route 与错误语义任务。 | T1.2.4 `sn goal set/list/accept/reject`；05B 对应 goal command 验证行。 | Mitigated |
| 任务覆盖矩阵显示 REQ 全覆盖，但命令级契约仍有空洞。 | Traceability | REQ 粗粒度覆盖掩盖了 Contract 粒度缺口。 | 05B Contract Coverage、Testing Coverage、Verification Traceability Matrix 已补齐 `goal`、`cycle:recent`、`status`。 | Mitigated |

---

## 设计审查发现

### 摘要

| 维度 | 发现数 | Critical | High | Medium | Low |
| --- | :---: | :---: | :---: | :---: | :---: |
| 系统设计 | 0 | 0 | 0 | 0 | 0 |
| 运行模拟 | 1 | 0 | 1 | 0 | 0 |
| 工程实现 | 0 | 0 | 0 | 0 | 0 |
| **合计** | **1** | **0** | **1** | **0** | **0** |

**高信号结论**: 设计本身定义了完整 ops surface；Round 6 已把遗漏的 `goal`、`cycle:recent`、`status` 转成可执行任务与验证锚点。

### 核心发现清单

| ID | 维度 | 严重度 | 文档位置 | 发现 | 影响 | 建议 |
| --- | --- | --- | --- | --- | --- | --- |
| DR6-01 | 运行模拟 | High | `04_SYSTEM_DESIGN/cli-system.md:58`, `:244`, `:249`, `:250` | `goal`、`cycle:recent`、`status` 被定义为 v6 ops surface，但原 05A/05B 没有独立实现任务。 | 已在 05A/05B 新增 T1.2.4-T1.2.6，S4 验收有 producer tasks。 | 已闭合；`/forge` 执行时按新增任务实现。 |

---

## 任务审查报告

### 检测摘要

| Pass | 检测项数 | CRITICAL | HIGH | MEDIUM | LOW |
| --- | :---: | :---: | :---: | :---: | :---: |
| A 重复检测 | 28 tasks | 0 | 0 | 0 | 0 |
| B 歧义检测 | 28 tasks | 0 | 0 | 0 | 0 |
| C 欠详述检测 | 28 tasks | 0 | 0 | 0 | 0 |
| D 不一致性检测 | 7 systems + 31 tasks | 0 | 0 | 0 | 0 |
| E 覆盖率检测 | 6 REQ / 6 US | 0 | 0 | 0 | 0 |
| F 质量粒度 | 28 tasks | 0 | 0 | 0 | 0 |
| G 契约覆盖 | core contracts | 0 | 0 | 0 | 0 |
| **合计** | **—** | **0** | **0** | **0** | **0** |

**整体健康度**: 可进入 `/forge`  
**高信号结论**: REQ 级与 Contract 级 ops surface 覆盖已对齐；INT-S4 不再替 `goal/status/cycle` 承担 producer 职责。

### REQ 覆盖率

| REQ-ID | 标题 | 优先级 | 关联任务 | 状态 |
| --- | --- | :---: | --- | :---: |
| REQ-001 | Dream 异步记忆整理 | P0 | T4.1.5, T7.1.1-T7.1.5, T5.1.1, T1.2.2, INT-S2 | Covered |
| REQ-002 | Agent 自我叙事与目标追求 | P0 | T4.1.2, T4.1.4, T2.1.4, T2.1.5, T5.1.2, T1.2.1, T1.2.4, INT-S3 | Covered |
| REQ-003 | 与 owner 的关系记忆 | P0 | T4.1.3, T7.1.5, T6.1.1, T2.3.1, INT-S3 | Covered |
| REQ-004 | Connector Ecosystem 动态扩展 | P0 | T3.1.1, T3.1.2, T3.2.1, T5.1.3, T1.3.1, T1.2.3, INT-S1 | Covered |
| REQ-005 | Outreach 有叙事来由 | P1 | T6.1.1, T2.3.1, INT-S3 | Covered |
| REQ-006 | 可观测性消费 | P1 | T5.1.1, T5.1.2, T5.1.3, T1.2.1-T1.2.6, INT-S4 | Covered |

**覆盖率**: 6/6 REQ 有任务链；命令契约粒度已通过 Round 6 回流闭合。

### User Story 完整性

| US-ID | 标题 | 涉及系统 | 关联任务 | 独立可测 | 状态 |
| --- | --- | --- | --- | :---: | :---: |
| US-001 | Dream 异步记忆整理 | dream/state/observability/guidance | 05A User Story Overlay 已覆盖 | 是 | Covered |
| US-002 | Agent 自我叙事与目标追求 | control-plane/state/guidance/cli | 状态、planning 与 `sn goal` ops 已覆盖 | 是 | Covered |
| US-003 | 与 owner 的关系记忆 | state/control-plane/guidance | 05A User Story Overlay 已覆盖 | 是 | Covered |
| US-004 | Connector Ecosystem 动态扩展 | connector/cli | 05A User Story Overlay 已覆盖 | 是 | Covered |
| US-005 | Outreach 有叙事来由 | control-plane/guidance/connector | 05A User Story Overlay 已覆盖 | 是 | Covered |
| US-006 | 可观测性消费 | cli/observability/state | narrative/dream/connector/goal/status/cycle 已覆盖 | 是 | Covered |

### 术语一致性

| 术语 | PRD 中 | Architecture 中 | Tasks 中 | 状态 |
| --- | --- | --- | --- | :---: |
| AgentGoal / goal | `sn goal set` 与 goal priority | `goal` 设定与 `AgentGoal` 状态 | `AgentGoal` storage + planning + T1.2.4 `goal` command | Pass |
| cycle:recent | 未作为 PRD 直接命令，但属于可观测性消费 | cli-system 新增 debug 命令 | T1.2.5 + INT-S4 | Pass |
| status | `sn status` / `second_nature_ops status` 须显示 v6 摘要 | cli-system command set 有 aggregate summary | T1.2.6 + INT-S4 | Pass |
| narrative / dream / connector status | PRD 与 Architecture 一致 | cli-system 命令一致 | T1.2.1-T1.2.3 覆盖 | Pass |

### 契约覆盖率

| 契约 | 类型 | 实现承接 | 验证承接 | 状态 |
| --- | --- | --- | --- | :---: |
| `sn narrative` | CLI/tool | T1.2.1 | T1.2.1, INT-S4 | Covered |
| `sn dream:recent` | CLI/tool | T1.2.2 | T1.2.2, INT-S4 | Covered |
| `sn connector:status/test` | CLI/tool | T1.2.3 | T1.2.3, INT-S4 | Covered |
| `sn connector init` | CLI/tool | T1.3.1 | T1.3.1 | Covered |
| `sn goal set/list/accept/reject` | CLI/tool + state transition | T4.1.4, T1.2.4 | T1.2.4, INT-S4 | Covered |
| `sn cycle:recent` | CLI/tool read model | T1.2.5 | T1.2.5, INT-S4 | Covered |
| `sn status` v6 aggregate | CLI/tool read model | T1.2.6 | T1.2.6, INT-S4 | Covered |

**设计证据来源**: 已读取 `04_SYSTEM_DESIGN/*`。

### 关键路径

当前 05A 的最长核心链仍合理：`T4.1.1 -> T4.1.5 -> T7.1.1 -> T7.1.2/T7.1.3/T7.1.4/T7.1.5 -> T5.1.1 -> T1.2.2 -> INT-S2`。Round 6 后，S4 的 `goal/status/cycle` producer task 已补齐。

### 核心发现清单

| ID | 严重度 | Pass | 位置 | 发现 | 影响 | 建议 |
| --- | --- | --- | --- | --- | --- | --- |
| TR6-01 | High | D/E/G | `cli-system.md:58`, `05A_TASKS.md:28`, `05A_TASKS.md:692`, `05B_VERIFICATION_PLAN.md:367` | `goal`、`cycle:recent`、`status` 的设计契约原先没有被 05A/05B 逐项承接。 | 已通过 T1.2.4-T1.2.6 与 05B 覆盖矩阵闭合。 | 已闭合；`/forge` 执行时按新增任务实现。 |

### Top Findings 详情

#### TR6-01 v6 ops surface 任务承接缺口

**Pass**: D/E/G  
**严重度**: High  
**位置**: `04_SYSTEM_DESIGN/cli-system.md:58`, `04_SYSTEM_DESIGN/cli-system.md:244`, `04_SYSTEM_DESIGN/cli-system.md:249`, `04_SYSTEM_DESIGN/cli-system.md:250`, `05A_TASKS.md:28`, `05A_TASKS.md:692`, `05B_VERIFICATION_PLAN.md:367`

**证据**:
- 需求来源: `01_PRD.md:98` 写明 owner 可通过 `sn goal set` 设定 goal，`01_PRD.md:157` 与 `:161` 要求 `sn status` / `second_nature_ops status` 展示人类可读的 v6 状态。
- 设计来源: `cli-system.md:58` 要求实现 `narrative`、`goal`、`dream:recent`、`connector:status`、`connector:test`、`connector init`、`cycle:recent` 命令契约，`cli-system.md:244`、`:249`、`:250` 分别定义 `sn goal`、`sn cycle:recent`、`sn status`。
- 任务映射: Round 6 前 `05A/05B` 只把 `sn narrative` / `sn dream:recent` / `sn connector:status` 列为 ops surface 任务承接；Round 6 后新增 T1.2.4 `goal`、T1.2.5 `cycle:recent`、T1.2.6 `status`，并同步 05B 覆盖矩阵。

**影响**:
Round 6 前，S4 可能在没有 `goal` command、没有 `cycle_recent` read model、没有 v6 aggregate `status` 升级任务的情况下进入验收；Round 6 后该风险已降为实现阶段遵循风险。

**回流结果**:
已通过 `/change` 新增 `T1.2.4 goal command`、`T1.2.5 cycle:recent read model`、`T1.2.6 v6 status aggregate`，并在 05B 增加对应 API 接口功能测试、host-safe envelope、空态与 redaction 验证。

---

## 承诺闭合验证

| 维度 | 结论 | 证据 | 对应问题 |
| --- | --- | --- | --- |
| 重复态 | Pass | DreamRunLock、ConnectorRegistrySnapshot、candidate lifecycle 已定义。 | 无 |
| 失败态 | Pass | Dream `budget_exceeded`、`redaction_failed`、`model_timeout`，connector fail-closed，guidance blocked/degraded 均有设计语义。 | 无 |
| 默认态 | Pass | custom adapter 默认 pending trust，goal proposal 默认不影响 priority，candidate memory 默认不被 heartbeat 消费。 | 无 |
| 运行态 | Pass | `goal`、`cycle:recent`、`status` 已有 T1.2.4-T1.2.6 producer tasks。 | TR6-01 已闭合 |
| 并发态 | Pass | DreamRunLock 与 immutable connector snapshot 已覆盖主要并发链。 | 无 |
| 观测态 | Pass | narrative/dream/connector/goal/status/cycle 可观测任务均闭合。 | TR6-01 已闭合 |
| 安全边界 | Pass | connector trust、redaction、pending trust/no-overwrite/path safety 已有任务或验证承接。 | 无 |
| 验证责任 | Pass | 05B 三个 Overlay 已补齐 `goal/status/cycle`。 | TR6-01 已闭合 |

---

## 建议行动

| 优先级 | 行动 | 完成信号 |
| --- | --- | --- |
| P1 | 进入 `/forge` 前同时读取 05A/05B。 | `/forge` 能定位 T1.2.4-T1.2.6 与 INT-S4 的双向验证锚点。 |
| P1 | S4 实现时不要只做 INT 冒烟，必须先完成 producer tasks。 | `goal/status/cycle` 命令与 read model 均有独立测试证据。 |

---

## 最终判断

Round 6 `/change` 后可以进入 `/forge`。

当前没有开放的 Critical / High forge blocker。v6 ops surface 的任务承接缺口已闭合，后续实现阶段按 05A/05B 执行，别绕过 T1.2.4-T1.2.6 直接拿 INT-S4 冒烟凑数。
