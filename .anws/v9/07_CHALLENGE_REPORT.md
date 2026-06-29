# v9 Challenge Report

**项目**: Second Nature  
**架构版本**: `.anws/v9`  
**日期**: 2026-06-22  
**触发**: 用户显式调用 `/challenge`，要求质疑 v9 design 与 tasks 文档，重点检查 Agent 边界、输入约束、人格与记忆塑造  
**TARGET_DIR**: `.anws/v9`，由 `.anws/` 最大数字版本确定  

---

## 问题总览

| 轮次 | 范围 | Critical | High | Medium | Low | 状态 |
|------|------|:--------:|:----:|:------:|:---:|------|
| R1 archived | 设计审查，`/blueprint` 前 | 0 | 0 | 0 | 0 | 上轮 10 项已在设计与 blueprint 中闭合；旧 DR ID 最小映射见附录 A |
| R2 closed | design + tasks + verification 文档 | 0 | 0 | 0 | 0 | CH-01~CH-04 已通过 `/change` 回流设计、任务与验证计划 |

**整体判断**: v9 的方向是对的，Agent 被建模为开放心智而不是普通程序或人类替身。本轮发现已通过 `/change` 收敛；可进入 `/forge` 前由用户确认执行范围。

---

## 审查摘要

| 项 | 结论 |
|----|------|
| REVIEW_MODE | `FULL` 的文档子集：执行 design-reviewer 与 task-reviewer；code-reviewer 因用户限定“文档部分”而跳过 |
| Design review | Executed；读取 PRD、Architecture、ADR-002/006、shared contracts、character/control/memory L0/L1 及相关 review 证据 |
| Task review | Executed；读取 `05A_TASKS.md` 与 `05B_VERIFICATION_PLAN.md`，对 T7/T5/T2 与验证 overlay 做 Pass A-G 的高信号抽查 |
| Code review | Skipped；本轮审查对象是 v9 文档契约，不审 `src/` 实现 |
| sequential-thinking | Executed；`C:\Users\11341\AppData\Local\sthink\sessions\v9-doc-challenge` |

### 指标表

| 审查层 | 检查对象 | Critical | High | Medium | Low | 结论 |
|--------|----------|:--------:|:----:|:------:|:---:|------|
| Design | Agent/input/CharacterFrame/EmbodiedContext 契约 | 0 | 0 | 0 | 0 | Closed |
| Tasks | 05A task 承接与 05B 验证承接 | 0 | 0 | 0 | 0 | Closed |
| Closure | 重复态、失败态、默认态、运行态、观测态、验证责任 | 0 | 0 | 0 | 0 | Closed |
| **合计** | 去重后核心发现 | **0** | **0** | **0** | **0** | **可进入用户确认后的 `/forge`** |

### 证据来源表

| 类型 | 来源 |
|------|------|
| 业务契约 | `01_PRD.md:43-50`, `01_PRD.md:54-59`, `01_PRD.md:156-167`, `01_PRD.md:216-222` |
| 架构契约 | `02_ARCHITECTURE_OVERVIEW.md:13`, `02_ARCHITECTURE_OVERVIEW.md:381`, `03_ADR/ADR_002_ATTENTION_NOT_AGENT_MIND.md:46-63`, `03_ADR/ADR_006_CHARACTER_CONTINUITY_AS_EMERGENT_PROJECTION.md:42-78` |
| 设计契约 | `04_SYSTEM_DESIGN/shared-v9-contracts.md:166-266`, `04_SYSTEM_DESIGN/character-continuity-system.md:45-84`, `04_SYSTEM_DESIGN/character-continuity-system.detail.md:134-184`, `04_SYSTEM_DESIGN/control-context-system.detail.md:462-496` |
| 任务与验证 | `05A_TASKS.md:457-493`, `05B_VERIFICATION_PLAN.md:269-289`, `05A_TASKS.md:271-284`, `05B_VERIFICATION_PLAN.md:414-483` |

---

## 承诺模型摘要

| 类型 | 摘要 | 来源 | 失真风险 |
|------|------|------|----------|
| 结果 | Agent 每次新上下文应拿到 source-backed card/frame 或 explicit unavailable/deferred reason | `01_PRD.md:43-50`, `01_PRD.md:156-167` | 空泛人格文本或无来源投影被注入 |
| 安全 | 程序化约束不得声称真实情绪、永久人格或硬控制规则 | `01_PRD.md:54-59`, `ADR_006:74-78` | validator 只覆盖英文，中文 Agent-facing 文本绕过 |
| 输入 | `CharacterFrame` 应来自 closure/tool/feedback/projection/expression outcome 等 source-backed 输入 | `character-continuity-system.md:49-53`, `character-continuity-system.md:196-207` | 原风险已闭合：`CharacterRefreshInput`/`CharacterSignal` 已定义并承接 normalizer 验证 |
| 状态 | `CharacterFrame` candidate/accepted/rejected/retired/superseded 与 runtime contested 必须可区分 | `shared-v9-contracts.md:195-266`, `character-continuity-system.detail.md:71-85` | 原风险已闭合：auto-accept 首轮注入必须带 `newlyProposed` |
| 验证 | P0/P1 stories 必须有自动化测试或报告，公共契约不能只靠 E2E | `01_PRD.md:243-252`, `05B_VERIFICATION_PLAN.md:13-16` | 原风险已闭合：T7.2.1/T7.2.2/T8.2.1 已承接输入与双语安全验证 |

---

## Pre-Mortem 摘要

| 失败原因 | 失真契约 | Root Cause | 证据 | 概率 |
|----------|----------|------------|------|------|
| CharacterFrame 吃到未归一化 feedback/expression outcome，生成看似 source-backed 的人格投影 | 输入/安全/审计 | 原风险：`CharacterRefreshInput` 只被引用；当前已补 schema、来源白名单、redaction 与 source-ref 归一化 | `character-continuity-system.detail.md`; `05A_TASKS.md T7.2.1`; `05B T7.2.1` | 已闭合 |
| 中文人格或情绪断言穿过 validator，进入 Agent-facing context | 安全/Agent-facing prompt | 原风险：forbidden patterns 与验证断言主要是英文；当前已补双语 fixtures | `character-continuity-system.detail.md`; `05B T7.2.1/T8.2.1` | 已闭合 |
| Agent reject/revise 只能在系统自动 accepted 之后发生，contest 语义弱化 | 状态/时间 | 原风险：refresh 默认 candidate -> accepted；当前已补 `newlyProposed` first-injection 与 reject 后不 active 验证 | `character-continuity-system.detail.md`; `05A/05B T7.2.2` | 已闭合 |
| 05A 引用 mutable challenge DR ID，报告归档后任务证据锚点漂移 | 验证/文档运行 | 原风险：任务把旧报告 ID 当稳定输入；当前已改为设计文档锚点 | `05A_TASKS.md`; `05B_VERIFICATION_PLAN.md` | 已闭合 |

---

## 核心发现清单

| ID | 来源 | 严重度 | 位置 | 发现 | 影响 | 建议 |
|----|------|--------|------|------|------|------|
| CH-01 | Design + Task | High → Closed | `character-continuity-system.md`, `character-continuity-system.detail.md`, `shared-v9-contracts.md`, `05A T7.2.1`, `05B T7.2.1` | `CharacterRefreshInput` 被作为核心入口使用但未定义字段、允许来源、redaction、sourceRefs 归一化与禁止 raw 输入规则。 | 已补 canonical schema、normalizer、allowed source family 白名单、raw/private/prompt/credential blocker，并回流 T7.2.1/05B 单元与集成验证。 | Closed by `/change` 2026-06-22。 |
| CH-02 | Design + Verification | High → Closed | `character-continuity-system.detail.md`, `05B T7.2.1`, `05B T8.2.1` | `Frame Source Validator` 与 05B 验证主要覆盖英文 forbidden patterns，未机械覆盖中文情绪断言、人格标签与硬控制语句。 | 已扩展双语 forbidden fixtures 与验证断言，覆盖 `you feel`/`你感到`、personality labels、hard-control wording。 | Closed by `/change` 2026-06-22。 |
| CH-03 | Design | Medium → Closed | `character-continuity-system.detail.md`, `control-context-system.detail.md`, `05A T7.2.2`, `05B T7.2.2` | `refreshCharacterFrame` 默认将 candidate 自动 accepted 并 supersede 上一帧，Agent 的 accept/reject/revise/retire 变成注入后的事后纠偏。 | 保留 auto-accept continuity 可用性，但首轮注入标注 `newlyProposed`，并验证 reject 后不继续作为 active posture 使用。 | Closed by `/change` 2026-06-22。 |
| CH-04 | Task | Medium → Closed | `05A_TASKS.md`, `05B_VERIFICATION_PLAN.md` | 多个 v9 task 把上一轮 `07_CHALLENGE_REPORT.md DR-*` 作为输入锚点，但 challenge 报告按轮次归档会覆盖详细内容。 | 已将旧 DR refs 改为稳定的 design/shared-contracts/detail 文档锚点；05B trace rows 去除旧 DR 作为主契约名。 | Closed by `/change` 2026-06-22。 |

---

## Top Findings 详情

### CH-01 - `CharacterRefreshInput` 未定义导致人格塑造入口不可验证

**严重度**: High  
**位置**: `character-continuity-system.md:49-53`, `character-continuity-system.md:196-207`, `character-continuity-system.detail.md:140-144`, `memory-continuity-system.detail.md:530-533`, `05A_TASKS.md:457-471`, `05B_VERIFICATION_PLAN.md:269-278`

**证据**:

- `character-continuity-system.md` 声明输入来自 closure、tool experience、owner feedback、expression outcome、Agent contest/re-authoring action，但 `CharacterRefreshInput` 只在接口中出现，没有字段表或允许来源清单。
- `character-continuity-system.detail.md` 的伪代码直接消费 `input: CharacterRefreshInput`，而 `memory-continuity-system.detail.md` 只展示 `refreshCharacterFrame({ sourceRefs: review.characterSignals })`，两者没有同一个 canonical 输入模型。
- `05A T7.2.1` 与 `05B T7.2.1` 验证 builder/source validator，但没有独立验证 input normalizer、raw payload 阻断、owner feedback/expression outcome 的来源归一化。

**推理链**:

- v9 的核心不是“生成一段人格文本”，而是从有来源的身体化交互中塑造可反驳投影。
- 如果入口对象没有 schema，后续 validator 只能检查已经生成的文本，不能证明输入没有 raw private content、raw prompt 或未授权 feedback。
- 这会把“Agent 不是普通程序”的边界从类型契约退化成实现者自觉，返工概率高。

**建议**:

- 在 `shared-v9-contracts.md` 或 `character-continuity-system.detail.md` 增加 `CharacterRefreshInput` 与 `CharacterSignal` canonical shape。
- 字段至少包含 `sourceRefs`, `signalKind`, `redactionClass`, `summary`, `locale`, `originSystem`, `confidence`, `rawPayloadForbidden=true` 等机械可验信息。
- 在 05A 增加或扩展 T7.2.1 子项，05B 增加 normalizer 单元测试、raw/private/prompt blocker 测试、source family allowlist 测试。

**闭合状态**: 已按上述建议完成 `/change` 回流，见核心发现清单 CH-01 closed。

### CH-02 - 中文 Agent-facing 安全边界未被验证闭合

**严重度**: High  
**位置**: `character-continuity-system.detail.md:272-283`, `character-continuity-system.detail.md:409-423`, `control-context-system.md:391-393`, `05B_VERIFICATION_PLAN.md:273-278`

**证据**:

- `Frame Source Validator.FORBIDDEN_PATTERNS` 覆盖 `you feel`, `your emotion is`, `you must`, `MBTI` 等英文模式，但没有中文等价模式。
- 同一 L1 文件明确提供中文 contest prompt 模板，control-context L0 也用中文示例说明 Agent-facing contestable 文本。
- 05B 的 T7.2.1 断言写为 no personality scores、no “you feel” claims、no hard-control rules，未要求中文 forbidden fixtures。

**推理链**:

- 项目文档和目标用户语境大量使用中文，Agent-facing projection 很可能出现中文摘要或双语模板。
- 安全边界如果只测英文，中文“你感到”“你的性格是”“你必须永远”这类句子原先可能绕过校验。
- 这直接触碰 PRD NG6 与 ADR-006：程序化约束不得声称完整反映 Agent 真实情绪或永久人格。

**建议**:

- 为 `Frame Source Validator` 增加 locale-aware forbidden pattern set，至少覆盖中文 emotion assertion、personality label、hard-control rule 与 source-free persona declaration。
- 05B T7.2.1 增加中英双语 fixture 表，T8.2.1/INT-S5 增加 public ops 输出不含中文情绪/人格断言的 API 断言。
- contest prompt 模板本身也应在中英双语 fixture 中作为固定回归样例。

**闭合状态**: 已按上述建议完成 `/change` 回流，见核心发现清单 CH-02 closed。

---

## 承诺闭合验证

| 维度 | 结论 | 证据 | 对应问题 |
|------|------|------|----------|
| 重复态 | Pass | stable identity、seenCount 与 duplicate suppression 已在 `shared-v9-contracts.md:46-72`、`05B:126-135` 承接 | 无 |
| 失败态 | Pass | `character_frame_deferred` 已设计，`CharacterRefreshInput` normalizer 补齐输入失败与 blocker 验证责任 | CH-01 closed |
| 默认态 | Pass | 保留 auto-accept，但 first injection 标记 `newlyProposed` 且 reject 后不继续 active 注入 | CH-03 closed |
| 运行态 | Pass | EmbodiedContext 切片超时与 degraded slice 在 `control-context-system.detail.md:440-496` 承接 | 无 |
| 并发态 | Pass | connector evolution lock/rollback 已由 T6.3.2/T8.2.2 承接 | 无 |
| 观测态 | Pass | loop_status/ledger 已覆盖，05A/05B 旧 DR 引用已改为稳定设计锚点 | CH-04 closed |
| schema | Pass | shared contracts 覆盖主要实体，并补齐 `CharacterRefreshInput`/`CharacterSignal` | CH-01 closed |
| 配置与秘钥 | Pass | redaction 与 no credential 规则在 PRD、05B、T8.1.2 承接 | 无 |
| Prompt/Tool schema | Pass | contestable prompt 有模板，中文 forbidden fixtures 与双语安全断言已回流 05B | CH-02 closed |
| 验证责任 | Pass | 05B 覆盖 CharacterRefreshInput normalizer、双语 safety fixtures 与 newlyProposed lifecycle | CH-01, CH-02, CH-03 closed |

---

## 任务审查 Pass 摘要

| Pass | 结果 | 高信号说明 |
|------|------|------------|
| A 重复检测 | Pass | 未发现会改变门禁判断的重复任务 |
| B 歧义检测 | Pass | `CharacterRefreshInput` 与中文 forbidden patterns 已有明确验证语言 |
| C 欠详述检测 | Pass | T7.2.1/T7.2.2 已承接 input normalizer 与 `newlyProposed` lifecycle |
| D 不一致性检测 | Pass | auto-accept 语义已限定为 contestable first-injection，不再冒充永久身份事实 |
| E 覆盖率检测 | Pass | REQ-001~REQ-008 均有任务链与 INT gate |
| F 质量粒度 | Pass | 未发现 >16h 或链长 >7 的阻塞粒度问题 |
| G 契约覆盖 | Pass | Agent-facing 输入与双语 prompt safety 契约已有单测/API 验证承接 |

---

## 建议行动

| 优先级 | 行动 | 目标 |
|--------|------|------|
| P1 | `/change` 已修订 `character-continuity-system.detail.md`、`shared-v9-contracts.md`、`05A_TASKS.md`、`05B_VERIFICATION_PLAN.md` | CH-01 与 CH-02 closed，High 门禁解除 |
| P2 | 已明确 `CharacterFrame` auto-accept 的 `newlyProposed` first-injection 语义并补状态机验证责任 | CH-03 closed，Agent contest 不再只是事后否认 |
| P2 | 已把旧 DR refs 改为稳定设计锚点 | CH-04 closed，forge 执行证据链稳定 |

---

## 最终判断

本轮没有 Critical。2 个 High 与 2 个 Medium 已通过 `/change` 闭合，不需要回到 `/genesis` 或重做 `/design-system`。v9 可在用户确认后进入 `/forge` Wave 119 / S1。

---

## 附录 A - 上轮归档与旧 DR ID 最小映射

上一轮详细审查已按轮次归档协议压缩；以下映射仅用于保留 `05A_TASKS.md` 中旧 `07_CHALLENGE_REPORT.md DR-*` 引用的可读性，不代表本轮活跃发现。

| 旧 ID | 上轮问题 | 当前状态 | 稳定替代锚点建议 |
|-------|----------|----------|------------------|
| DR-01 | ToolRoutine guard schema DSL 缺失 | Closed | `shared-v9-contracts.md §6.3`, `action-closure-policy-system.detail.md §2.3`, `body-connector-system.detail.md §3.5` |
| DR-02 | v8 connector manifest 迁移路径未定义 | Closed | `body-connector-system.detail.md §3.11`, `05A T6.3.2` |
| DR-03 | SelfContinuityCard section ordering 未固定 | Closed | `shared-v9-contracts.md §4`, `memory-continuity-system.detail.md §3.7` |
| DR-04 | stable identity null externalId 处理不显式 | Closed | `shared-v9-contracts.md §2`, `memory-continuity-system.detail.md §3.1` |
| DR-05 | rollback liveness/watchdog 缺失 | Closed | `observability-recovery-system.detail.md §3.7`, `05A T8.2.2` |
| DR-06 | connector asset 并发访问策略未定义 | Closed | `body-connector-system.detail.md §5`, `05A T6.3.2` |
| DR-07 | EvidenceItem 写入入口可能双路径 | Closed | `memory-continuity-system.detail.md §3.1` |
| DR-08 | v8 JudgmentVerdict 到 AttentionSignal 兼容策略未闭合 | Closed | `memory-continuity-system.detail.md §2/§3.1a`, `05A T5.2.3` |
| DR-09 | 2s heartbeat deadline 下切片超时策略不足 | Closed | `control-context-system.detail.md §3.3`, `05A T2.2.3` |
| DR-10 | AutonomousChangeLedger 本地重定义风险 | Closed | `shared-v9-contracts.md §8`, `05A T5.1.1` |

---

## 附录 B - 跳过项声明

| 审查项 | 状态 | 原因 |
|--------|------|------|
| code-reviewer | Skipped | 用户明确要求审查 v9 文档部分，且本轮发现均来自 design/tasks/verification 契约 |
| E2E 实机验证 | Skipped | `/challenge` 文档审查不执行 OpenClaw host E2E；05B 已将其标为 `/forge` 环境具备时记录 |
