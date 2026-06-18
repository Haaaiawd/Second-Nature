# v8 Challenge Report — Round 4 (Wave 116 Design/Task Challenge) — with Round 3 Archive

**Target Dir**: `.anws/v8`
**Review Date**: 2026-06-18
**REVIEW_MODE**: `FULL` (design review + task review executed; code review skipped because Wave 116 is planned-only)
**Reviewer**: Nyx / multi-agent static analysis
**Scope**: Wave 116 planned contracts in `04_SYSTEM_DESIGN/`, `05A_TASKS.md`, `05B_VERIFICATION_PLAN.md`; checks robustness, feasibility, and information gaps before `/forge`

---

## 1. 问题总览

### Round 1 / Round 2 / Round 3（已归档）

| Round | ID 范围 | 最高严重度 | 状态 |
|-------|---------|-----------|:----:|
| Round 1 | DR-01 ~ DR-06 | High | Closed |
| Round 2 | CH-07 ~ CH-11 | High | Closed |
| Round 3 | CH-12 ~ CH-23 | Critical | Partially closed; remaining structural issues rolled into Round 4 / Wave 116 |

### Round 4（当前活跃）

| 严重度 | 数量 | 摘要 |
|--------|------|------|
| **Critical** | 0 | 无根本性不可能继续的阻断项 |
| **High** | 7 | `evidenceLevel` 无晋级规则、host 可见性无探测端口、`CycleFinalizer` 无恢复协议、v7 心跳可能冒充 v8、setup ack  schema 未定义、stage status 语义过载/ L0·L1 冲突、现有代码已把 proofRefs 混入 sourceRefs |
| **Medium** | 4 | ID-only evidence 到 perception 的交接未定义、Quiet/Dream trigger 归属模糊、T-ROS.R.7 依赖顺序可疑、验证过度依赖手动 host smoke |

**处置更新（2026-06-18）**: Round 4 文档层缺口已通过 Wave 116 `/change` documentation repair 回补；代码实现仍未开始，CH-30 的实现冲突由 Wave 116 `/forge` 任务承接。

---

## 2. 审查摘要

### 2.1 Mode Detection

| Item | Result |
| --- | --- |
| Latest architecture version | `.anws/v8` |
| `05A_TASKS.md` | Present |
| `05B_VERIFICATION_PLAN.md` | Present |
| `src/` v8 implementation | Present and active; no Wave 116 implementation yet |
| Review mode | `FULL` — user explicitly requested comprehensive challenge of Wave 116 planning documents |
| Design review | Executed via dedicated sub-agent + `design-reviewer` skill |
| Task review | Executed via dedicated sub-agent + `task-reviewer` skill |
| Code review | Skipped — Wave 116 is planned-only; no implementation code exists; pre-implementation notes collected |

### 2.2 Evidence Sources

| Source | Purpose |
| --- | --- |
| `.anws/v8/01_PRD.md` | Product commitments (Living Perception Loop, memory formation) |
| `.anws/v8/02_ARCHITECTURE_OVERVIEW.md` | System inventory and dependency direction |
| `.anws/v8/03_ADR/` | Accepted decisions on loop, memory, autonomy policy, causal health |
| `.anws/v8/04_SYSTEM_DESIGN/` | L0/L1 port contracts per system, including Wave 116 patches |
| `.anws/v8/05A_TASKS.md` | Wave 116 task descriptions, dependencies, acceptance criteria |
| `.anws/v8/05B_VERIFICATION_PLAN.md` | Wave 116 verification plans and traceability matrix |
| `src/` (preview only) | Existing code patterns that Wave 116 will have to modify |

### 2.3 Metrics

| 维度 | 发现数 | Critical | High | Medium | Low |
| --- | :---: | :---: | :---: | :---: | :---: |
| 系统设计 (SD) | 5 | 0 | 4 | 1 | 0 |
| 运行模拟 (RS) | 2 | 0 | 1 | 1 | 0 |
| 工程实现 (EI) | 1 | 0 | 1 | 0 | 0 |
| 任务审查 (TR) | 3 | 0 | 1 | 2 | 0 |
| 代码预检 (CR) | 0 | 0 | 0 | 0 | 0 |
| **Total** | **11** | **0** | **7** | **4** | **0** |

**高信号结论**: Wave 116 的方向正确，但文档层面的契约还停在“意图”层，缺少可执行的端口、状态机和 schema。若直接进入 `/forge`，实现者会各自解释 `evidenceLevel`、`host_tool_unavailable`、`CycleFinalizer` 等关键概念，导致 Wave 116 完成后仍无法复现验证。

---

## 3. 承诺模型摘要

| 承诺类型 | 承诺摘要 | 契约来源 | 当前失真风险 |
|---------|---------|---------|-------------|
| 结果承诺 | Evidence → Perception → Judgment → Action Closure → Quiet/Dream → Projection | PRD §3.1 / ADR-002,003 | ID-only evidence 到 perception 的交接未定义，可能继续 fabricate summaries |
| 状态承诺 | Memory 仅由 Quiet/Dream 形成；Projection 生命周期 candidate→accepted→active→superseded | PRD §3.1 G5 / ADR-003 | Quiet/Dream trigger 归属在 control-plane 与 dream-quiet 之间仍模糊 |
| 时间承诺 | Evidence→Perception 在 2 个 heartbeat 内；Quiet 36h stale；Dream 6h after Quiet | PRD §3.1 G1 / shared-v8-contracts.md §3.3 | v7 heartbeat 仍可能作为 operator-facing 输出，造成 cycle 真相源 dual |
| 错误承诺 | 统一 V8ReasonCode；默认失败路径降级而非崩溃 | shared-v8-contracts.md §4.1 / §5 | `DegradedOperationResult.status` 与 `StageHealth.status` 都使用/禁止 `degraded`，语义冲突 |
| 安全承诺 | Write-side 经 policy gate；public technical 不误阻 | PRD §3.1 G2,G4 / ADR-004 | proofRefs 已混入 sourceRefs；分离后需迁移清单 |
| 审计承诺 | 100% Dream lifecycle trace；loop_status 定位 stalled stage | PRD §3.1 G6,G8 / ADR-005 | `evidenceLevel` 无晋级规则，operator 仍可能把 smoke/carrier 当作 real runtime |
| 运行承诺 | Action dispatch 带 idempotency key；connector 执行有 proof | AC L1 §2.2 / §3.3 / §3.4 | `CycleFinalizer` 缺少 idempotency/recovery 协议；现有 closure 调用已分散在 orchestrator 各分支 |

---

## 4. Pre-Mortem

| 失败原因 | 失真契约 | Root Cause | 证据 | 概率 | 影响 |
|---------|---------|-----------|------|:----:|:----:|
| Wave 116 完成后 loop_status 仍把 carrier/smoke 报成 real runtime | 审计承诺 / evidenceLevel | `evidenceLevel` 只有枚举，无 transition/promotion 规则或 command-to-level 映射 | `shared-v8-contracts.md §4.2`; `runtime-ops-system.md §2`; `observability-health-system.md §6.1` | 高 | 宿主误以为系统已真实运行，错过修复窗口 |
| `second_nature_ops` 未注入却报告 setup complete | 运行承诺 / host reality | 无 `HostCapabilityDiscoveryPort` 或 `SkillRegistryPort` 契约，诊断无法触发 | `runtime-ops-system.md §3.1` | 高 | 用户按“完成”状态使用，实际无工具可用 |
| 一次 heartbeat 产生多个 closure 或丢失 closure | 运行承诺 / 幂等 | `CycleFinalizer` 缺少 idempotency key、写顺序、部分失败恢复协议 | `action-closure-policy-system.md §5.1, §6.1` | 高 | Quiet 输入和 `loop_status` 都基于错误的 closure 集合 |
| v7 heartbeat 被包装为 v8 living-loop 输出 | 时间承诺 / cycle 真相源 | 无显式 command-to-model 路由门，runtime-ops 可能把 v7 adapter run 包进同一 envelope | `control-plane-system.md §1`; `runtime-ops-system.md §2` | 中高 | operator 看到两套 cycle 数据，stalled 归因错位 |
| `placedIn: "unspecified"` 继续被当作完成 | 运行承诺 / setup truth | ack 文件无 schema、合法值枚举、writer 授权或完整性校验 | `runtime-ops-system.md §3.1`; `src/cli/commands/index.ts:144-157`; `plugin/index.ts:568-579` | 高 | setup 虚假闭合，host reality 未经验证 |

---

## 5. 核心发现清单

| ID | 类别 | 严重度 | 位置 | 发现 | 影响 | 建议 |
|----|------|--------|------|------|------|------|
| CH-24 | 系统设计 | **High** | `shared-v8-contracts.md §4.2`; `runtime-ops-system.md §2`; `observability-health-system.md §6.1` | `evidenceLevel` 定义了五层，但没有 transition/promotion 规则或 command-to-level 映射。 | `carrier_ack`/`state_present` 可能被当作 living-loop health，重现 Wave 116 想消除的 masquerading。 | 增加 `EvidenceLevelClassifier` 契约/状态机，规定从 envelope 产生到 durable readback 的晋级条件，并要求 `loop_status` 取各 stage 最小 level。 |
| CH-25 | 系统设计 | **High** | `runtime-ops-system.md §3.1` | Host reality 要求 `second_nature_ops` 可见、`SKILL.md` 可发现，但未定义 `HostCapabilityDiscoveryPort` 或 `SkillRegistryPort`。 | `host_tool_unavailable` / `skill_projection_unavailable` 无法可靠产生，依赖 host-specific hack。 | 定义 `HostCapabilityDiscoveryPort`（`listHostTools()` / `isSkillDiscovered(skillId)`），并提供 real-host / mock / carrier-fallback 实现。 |
| CH-26 | 系统设计 | **High** | `action-closure-policy-system.md §5.1, §6.1` | `CycleFinalizer` 负责 exactly-one terminal closure，但缺少 idempotency key、写顺序、部分失败恢复协议。 | closure 写成功但 stage event 失败会导致 `loop_status` 漏判；反之可能产生 duplicate closure。 | 指定 idempotency key（如 `cycleId`）、写顺序（state row 先，event 后）、以及周期启动时的 reconcile reader。 |
| CH-27 | 系统设计 | **High** | `control-plane-system.md §1`; `runtime-ops-system.md §2`; `src/cli/ops/heartbeat-surface.ts:149-167,253-299` | v7 heartbeat 兼容路径被要求隐藏为 adapter trace，但无 command-to-model 路由门；现有 `heartbeat-surface.ts` 仍把 v7 结果和 v8 spine 并列返回。 | v7 adapter run 可能被包进同一 `RuntimeOpsEnvelope` 并标为 `real_runtime`，重现 dual heartbeat truth。 | v8 控制面删除 v7 heartbeat 入口；旧 v7 请求返回 `version_obsolete` 或 `command_unavailable`，operator 面只展示 v8 cycle。 |
| CH-28 | 任务审查 | **High** | `05A_TASKS.md §T-ROS.R.7`; `05B_VERIFICATION_PLAN.md §T-ROS.R.7` | “投影到 host skill registry”没有定义宿主接口、探针信号或 blocked 判定条件。 | 任务不可独立验证，forge 后易出现“无宿主接口即算 blocked”的假闭合。 | 在 `runtime-ops-system.md` 补充 `SkillDiscoveryProbe` 契约与 `skill_projection_unavailable` 触发条件。 |
| CH-29 | 任务审查 | **High** | `05A_TASKS.md §T-ROS.R.5`; `05B_VERIFICATION_PLAN.md §T-ROS.R.5` | 宿主工具可见性依赖 OpenClaw/Feishu 实机 smoke，自动化测试无法覆盖，且未规定 host smoke 日志最小字段。 | INT-R11 可能接受不可复现的手动日志，存在伪造或环境差异风险。 | 拆分验证：自动化 plugin-bridge 断言 + 独立 manual host smoke 附录，强制要求 tool list JSON snapshot 与 host version。 |
| CH-30 | 代码预检 / 系统设计 | **High** | `runtime-ops-system.md §3.1`; `src/cli/commands/index.ts:144-157`; `plugin/index.ts:568-579`; `action-closure-policy-system.md §6.1`; `src/core/second-nature/control-plane/heartbeat-orchestrator.ts:234,294,372,393,413,437,647`; `src/core/second-nature/action/action-closure-recorder.ts:48-65` | 现有代码已接受 `placedIn: "unspecified"` 为完成；closure 接口只有 `sourceRefs` 且 orchestrator 把 `decision.proofRefs` 作为 `sourceRefs` 写入；closure 调用分散在 orchestrator 多个分支。 | Wave 116 的实现将直接撞上这些冲突：setup 会虚假闭合，provenance 分离不彻底，exactly-one 边界难以收敛。 | 在 `/forge` 前先清理现有代码：拒绝 unspecified ack、给 `ActionClosureRecord` 增加 `proofRefs`/`traceRefs`、把 closure 调用集中到一处入口。 |
| CH-31 | 系统设计 / 任务审查 | **High** | `shared-v8-contracts.md §4.1`; `observability-health-system.md §6.1`; `observability-health-system.detail.md §2.2` | `DegradedOperationResult.status` 仍包含 `degraded`，而 `StageHealth.status` 声明 `degraded` 仅用于 aggregate；L0 与 L1 的 `StageHealth.status` 枚举不一致。 | 实现者可能在 stage 层继续使用 `degraded`，违背 T-OBS.R.8 的精确状态要求。 | 统一 L0/L1 枚举，删除 L1 中的 stage-level `degraded`；`DegradedOperationResult` 也改为暴露精确状态。 |
| CH-32 | 运行模拟 | **Medium** | `connector-system.md §6`; `01_PRD.md` §4 US-001 | Connector 要求 ID-only result 标为 `content_missing` 且禁止 fabrication，但未指定 perception-stage 交接或 canonical stall reason。 | Perception 可能继续从 bare IDs 生成 summaries，或 `loop_status` 对 stall 归因模糊。 | 在 perception-judgment-system design 中定义 `content_missing` 输入契约，并分配 `evidence_id_only` reason code。 |
| CH-33 | 运行模拟 | **Medium** | `control-plane-system.md §4`; `dream-quiet-memory-system.md §6.4` | Control-plane 流程写 “maybe trigger Quiet/Dream”，而 Dream-Quiet 拥有 daily/7-day 调度策略，trigger 归属模糊。 | 可能漏掉 Quiet review 或重复调度 Dream。 | 明确 control-plane 只发 trigger request，Dream-Quiet scheduler 应用 daily/7-day 策略；文档化 trigger envelope。 |
| CH-34 | 任务审查 | **Medium** | `05A_TASKS.md §T-ROS.R.7` 依赖行 | T-ROS.R.7 声明依赖 T-ROS.R.8，但 T-ROS.R.8 无依赖，且两者是 setup 的不同切面。 | 依赖顺序可能颠倒或不必要，影响排期。 | 移除或反转依赖：skill projection 不应必须等待 ack placement。 |
| CH-35 | 任务审查 | **Medium** | `05B_VERIFICATION_PLAN.md` Testing Coverage Overlay | Wave 116 主机现实任务标记为 ⏳，但未区分自动化测试与手动 smoke 的证据权重。 | INT-R11 可能把手动 host 截图/日志当作充分证据。 | 在 05B 中标注每个 Wave 116 任务的“必须自动化证据”与“可选 manual host evidence”。 |

---

## 6. 子代理结果摘要

### 6.1 Design Reviewer

| 维度 | 结论 | 关键证据 |
|------|------|----------|
| 系统设计 | 5 findings (0 Critical / 4 High / 1 Medium) | `evidenceLevel` 无晋级规则；host discovery port 缺失；`CycleFinalizer` 无恢复协议；v7/v8 路由门缺失；setup ack schema 缺失 |
| 运行模拟 | 2 findings (0 Critical / 1 High / 1 Medium) | ID-only evidence 到 perception 交接未定义；Quiet/Dream trigger 归属模糊 |
| 工程实现 | 1 finding (0 Critical / 1 High / 0 Medium) | `DegradedOperationResult.status` 与 `StageHealth.status` 的 `degraded` 语义冲突 |

### 6.2 Task Reviewer

| Pass | 结论 | 关键证据 |
|------|------|----------|
| A 重复检测 | Clean | 无 Wave 116 内部重复 |
| B 歧义检测 | 1 Medium | `T-ROS.R.7` “actual host skill discovery” 未量化 |
| C 欠详述检测 | 1 High / 3 Medium | `T-ROS.R.8` 合法 `placedIn` 未枚举；`T-SH.R.6` 受影响 payload 清单缺失；`INT-R11` 检查表面未枚举 |
| D 不一致性检测 | 1 High / 1 Medium | `StageHealth.status` L0/L1 冲突；`T-ROS.R.7` 对 `T-ROS.R.8` 依赖方向可疑 |
| E 覆盖率检测 | Clean | 9/9 REQ 已承接 |
| F 质量粒度 | Clean | 粒度可接受 |
| G 契约覆盖 | 2 High / 2 Medium | `T-ROS.R.5`/`T-ROS.R.7` 宿主侧接口未定义；`T-CP.R.5` 验证以 docs search 为主 |

### 6.3 Code Reviewer

| Lens | 结论 |
|------|------|
| L1-L3, L5-L6 | Skipped — Wave 116 尚无实现代码 |
| L4 | Partially applicable — 现有代码已存在与 Wave 116 计划冲突的模式 |
| 预实现注意 | setup ack、proofRefs/sourceRefs、closure 分散、heartbeat surface dual model 等需要在 `/forge` 前识别并清理 |

---

## 7. 建议行动清单

### P0 — 在 Wave 116 `/forge` 之前必须闭合（否则实现分歧）

1. **[CH-24]** 在 `shared-v8-contracts.md` 增加 `EvidenceLevelClassifier` 契约：定义 envelope → smoke → state-present → real-runtime → durable-verified 的晋级条件。
2. **[CH-25]** 在 `runtime-ops-system.md` 定义 `HostCapabilityDiscoveryPort` / `SkillRegistryPort`；至少包含 `listHostTools()` 与 `isSkillDiscovered(skillId)`。
3. **[CH-26]** 在 `action-closure-policy-system.md` 补充 `CycleFinalizer` 的 idempotency key、写顺序、部分失败 reconcile 协议。
4. **[CH-27]** 在 `control-plane-system.md` / `runtime-ops-system.md` 定义单一 v8 living-loop 命令契约；v8 控制面删除 v7 heartbeat 入口，旧请求返回 `version_obsolete`/`command_unavailable`。
5. **[CH-30]** 清理现有代码中直接与 Wave 116 冲突的三处：setup ack 默认 unspecified、closure 接口缺少 `proofRefs`/`traceRefs`、orchestrator 中分散的 closure 调用。
6. **[CH-31]** 统一 `StageHealth.status` L0/L1 枚举，并同步调整 `DegradedOperationResult.status`。

### P1 — 应在 Wave 116 实现阶段同步闭合

7. **[CH-28]** 在 `connector-system.md` / `perception-judgment-system.md` 定义 `content_missing` evidence 的 perception 输入契约与 stall reason code。
8. **[CH-29]** 将 `T-ROS.R.5` 验证拆分为自动化 plugin-bridge 断言 + manual host smoke 附录，规定最小日志字段。
9. **[CH-32]** 明确 control-plane trigger request 与 Dream-Quiet scheduler policy 的边界。
10. **[CH-34]** 修正 `T-ROS.R.7` 对 `T-ROS.R.8` 的依赖关系。

### P2 — 后续持续改进

11. **[CH-34]** 在 `05B_VERIFICATION_PLAN.md` 中区分 Wave 116 任务的必须自动化证据与可选 manual host evidence。
12. 将 Round 3 剩余的 CH-17 ~ CH-23 排入后续重构 wave（ports、测试工厂、helper 统一、架构 lint）。

---

## 8. 承诺闭合与假设验证摘要

| 项目 | 结论 | 证据 | 对应问题 |
|------|------|------|----------|
| 结果承诺 | Partial | ID-only evidence 交接仍不完整 | CH-32 |
| 状态承诺 | Partial | Quiet/Dream trigger 归属需澄清 | CH-33 |
| 时间承诺 | Partial | v7/v8 双 heartbeat 路由门未定义 | CH-27 |
| 错误承诺 | Partial | `degraded` 语义在 L0/L1 与 `DegradedOperationResult` 冲突 | CH-31 |
| 安全承诺 | Partial | proofRefs 已混入 sourceRefs；分离需要迁移清单 | CH-30 |
| 审计承诺 | Partial | `evidenceLevel` 无晋级规则 | CH-24 |
| 运行承诺 | Partial | `CycleFinalizer` 缺少恢复协议；closure 调用已分散 | CH-26, CH-30 |
| 宿主现实 | Fail | 无 host discovery port；setup ack schema 未定义；现有代码接受 unspecified | CH-25, CH-28, CH-30 |

---

## 9. ADR 影响追踪

| ADR 文件 | 引用该 ADR 的 SYSTEM_DESIGN | 影响说明 |
|---------|---------------------------|---------|
| ADR-002_LIVING_PERCEPTION_LOOP.md | perception-judgment-system.md / action-closure-policy-system.md / control-plane-system.md | v7 heartbeat 仍可能冒充 v8 living-loop；需明确 v8-only operator model |
| ADR-003_QUIET_DREAM_LONG_TERM_MEMORY.md | dream-quiet-memory-system.md / state-memory-system.md | Quiet/Dream trigger 归属需澄清，否则长期记忆形成时序不稳定 |
| ADR-004_PLATFORM_NEUTRAL_AUTONOMY_POLICY.md | action-closure-policy-system.md / body-tool-system.md / connector-system.md / guidance-voice-system.md | proofRefs 混入 sourceRefs 违背平台中立行动边界；需迁移 |
| ADR-005_CAUSAL_LOOP_HEALTH.md | observability-health-system.md / runtime-ops-system.md / control-plane-system.md | `evidenceLevel` 无晋级规则会削弱 causal loop health 的可信度 |

---

## 10. 最终判断

- [ ] 项目可继续，风险可控
- [x] 项目可继续，但需先解决 P0 问题
- [ ] 项目需要重新评估

**判断依据**: Round 4 发现 0 个 Critical、7 个 High、4 个 Medium。虽然没有根本性阻断项，但 P0 问题全是文档层缺口；不先闭合就进入 `/forge`，Wave 116 的实现会产生多重解释，INT-R11 证据将不可复现。

**Routing**:
- **原始路由**: 不要立即进入 `/forge`；先通过一次 `/change` 文档修复波次收敛 P0 项（CH-24 ~ CH-31）。
- **处置更新（2026-06-18）**: 文档 P0 已回补；建议重新跑一次 lightweight challenge 确认闭合，或在用户签收后进入 Wave 116 `/forge`。
- **实现边界**: CH-30 中的现有代码冲突尚未实现修复，不得在 forge 前标为完成，只能作为 Wave 116 implementation acceptance。

---

## 11. Round 4 修复归档（待后续填写）

| Finding | Closure Evidence | Status |
| --- | --- | --- |
| CH-24 | `shared-v8-contracts.md §4.3` adds `EvidenceLevelClassifier`; `runtime-ops-system.md §3.3` caps command evidence levels; `05A/05B` require classifier tests | Closed (docs) |
| CH-25 | `runtime-ops-system.md §3.1` adds `HostCapabilityDiscoveryPort`, tool/skill probe results, blocked/unsupported/timeout reasons | Closed (docs) |
| CH-26 | `action-closure-policy-system.md §6.1a` and L1 §3.4 add `CycleFinalizer` idempotency key, write order, and partial-failure recovery | Closed (docs) |
| CH-27 | `control-plane-system.md §4.1` and `runtime-ops-system.md §3.3` define v8-only operator heartbeat and explicit rejection of legacy v7 heartbeat requests | Closed (docs) |
| CH-28 | `runtime-ops-system.md §3.1` and `05A/05B T-ROS.R.7` define `SkillDiscoveryProbe` outcomes and precise `skill_projection_unavailable` handling | Closed (docs) |
| CH-29 | `05A/05B T-ROS.R.5` split automated plugin/host discovery proof from manual host smoke appendix with required fields | Closed (docs) |
| CH-30 | `05A/05B` and action/runtime design now explicitly require rejecting unspecified ack, adding `proofRefs`/`traceRefs`, and centralizing closure in `CycleFinalizer`; source code repair remains Wave 116 implementation work | Planning gap closed / code open |
| CH-31 | `shared-v8-contracts.md §4.1`, `observability-health-system.md §6.1`, and `observability-health-system.detail.md §2.2` align precise status taxonomy and remove stage-level `degraded` | Closed (docs) |
| CH-32 | `perception-judgment-system.md §4.3` defines `content_missing` handoff and `evidence_id_only` reason | Closed (docs) |
| CH-33 | `control-plane-system.md §4.2` and `dream-quiet-memory-system.md §4.3` define `DailyRhythmTriggerRequest` and scheduler ownership; `05A/05B T-CP.R.5`, `T-DQ.R.9`, and `INT-R11` now explicitly verify the trigger envelope and scheduler ownership | Closed (docs) |
| CH-34 | `05A T-ROS.R.7` dependency changed to `none`; skill projection no longer waits for setup ack placement | Closed (docs) |
| CH-35 | `05B` distinguishes automated host discovery/plugin evidence from manual host smoke appendix | Closed (docs) |

---

## 12. Round 3 Archive — Code Health (2026-06-16)

### 12.1 原 Round 3 问题总览

| 严重度 | 数量 | 摘要 |
|--------|------|------|
| **Critical** | 5 | SourceRef 契约漂移、v7/v8 双心跳无单一真相源、connector evidence 三重持久化、运行时神模块、双 status + SourceRef 序列化碎片化 |
| **High** | 6 | 控制平面直接依赖 StateDatabase、connector executor 越界、storage-guidance 循环依赖、observability 直接读 state 内部、console.warn 吞错误、测试重复与跳过用例 |
| **Medium** | 1 | `safeParseJson` 等 helper 重复 13 次 |

### 12.2 修复归档

| Finding | Closure Evidence | Status |
| --- | --- | --- |
| CH-12 | Wave 112-113: canonical `SourceRef` object shape; removal of `ControlPlaneSourceRef`, host-capability, and life-evidence local clones; `SourceRefTuple` for v7 | Closed |
| CH-13 | Not closed by Waves 112-115; rolled into Round 4 / Wave 116 `T-CP.R.5` (single external heartbeat model) | Open / Round 4 |
| CH-14 | Partially addressed by Wave 109 content-bearing evidence; remaining v7/v8 dual persistence rolled into Round 4 / Wave 116 `T-CS.R.9` + `T-SH.R.6` | Open / Round 4 |
| CH-15 | Not closed by Waves 112-115; closure scatter partially rolled into Round 4 / Wave 116 `T-AC.R.2` (`CycleFinalizer`); ops-router / orchestrator god modules remain future work | Open / Round 4 |
| CH-16 | Wave 114-115: single semantic `status` column per v8 table; shared `parseSourceRefs`/`serializeSourceRefs` in `src/shared/serialization.ts` | Closed |
| CH-17 ~ CH-23 | Not closed; deferred to future refactoring waves (repository ports, telemetry/credential boundary decoupling, cycle dependency breakup, `StateHealthPort`, `console.warn` cleanup, test factories, helper unification) | Open / Deferred |

### 12.3 原 Round 3 最终判断（历史记录）

- [ ] 项目可继续，风险可控
- [x] 项目可继续，但需先解决 P0 问题
- [ ] 项目需要重新评估

**原判断依据**: Round 3 发现 5 个 Critical、6 个 High、1 个 Medium。CH-12 ~ CH-16 属于结构性阻断问题。

---

## 13. Round 2 修复归档（供追溯）

| Finding | Closure Evidence | Status |
| --- | --- | --- |
| CH-07 | `action-closure-policy-system.detail.md` 增加 `guidance_unavailable` / `closure_downgraded_without_draft`；`05A_TASKS.md` 移除 T-AC.C.3 对 T-GVS.C.1 的硬依赖；`05B_VERIFICATION_PLAN.md` 增加 guidance-unavailable dispatch/closure 验证 | Closed |
| CH-08 | `shared-v8-contracts.md §3.3` 定义 heartbeat rhythm contract；`control-plane-system.md` 和 `observability-health-system.detail.md` 明确 heartbeat-count SLA 使用 `cycleSequence` | Closed |
| CH-09 | `shared-v8-contracts.md §4.1` 定义 `DegradedOperationResult` 和 state unreadable/source unresolved/guidance unavailable 最小响应 | Closed |
| CH-10 | `action-closure-policy-system.detail.md §3.4` 定义 idempotency retry matrix；`05A/05B` 增加 duplicate retry 验证 | Closed |
| CH-11 | 补齐 `runtime-ops-system.md`, `control-plane-system.md`, `state-memory-system.md`, `body-tool-system.md`, `connector-system.md`, `guidance-voice-system.md` | Closed |

---

## 14. Round 1 修复归档（供追溯）

| Finding | Closure Evidence | Status |
| --- | --- | --- |
| DR-01 | `shared-v8-contracts.md` 定义 `HeartbeatCycleTrace` 和 `LoopStageEvent.cycleSequence` | Closed |
| DR-02 | `shared-v8-contracts.md` 定义 `MemoryReviewCandidateClosure`；action closure 和 Dream/Quiet L1 路由 `remember` 通过 `remember_for_review` | Closed |
| DR-03 | `shared-v8-contracts.md` 定义单一 action registry 和 connector capability side-effect classification | Closed |
| DR-04 | `shared-v8-contracts.md` 定义结构化 `SourceRef`；L0/L1 文档使用 `SourceRef[]` | Closed |
| DR-05 | `PerceptionCard` 和 memory-review closure 包含 `reviewPriority`；Dream/Quiet 消费 memory review candidates | Closed |
| DR-06 | `shared-v8-contracts.md` 定义 canonical reason codes；DQ 和 OBS 使用 shared code | Closed |
