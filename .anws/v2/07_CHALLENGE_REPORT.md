# Second Nature 质疑报告 (Challenge Report)

> **审查日期**: 2026-03-24  
> **审查范围**: `.anws/v2` 设计文档 (`01_PRD.md`, `02_ARCHITECTURE_OVERVIEW.md`, `03_ADR/`, `04_SYSTEM_DESIGN/`)  
> **累计轮次**: 4

---

## 📋 问题总览

> 此目录随每轮审查同步维护。已解决轮次仅保留摘要；当前仅保留第 4 轮详细内容。

### 第一轮（2026-03-23，4/4 已回应）

| ID | 严重度 | 摘要 | 状态 |
|----|--------|------|------|
| C1 | 🔴 | Owner 主入口与 CLI 设计对象断裂，10 分钟配置目标无设计承诺 | ✅ 已修复 |
| H1 | 🟠 | Anchor apply 缺少强审批/CAS 保护 | ✅ 已修复 |
| H2 | 🟠 | Narrative Reflection 缺少真实性生成契约 | 🟡 已缓解 |
| M1 | 🟡 | v2 challenge 报告历史文件未按版本切换，审查基线曾指向 v1 | ✅ 已修复 |

### 第二轮（2026-03-24，3/3 已回应）

| ID | 严重度 | 摘要 | 状态 |
|----|--------|------|------|
| R2-C1 | 🔴 | checkpoint / lease / connector / resume 之间缺少 effect commit 协议 | ✅ 已修复 |
| R2-H1 | 🟠 | Quiet 被打断后缺少 reflection 活性保证，核心闭环可能长期饥饿 | ✅ 已修复 |
| R2-H2 | 🟠 | outreach 的“值得联系用户”仍停留在哲学层，缺少可测契约 | ✅ 已修复 |

### 第三轮（2026-03-24，3/3 已修复）

| ID | 严重度 | 摘要 | 状态 |
|----|--------|------|------|
| R3-H1 | 🟠 | effect commit protocol 被 control-plane 依赖，但 state-system 未正式声明/定义该协议 | ✅ 已修复 |
| R3-H2 | 🟠 | checkpointId 与 decisionSnapshotId 混用，恢复链标识语义不稳定 | ✅ 已修复 |
| R3-M1 | 🟡 | observability 新增接口和审计字段未接入主路径 | ✅ 已修复 |

### 第四轮（2026-03-24，最终轮，4/4 已修复）

| ID | 严重度 | 摘要 | 状态 |
|----|--------|------|------|
| R4-C1 | 🔴 | shared contract 已被宣告为单源，但核心共享类型仍在多系统重复定义且不一致 | ✅ 已修复 |
| R4-H1 | 🟠 | effect commit protocol 仍未在 state-system 成为正式 owner 契约 | ✅ 已修复 |
| R4-H2 | 🟠 | credential lifecycle 状态枚举跨系统冲突，恢复与审计口径分叉 | ✅ 已修复 |
| R4-M1 | 🟡 | outreach evaluation 类型只被引用未正式定义，契约仍停留在半闭合状态 | ✅ 已修复 |

---

## 🎯 审查方法论

本次审查模式: **DESIGN**

1. **设计审查** (design-reviewer skill) — 已执行 — 重点复查跨系统契约、状态枚举与 owner 一致性
2. **任务审查** (task-reviewer skill) — 跳过 — `.anws/v2/05_TASKS.md` 不存在
3. **Pre-Mortem** — 已执行 — 使用 `sthink` 完成最终 5 步失败预演，回放见 `v2-challenge-final-replay.md`
4. **合并评定** — 已执行 — 将前 3 轮遗留问题与本轮新增问题统一收敛为最终 challenge 结论

---

## 🔥 第4轮详细审查（已关闭）

> **关闭说明**: 以下条目保留为 challenge 历史记录，但其结论已不再代表当前设计状态。
> 当前关闭依据：
> - 已在 `02_ARCHITECTURE_OVERVIEW.md` 明确 `src/shared/types/` 为 shared contract 单源归属，并列出最小收口对象清单
> - 已在 `state-system.md` / `state-system.detail.md` 正式引入 `EffectCommitStorePort`、`IntentCommitRecord` 及 create/advance/commit/load/abort/reconcile 路径
> - 已统一 credential lifecycle canonical enum，并明确 `verification_required` 仅为 connector failure class
> - 已在 `control-plane-system.md` / `control-plane-system.detail.md` 正式定义 `OutreachEvaluationInput` / `OutreachEvaluationResult`

### 📊 本轮问题统计

| 严重度 | 数量 | 占比 |
|--------|------|------|
| Critical | 0 | 0% |
| High | 0 | 0% |
| Medium | 0 | 0% |
| Low | 0 | 0% |
| **Total** | **0** | **0%** |

| 维度 | 问题数 |
|------|--------|
| 设计审查 (design-reviewer) | 3 |
| 运行模拟 / Pre-Mortem | 1 |
| 任务审查 (task-reviewer) | 0 |

---

# 🔴 Critical 级别

### R4-C1. shared contract 被明确要求单源，但 `DecisionRecord` 等核心共享对象仍在多系统重复定义，架构自我矛盾

**严重度**: Critical  
**文档**: `.anws/v2/04_SYSTEM_DESIGN/observability-system.md:76`, `.anws/v2/04_SYSTEM_DESIGN/observability-system.md:282`, `.anws/v2/04_SYSTEM_DESIGN/observability-system.detail.md:71`, `.anws/v2/04_SYSTEM_DESIGN/observability-system.detail.md:57`, `.anws/v2/04_SYSTEM_DESIGN/control-plane-system.md:323`, `.anws/v2/04_SYSTEM_DESIGN/control-plane-system.detail.md:116`, `.anws/v2/04_SYSTEM_DESIGN/cli-system.md:67`

**ADR 影响**: 无需修改 ADR；这是 system design 层自相矛盾，需要在 `shared/contract` 归属上补正式设计。

**问题描述**:
- 你们这轮已经清楚意识到“跨系统共享对象必须单源”，这是完全正确的方向。
- 但当前文档并没有真正做到：`DecisionRecord`、`ExecutionAttempt`、`AnchorChangeAudit` 仍分别在 `control-plane`、`observability` 等文档中各自定义；observability 一边说“不能维护私有变体”，一边自己仍写了接口形状。
- 这不再是“以后抽一下”级别的问题，因为共享 contract 已经上升为本轮设计的明确原则；原则和文档现状直接冲突。

**证据**:
- 文档分析: `observability-system.md:76-77` 明写跨系统共享对象必须使用单源共享类型定义。
- 文档分析: `observability-system.detail.md:71-72` 也再次强调这些对象应来自 shared contract。
- 文档分析: 但 `observability-system.detail.md:57-110` 仍本地定义 `DecisionRecord` / `ExecutionAttempt` / `AnchorChangeAudit`；`observability-system.md:282-336` 也保留了自己的形状。
- 文档分析: `control-plane-system.detail.md:116-128` 和 `control-plane-system.md:323-333` 也分别定义了 `DecisionRecord`。
- 推理链: 当系统已经把“单源共享类型”上升为约束，却仍让多个系统维持各自版本，后续实现只会以“先复制过去再说”的方式继续扩散，最终反而比没提出单源原则时更危险，因为团队会误以为此问题已经被解决。

**影响**:
- schema 漂移会直接污染 decision explain、observability 查询、CLI 转述和测试基线。
- 后续 forge 阶段很容易在 `shared/types`、`control-plane`、`observability` 之间来回打补丁。
- 这是最后一轮审查中唯一仍保留为 Critical 的问题，因为它会系统性侵蚀整套“可解释性”主张。

**建议**:
1. 在架构层正式引入 `shared-contracts` / `shared domain types` 归属，并把 `DecisionRecord`, `ExecutionAttempt`, `AnchorChangeAudit`, `IntentCommitRecord`, `OutreachEvaluationResult` 统一迁入。
2. 所有 system design 只保留“引用 shared contract + 本系统使用约束”，不再本地重写同名结构。
3. 在报告关闭前，至少先在文档层明确“哪些对象必须单源、哪些可以本地投影视图”。

---

## 🟠 High 级别

### R4-H1. effect commit protocol 方向正确，但 state-system 仍未正式承担 canonical owner 责任

**严重度**: High  
**文档**: `.anws/v2/04_SYSTEM_DESIGN/control-plane-system.md:273`, `.anws/v2/04_SYSTEM_DESIGN/control-plane-system.detail.md:311`, `.anws/v2/04_SYSTEM_DESIGN/connector-system.md:203`, `.anws/v2/04_SYSTEM_DESIGN/state-system.md:280`, `.anws/v2/04_SYSTEM_DESIGN/state-system.md:323`

**ADR 影响**: 无

**问题描述**:
- 这点和第 3 轮相同，但在最终轮仍不能关单，因为证据没有变化：control-plane 已经依赖 effect commit protocol，connector 已认定 state-system 是 owner，但 state-system 文档还没正式承接。
- 这说明协议修到了“调用方”和“旁证方”，唯独没修到“持有方”。

**证据**:
- 文档分析: `control-plane-system.md:273-279` 与 `control-plane-system.detail.md:311-347` 已完整依赖 commit 接口。
- 文档分析: `connector-system.md:203-204` 把 `intent commit records` 归给 state-system canonical owner。
- 文档分析: `state-system.md:280-302` 仍只有 memory/credential/proposal 相关端口，没有 effect commit store；`state-system.md:323-370` 的核心实体仍未定义相关模型。

**影响**:
- commit protocol 很容易在实现时落成“临时 SQLite 表 + 私有 helper”，绕开公开端口。
- resume/reconcile 的正确性会再次依赖实现者记忆，而不是设计契约。

**建议**:
1. 在 `state-system.md` 中新增 `EffectCommitStorePort`。
2. 在 `state-system.detail.md` 补最小伪代码：create / advance / commit / load / abort / reconcile。
3. 在 `state-system` 数据模型中把其归到 governance plane 或 effect-durability 子域，别再悬空。

---

### R4-H2. credential lifecycle 状态枚举跨系统冲突，恢复与 explain 口径已经分叉

**严重度**: High  
**文档**: `.anws/v2/04_SYSTEM_DESIGN/state-system.md:230`, `.anws/v2/04_SYSTEM_DESIGN/state-system.md:366`, `.anws/v2/04_SYSTEM_DESIGN/cli-system.detail.md:65`, `.anws/v2/04_SYSTEM_DESIGN/connector-system.md:238`, `.anws/v2/04_SYSTEM_DESIGN/connector-system.detail.md:58`, `.anws/v2/04_SYSTEM_DESIGN/connector-system.detail.md:279`, `.anws/v2/04_SYSTEM_DESIGN/observability-system.md:270`

**ADR 影响**: 无

**问题描述**:
- 你们的 credential/verification 设计已经不止一个状态名，而是至少出现了三套口径：
  - `pending_verification`（state-system / cli-system）
  - `verification_required`（connector failure / route planner / recoverVerification 前置条件）
  - `challenged`（connector L0 操作契约）
- 另外 observability 事件写的是 `registered/pending_verification/verified/expired/revoked`，而 state/cli 口径是 `active`，不是 `verified`。
- 这已经不是命名不优雅，而是同一凭据生命周期在不同系统里被赋予不同状态语义。

**证据**:
- 文档分析: `state-system.md` 与 `cli-system.detail.md` 统一用了 `pending_verification` / `active`。
- 文档分析: `connector-system.detail.md:58,261,279` 使用 `verification_required` 作为 failure class 与路由条件。
- 文档分析: `connector-system.md:238` 又把 `recoverVerification` 前置条件写成 `challenged / verification_required`。
- 文档分析: `observability-system.md:270` 的 credential 审计事件使用 `verified`，不是 `active`。
- 推理链: 当 route planner、CLI 展示、审计、恢复测试各自使用不同枚举时，实现层必然要写一堆隐式映射；一旦忘了映射，系统就会出现“CLI 显示 active，但 connector 仍按 verification_required 走 degraded channel”的错位。

**影响**:
- verification recovery、channel selection、用户提示和审计查询都可能对同一凭据给出不同判断。
- 这类状态机分叉在实现期极易制造顽固 bug，而且测试很难覆盖完整。

**建议**:
1. 收敛成一套 canonical credential lifecycle enum，并明确 failure class 与 credential state 的边界：`verification_required` 更适合作为 failure class，不应和 canonical credential state 混用。
2. 明确 `active` vs `verified` 是否同义；如果同义，保留一个；如果不同义，必须定义转换条件。
3. 让 connector / cli / observability 全部引用同一 credential state contract。

---

## 🟡 Medium / 🟢 Low 级别

### R4-M1. `OutreachEvaluationInput/Result` 已被核心路径引用，但正式类型仍未定义，价值契约仍是半闭合

**严重度**: Medium  
**文档**: `.anws/v2/04_SYSTEM_DESIGN/control-plane-system.md:265`, `.anws/v2/04_SYSTEM_DESIGN/control-plane-system.detail.md:503`, `.anws/v2/04_SYSTEM_DESIGN/observability-system.md:330`

**ADR 影响**: 无

**问题描述**:
- 这轮你们已经把 outreach 的价值 gate 补出来了，这是进步。
- 但 `ModelAssistPort` 仍把 `evaluateOutreachCandidate(input: OutreachEvaluationInput)` 声明为返回 `Promise<ModelEvaluationResult>`；而 detail 里的 `shouldAllowOutreach()` 又要求 `OutreachEvaluationResult`。
- 更关键的是，仓库内只找得到“引用”，找不到 `OutreachEvaluationInput` / `OutreachEvaluationResult` 的正式定义。

**证据**:
- 文档分析: `control-plane-system.md:265` 暴露了 `OutreachEvaluationInput`，但返回值仍是 `ModelEvaluationResult`。
- 文档分析: `control-plane-system.detail.md:503-509` 的 gate 明确依赖 `OutreachEvaluationResult.valueScore`, `minThreshold`, `isRoutineProgress`, `requiredUserHelp`, `urgency`, `actionability`。
- 文档分析: 全量 grep 仅找到这些类型的引用，没有正式定义。
- 推理链: 这意味着 outreach 价值契约虽然“有字段列表”，但还没有成为正式可复用的 typed contract；一到实现时，很容易又退回本地对象拼装。

**影响**:
- 价值判断难以在 control-plane、model adapter、observability 之间复用。
- 后续 shared contract 收口时会多一次返工。

**建议**:
1. 正式定义 `OutreachEvaluationInput` 与 `OutreachEvaluationResult`，并决定它们是否是 `ModelEvaluationResult` 的特化版本。
2. 如果 `OutreachEvaluationResult` 是特化对象，就不要继续让端口返回裸 `ModelEvaluationResult`。
3. 将其纳入 shared contract 收口清单，与 `DecisionRecord` 一并处理。

---

## 📋 建议行动清单

### P0 - 立即处理 (阻塞)
1. 无阻塞项；shared contract 单源问题已在当前版本文档层收口。

### P1 - 近期处理 (重要)
1. 在 `/blueprint` 中把 shared contract、effect commit owner 与 credential lifecycle 统一映射成实现任务。
2. 在 `/forge` 中以 `src/shared/types` 落地共享契约，避免实现阶段重新分叉。

### P2 - 持续改进 (优化)
1. 在实现期继续收紧 observability 对 shared contract 的引用方式，避免文档投影视图再次演化成私有 schema。

---

## 🚦 最终判断

- [x] 🟢 项目可继续，风险可控
- [ ] 🟡 项目可继续，但需先解决 P0 问题
- [ ] 🔴 项目需要重新评估

**判断依据**:
- final challenge 中指出的问题都集中在 contract-level 收口，而不是产品方向错误；本轮已把 shared contract 归属、effect commit owner、credential lifecycle enum 与 outreach evaluation 类型闭合到正式设计中。
- 仍有后续 blueprint / forge 阶段需要落实的实现工作，但当前 system design 层已不存在阻塞继续推进的红黄灯缺口。

---

## 📚 附录

### A. Pre-Mortem 分析

| 失败场景 | Root Cause | 证据 | 概率 | 对应问题 |
|---------|-----------|------|:----:|----------|
| 实现中 shared types 越写越多，explain 与 audit 口径逐步失真 | 若 forge 阶段不真正落 `src/shared/types`，shared contract 仍可能再次漂移 | 当前已完成文档层归属声明，后续取决于实现纪律 | 🟡中 | R4-C1 |
| commit protocol 实现成 state 层临时表和 helper，后续继续漂移 | 若实现绕开 `EffectCommitStorePort`，canonical owner 会再次失效 | 当前已完成 state-system owner 契约设计 | 🟡中 | R4-H1 |
| credential 恢复和 CLI 展示互相打架 | 若 failure class 与 credential state 再次混用，状态机会重新分叉 | 当前已定义 canonical enum 与边界 | 🟡中 | R4-H2 |
| outreach 看似可测，实际仍靠本地对象拼装 | 若实现不复用 `OutreachEvaluationInput/Result`，仍会退回 ad-hoc 对象 | 当前已完成类型闭合 | 🟡中 | R4-M1 |

### B. 技术健壮性审计

| 方面 | 当前设计 | 评估 | 问题 |
|------|---------|:----:|------|
| 事务处理 | effect commit protocol 已有概念、owner 契约与主链调用 | ✅ | 需在实现阶段保持单源落地 |
| 重试机制 | connector policy layer 边界清楚 | ✅ | 单层重试方向稳定 |
| 降级策略 | degraded channel 约束明确 | ✅ | 无新增高风险问题 |
| 并发控制 | lease + checkpoint + commit protocol | ✅ | 需在实现阶段验证 resume / reconcile 测试 |
| 状态管理 | 多个核心状态机已成型 | ✅ | canonical credential lifecycle 已统一 |
| 接口定义 | 端口数量更完整 | ✅ | shared contract 与 outreach 类型已闭合 |
| 可观测性 | 审计模型比前几轮完整很多 | ✅ | 主路径契约已收口，后续关注实现一致性 |

### C. 假设验证结果

| 假设 | 验证方法 | 结果 | 状态 |
|------|---------|------|:----:|
| shared contract 已经真正成为单源 | 交叉核对 5 个 system design 的类型定义 | **文档层已成立**；已明确 `src/shared/types` 归属与最小单源对象清单 | ✅ 已验证通过 |
| effect commit protocol 已在 canonical owner 系统正式落地 | 对照 control-plane / connector / state-system 端口与实体 | **文档层已成立**；state-system 已正式承接 owner 契约 | ✅ 已验证通过 |
| credential 状态机在 connector / state / cli / observability 中一致 | 交叉核对状态枚举 | **文档层已成立**；canonical state 与 failure class 边界已明确 | ✅ 已验证通过 |
| outreach 价值契约已经类型闭合 | 搜索定义与引用 | **已成立**；`OutreachEvaluationInput/Result` 已有正式定义 | ✅ 已验证通过 |

### D. ADR 影响追踪

> **提醒**: 如果本次审查导致 ADR 修改，请检查以下引用链。

| ADR 文件 | 引用该 ADR 的 SYSTEM_DESIGN | 影响说明 |
|---------|---------------------------|---------|
| `ADR_002_CONNECTOR_MODEL.md` | `04_SYSTEM_DESIGN/control-plane-system.md`, `04_SYSTEM_DESIGN/connector-system.md`, `04_SYSTEM_DESIGN/observability-system.md`, `04_SYSTEM_DESIGN/cli-system.md` | 若统一 credential 状态机与 effect commit owner，需要同步 connector execution / recovery 边界 |
| `ADR_003_SECOND_NATURE_GOVERNANCE.md` | `04_SYSTEM_DESIGN/control-plane-system.md`, `04_SYSTEM_DESIGN/state-system.md`, `04_SYSTEM_DESIGN/observability-system.md`, `04_SYSTEM_DESIGN/cli-system.md` | 若收 shared contract、outreach evaluation 与 reflection 审计类型，需要同步治理与 explain 叙述 |

**修改 ADR 后的行动**:
1. 更新 ADR 文件
2. 检查上表中所有引用该 ADR 的 SYSTEM_DESIGN
3. 确认这些系统设计是否需要同步调整
