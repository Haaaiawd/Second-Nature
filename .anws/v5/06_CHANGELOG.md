# 变更日志 - .anws v5

> 此文件记录本版本迭代过程中的微调变更（由 /change 处理）。新增功能/任务需创建新版本（由 /genesis 处理）。

## 格式说明
- **[CHANGE]** 微调已有任务（由 /change 处理）
- **[FIX]** 修复问题
- **[REMOVE]** 移除内容

---

## 2026-05-11 - /change: 代码侧缺口落任务（CHANGE_PREP → T1.2.6～T1.2.9、T3.3.2）+ 宿主 tools.profile 验证回流

- [CHANGE] `05_TASKS.md`：依据 `.anws/v5/CHANGE_PREP_CODE_SIDE_GAPS.md` 新增 **未勾选** Level-3 任务 **T1.2.6**（`policy show`）、**T1.2.7**（`audit` 最小闭环）、**T1.2.8**（`capability_probe` + ops-router + bridge）、**T1.2.9**（`decision_denied` vs `degraded` 语义）、**T3.3.2**（`near_real_smoke` ops 入口）；更新 **Contract Mapping**、**依赖图**、**任务统计**（+5 任务，+22h）；**INT-S4** / **T1.3.1** 验证说明增补 OpenClaw **`tools.profile` / `tools.allow`** 会话过滤归因（2026.5.7 宿主回填，非 SN 代码缺陷）
  - 用户原话: 「来修改吧」（执行 `/change` 工作流：整理代码侧问题并回流任务）
  - 修改内容: SN-CODE-01～05 → 可 `/forge` 任务 ID；宿主侧「插件已加载但会话无工具」与 **`tools.profile: coding`** 对齐的可记录口径
  - 影响范围: `.anws/v5/05_TASKS.md`；`.anws/v5/CHANGE_PREP_CODE_SIDE_GAPS.md`（§4 勾选）；`AGENTS.md`（当前任务状态摘要）
  - PRD 追溯: [REQ-019], [REQ-020], [REQ-025]（任务承接描述层；**未修改** PRD 正文 REQ 文本）

## 2026-05-10 - /change: 删除冗余验证稿与草稿报告（INT-S4 SoT 收敛）

- [REMOVE] 删除 `docs/validation/int-s4-human-operator-testing-guide.md`（内容并入 SoT：`e2e-t1-1-4-workspace-bridge-and-host-verification.md` + `reports/int-s4-release-readiness.md` + `05_TASKS` INT-S4 验证说明）
- [REMOVE] 删除 `reports/int-s4-e2e-prd-confirmation.md`、`reports/openclaw-pr-description-embedded-toolsallow.md`、`reports/openclaw-issue-embedded-tools-allow-2026-5-6.md`（仓库内无其它依赖；PRD/E2E 矩阵以 `docs/validation/e2e-v5-prd-full-lived-experience.md` 为准）
  - 用户原话: 「testing-guide 属于无用文件，清理一下我们的 reports」
  - 影响范围: `docs/validation/*`、`reports/*`、`.anws/v5/05_TASKS.md`、`07_CHALLENGE_REPORT.md`（CH-12-04 位置列）、`explore/reports/2026-05-05_openclaw-plugin-support-survey.md`、`openclaw-carrier-host-brief.md`、`e2e-v5-prd-full-lived-experience.md`、`prompt-browser-e2e-agent.md`、`claw-remote-test-assistant-prompt.md`、`int-s4-host-smoke-testing-guide.md`

## 2026-05-10 - /change 已批准: Claw 场测勘误回流（Round 14 + T2.2.2–T1.2.5 + INT-S4）

- [CHANGE] `05_TASKS.md` / `07_CHALLENGE_REPORT.md`：**Claw 回填**（2026-05-10）— 全量心跳为 **`intent_selected`+maintenance**（**非** `silent_no_candidates`）；**无** `.second-nature/quiet/` 故 **CH-14-07「写了读不到」暂不适用当前现场**；**OpenClaw cron `delivery.mode:none`** 与 SN **`deliveryCapability:none`** 并存；**INT-S4** 增 **cron+`openWorkspaceBridge`** 证据路径与 **`tool_visibility_gap` Finding** 规则；**T2.2.2～T1.2.5** 描述/验收对齐勘误
  - 用户原话: 「批准了，是这样子的，来吧」
  - 修改内容: 场测初报与实测 JSON 对齐；`INT-S4` 验证说明区分 agent 工具路径 vs cron 主路径；`T2.2.3` 标题与验收增 **maintenance 无外部效应** 诚实 JSON；`T1.2.5` 增 cron 与 bridge 无 probe 说明；Round 14 质疑表增 **勘误** 小节并修订 CH-14-01/07 表述
  - 影响范围: `.anws/v5/05_TASKS.md`；`.anws/v5/07_CHALLENGE_REPORT.md`；`AGENTS.md`（日期/摘要）；本 CHANGELOG
  - PRD 追溯: [REQ-019], [REQ-022], [REQ-024], [REQ-026]（无 REQ 编号文本变更）

## 2026-05-10 - /change AUTO: Round 14 / Nyx v0.1.18 场测任务回流（T2.2.2–T1.2.5）

- [CHANGE] `05_TASKS.md`: 新增 **T2.2.2**（P0）、**T2.2.3**（P0）、**T1.2.4**（P1）、**T1.2.5**（P1）；更新 **Contract Mapping**、**依赖图**、**T2.2.1** 验证说明、**INT-S4** 描述/输入、**US-001** / **US-006**、**Contract Coverage Overlay**、**Blueprint 检查清单**、**任务统计**（+4 Level-3，+29h）
  - 用户原话: 「的确，我们的任务还是很重大的，先修改文档吧 **AUTO**」（承接 Nyx 场测报告 + Round 14 `07_CHALLENGE_REPORT` CH-14 子代理审查结论）
  - 修改内容: 将 workspace 心跳 **life evidence 未并入 SnapshotInputs**、`connector_action` **无效应/无 telemetry**、**Quiet JSON 与 report 读面断裂**、**`status` 缺投递姿态 + 默认 explain 缺 audit store** 落实为可 `/forge` 的四个任务；不改变 PRD 需求边界或 ADR 核心前提；**未**修改任何 `- [x]` / `- [ ]` 任务勾选状态（含 INT-S4）
  - 影响范围: `.anws/v5/05_TASKS.md`；`AGENTS.md` 保留区（统计与 Wave 19 提示）
  - PRD 追溯: [REQ-019], [REQ-022], [REQ-024], [REQ-026]（仅任务承接与验证说明，不修改 REQ 文本）

## 2026-05-09 - /change: `loadStatus` 聚合观测写回任务（T1.2.3）

- [CHANGE] `05_TASKS.md`: 新增 **T1.2.3**（P0）：workspace `heartbeat_check` 路径写入 `decision_ledger`（`sn-runtime-*`）与 `execution_attempts`（`second-nature-runtime`），与 `loadStatus` 读模型融洽；**Contract Mapping** 与 **Contract Coverage Overlay** 增补；**依赖图** 接入 T2.2.1 → T1.2.3；**T1.2.1** 验证说明注明空表回落由 T1.2.3 闭合；**INT-S4** 输入/依赖/验证说明纳入 T1.2.3；任务统计 +1 Level-3、+1 P0、+4h
  - 用户原话: 「让其融洽即可...批准了 /change」
  - 修改内容: 将根因分析（观测表无写入导致 status unknown）落实为可 `/forge` 的单一任务；不改变 PRD 需求边界或 ADR 核心前提
  - 影响范围: `.anws/v5/05_TASKS.md`
  - PRD 追溯: [REQ-019]（operator 可观测性 / ops surface）

## 2026-05-06 - /change: `second_nature_ops` 会话工具可见性与 INT-S4 门禁承接

- [CHANGE] `05_TASKS.md`: **INT-S4**、**T1.3.1** 验证说明增补 **会话工具枚举须含 `second_nature_ops`** 的前置门禁；**T1.1.5** semver 对齐表述更新为 **0.1.12**
  - 用户原话: 「已经写好并落盘了。路径: reports/second-nature-ops-tool-visibility-issue-2026-05-06.md有问题检查和 /change」
  - 修改内容: INT-S4 禁止在工具表缺失 `second_nature_ops` 时仍将宿主 E2E 标绿；T1.3.1 区分「工具不可见」与「heartbeat_tool_not_invoked」；交叉引用干系人报告与既有 ops-registration-gap 探索报告
  - 影响范围: `.anws/v5/05_TASKS.md`（INT-S4、T1.3.1、T1.1.5）；可选交叉引用 `reports/second-nature-ops-tool-visibility-issue-2026-05-06.md`
  - PRD 追溯: [REQ-019], [REQ-025]；不改变需求边界或 ADR 核心前提；仅加强宿主验证承接与失败归因口径

## 2026-05-05 - /change: OpenClaw 插件 carrier + lazy bridge 机制 survey 全量应用 + 真实宿主确定性优化

- [CHANGE] `05_TASKS.md`: **T1.1.4** 验收标准增补 **根对齐验证**、**chdir 副作用风险** 提示与 subagent 审查引用；**INT-S4** 验证说明强化真实宿主 full-bridge transcript + root 红acted 证据要求
  - 用户原话: 「/change 批准了，请你修改我们的文档，继续优化和全量的应用和修改这部分的技术架构以及tasks等等...」（承接 2026-05-05 /explore survey + gpt-5.4-medium subagent 审查）
  - 修改内容: 
    - T1.1.4 验收标准新增根对齐验证条款、chdir 全局影响声明、Plan B 建议；验证说明引用 survey §8（48/100 certainty）。
    - INT-S4 验证说明要求真实宿主 transcript 覆盖 carrier + full-bridge 路径，并附 root 证据。
    - 全量应用 subagent 审查洞察（root misalignment 假信心风险、sandbox dynamic import 未闭合、并发 chdir 竞态）。
  - 影响范围: `.anws/v5/05_TASKS.md`（T1.1.4、INT-S4）；`explore/reports/2026-05-05_openclaw-plugin-support-survey.md`（追加 subagent 审查章节）；`docs/validation/e2e-t1-1-4-workspace-bridge-and-host-verification.md`、`reports/openclaw-carrier-host-brief.md`（同步更新 findings 与确定性表述）
  - PRD 追溯: [REQ-019]；不改变需求边界、系统边界或 ADR-006/007 核心前提；仅加强验证承接与风险披露
- [CHANGE] `explore/reports/2026-05-05_openclaw-plugin-support-survey.md` 及相关验证文档: 追加 subagent 审查摘要（48/100、部分有效），更新结论为保守表述
  - 用户原话: 同上
  - 修改内容: 将原 “中等偏高 real-host certainty” 下调；增加 §8 Subagent Review 完整记录审查发现与调整建议
  - 影响范围: 上述报告 + 交叉引用的 e2e 验证文档与 carrier brief
  - PRD 追溯: [REQ-019]；不改变架构基线

## 2026-05-04 - /change: OpenClaw agent workspace 与 SN 根对齐（运维约定）

- [CHANGE] `05_TASKS.md`: **T1.1.4** 增补 **运维约定 (OpenClaw 宿主)**；**INT-S4** 验证说明增补根已知路径与 OpenClaw workspace 一致性记录建议
  - 用户原话: 「/change 那还说啥了，太性情了，走你」（承接会话结论：将 SN 根与 OpenClaw workspace 同目录的推荐写入版本化契约）
  - 修改内容: 明确推荐 `SECOND_NATURE_WORKSPACE_ROOT` / `workspaceRoot` 与 OpenClaw `agents.defaults.workspace`（及沙箱/多 agent 例外）对齐；交叉引用 `explore/reports/2026-05-04_openclaw-plugin-install-vs-workspace-root.md`
  - 影响范围: `.anws/v5/05_TASKS.md`（T1.1.4、INT-S4）
  - PRD 追溯: [REQ-019]；不改变需求边界与 ADR 核心前提

## 2026-05-03 - /change + /explore: 插件 Quiet 路径承接任务

- [CHANGE] `05_TASKS.md`: 新增 **T1.1.4**（OpenClaw 插件 workspace 根已知时 full ops / Quiet 读路径桥接）
  - 用户原话: 「那这就不行，不允许」仅 host-safe carrier 无 Quiet；「/change /explore 来找找解决办法」
  - 修改内容: 新增 P0 任务 T1.1.4：惰性装配 `readModels`+`opsRouter` 或子进程 CLI 备选；验收区分 `workspaceRootResolution` known vs unknown；指向探索报告 `explore/reports/2026-05-03_openclaw-plugin-quiet-workspace-bridge.md`
  - 影响范围: `.anws/v5/05_TASKS.md`；新增 `explore/reports/2026-05-03_openclaw-plugin-quiet-workspace-bridge.md`
  - PRD 追溯: [REQ-019]；US-001 / US-006（可观测性）；不改变 ADR 核心前提

## 2026-05-02 - IDE 提示词与审查技能对齐

- [CHANGE] `.cursor/`、`.windsurf/`：纳入仓库并收紧设计契约源口径
  - 用户原话: "把这些提示词文件也处理一下吧"
  - 修改内容: 新增 `.cursor/README.md`、`.windsurf/README.md` 说明与 `.anws/v{N}` 的关系；`/challenge` 与 `design-reviewer` / `task-reviewer` / `code-reviewer` 技能明确排除 `*.old.md`、Non-Contract Archive、`_archive/` / `_legacy/`，且默认不把 `04_SYSTEM_DESIGN/_review/` 当作当前契约源
  - 影响范围: `.cursor/commands/challenge.md`; `.cursor/skills/design-reviewer/SKILL.md`; `.cursor/skills/task-reviewer/SKILL.md`; `.cursor/skills/code-reviewer/SKILL.md`; `.cursor/README.md`; `.windsurf/workflows/challenge.md`; `.windsurf/skills/design-reviewer/SKILL.md`; `.windsurf/skills/task-reviewer/SKILL.md`; `.windsurf/skills/code-reviewer/SKILL.md`; `.windsurf/README.md`; `.anws/install-lock.json`（`cursor` / `windsurf` 的 `managedFiles` 与 `ownership` 增补 README）
  - PRD 追溯: [REQ-026]（文档可追溯与协作入口）

## 2026-05-01 - /change AUTO: v5 design/tasks review 回流
- [CHANGE] `05_TASKS.md`: 修复第 8 轮 design/tasks review 发现的依赖、里程碑与验证承接问题
  - 用户原话: "/change 批准了，请修复吧，直接AUTO修复"
  - 修改内容: 拆清 S1 `heartbeat_check` surface 与 S2 decision loop 接入边界；解除 README/INT-S4 循环依赖；将 `T4.4.1` 纳入 S3 / INT-S3；提升 `T3.2.1`、`T4.2.2`、`T4.4.1` 的 P0 承接；补充 P0 单元/契约测试与 docs-vs-observed host capability 证据要求
  - 影响范围: `.anws/v5/05_TASKS.md`
  - PRD 追溯: [REQ-019], [REQ-022], [REQ-023], [REQ-024], [REQ-025], [REQ-026]
- [CHANGE] `04_SYSTEM_DESIGN/*`: 收敛 source coverage、side-effect idempotency、delivery proof 与公共类型漂移
  - 用户原话: "/change 批准了，请修复吧，直接AUTO修复"
  - 修改内容: 统一 all-claim source grounding；将 effect commit 改为 get-or-create + idempotency lookup；统一 `SourceRef` / `UserInterestSignal` 形态；修正 delivery unavailable -> fallback_candidate 顺序；要求 `sent` delivery attempt 带 `messageId` 或 `hostProofRef`；根据最小复核补齐 L0 `EvidencePack.sourceCoverage`、state L0 `SourceRef.observedAt` 与 research 命名漂移
  - 影响范围: `control-plane-system.md`; `control-plane-system.detail.md`; `state-system.md`; `state-system.detail.md`; `connector-system.md`; `connector-system.detail.md`; `observability-system.md`; `observability-system.detail.md`; `behavioral-guidance-system.md`; `behavioral-guidance-system.detail.md`; `behavioral-guidance-system-research.md`; `cli-system.md`; `cli-system.detail.md`
  - PRD 追溯: [REQ-019], [REQ-020], [REQ-022], [REQ-024], [REQ-025]
- [CHANGE] readiness 文档: 更新 v5 当前阶段与 challenge 门禁
  - 用户原话: "/change 批准了，请修复吧，直接AUTO修复"
  - 修改内容: `00_MANIFEST.md` 标记 design/tasks 完成；`02_ARCHITECTURE_OVERVIEW.md` Next Steps 改为 `/forge`；`control-plane-system.old.md` 标记为 non-contract archive；`07_CHALLENGE_REPORT.md` 更新第 8 轮修复状态
  - 影响范围: `.anws/v5/00_MANIFEST.md`; `.anws/v5/02_ARCHITECTURE_OVERVIEW.md`; `.anws/v5/04_SYSTEM_DESIGN/control-plane-system.old.md`; `.anws/v5/07_CHALLENGE_REPORT.md`
  - PRD 追溯: [REQ-026]

## 2026-05-01 - 初始化
- [ADD] 创建 `.anws` v5 版本
- [CHANGE] 从 v4 host-safe heartbeat bridge / plugin runtime spine 演进到 lived-experience closure：真实 heartbeat decision loop、生活证据、Quiet 记忆与主动联系用户闭环
- [ADD] 完成 v5 PRD、系统架构总览与 ADR 决策层；新增 OpenClaw lived-experience closure 研究报告与 `ADR_007_HEARTBEAT_DELIVERY_AND_LIFE_EVIDENCE_CLOSURE.md`

## 2026-05-01 - chore: 移除仓库内辅助 IDE 投影并收窄 install-lock
- [REMOVE] 不再将 `.github/prompts`、`.github/skills`、`.opencode/commands`、`.opencode/skills` 纳入版本库（辅助开发用；各 IDE 侧改由本地或 `anws install` 投放）
- [CHANGE] `.anws/install-lock.json`：`copilot` / `opencode` 目标的 `managedFiles` 收窄为仅 `AGENTS.md`，与仓库文件集合一致
- [CHANGE] `plugin/package.json` 与 `plugin/openclaw.plugin.json` 版本字段对齐 **0.1.8**（与已发布 npm 一致）

## 2026-05-01 - forge: T1.2.4 文档收口
- [CHANGE] T1.2.4: 完成 Host-safe 运维说明（§5.1.2 示例与排障表 + README 链指）
  - 用户原话: "/forge 请进行修改吧"
  - 修改内容: 在 `cli-system.md` 增补 `second_nature_ops` 正误 JSON 示例与误判排障表；英/中文 README 增加发布包 host-safe 预期说明并指向 §5.1.1–§5.1.2；`05_TASKS` 勾选 T1.2.4；`AGENTS.md` 记录 Wave 3
  - 影响范围: `.anws/v4/04_SYSTEM_DESIGN/cli-system.md`；`README.md`；`README.zh-CN.md`；`.anws/v4/05_TASKS.md`；`AGENTS.md`
  - PRD 追溯: [REQ-017]

## 2026-05-01 - 局部修订变更（宿主实测回流）
- [CHANGE] INT-S3: 追加隧道复测验证说明（2026-05-01）
  - 用户原话: "/change 请你去修改我们的文档或者是tasks，准备好后续的规划"
  - 修改内容: 在里程碑验证结果中补充 SSH 隧道场景下 `second_nature_ops` 正确形态、host-safe 命令语义分层、HEARTBEAT/EvoMap 配置抽样结论，避免后续优化误判「Unknown command」与「空 connectors」
  - 影响范围: `.anws/v4/05_TASKS.md`
  - PRD 追溯: [REQ-014], [REQ-017]
- [CHANGE] 新增 T1.2.4 [REQ-017]: Host-safe surface 运维说明与验收分层（文档）
  - 用户原话: "/change 请你去修改我们的文档或者是tasks，准备好后续的规划"
  - 修改内容: 新增 P1 文档承接任务，收敛 host-safe 行为矩阵与误判排障，为后续 forge/优化提供单一事实入口
  - 影响范围: `.anws/v4/05_TASKS.md`（依赖图增加 T1.2.3 → T1.2.4）；`.anws/v4/04_SYSTEM_DESIGN/cli-system.md` §3.2 / §5.1.1
  - PRD 追溯: [REQ-017]
- [CHANGE] `cli-system.md`: 同步 §3.2/§3.4 现状表述并新增 Host-safe 表面矩阵
  - 用户原话: "/change 请你去修改我们的文档或者是tasks，准备好后续的规划"
  - 修改内容: 移除「heartbeat_check 仍未进入 surface」等与 T1.2.3 完成态冲突的过时句；补充 shipped host-safe 命令矩阵便于运维对照
  - 影响范围: `.anws/v4/04_SYSTEM_DESIGN/cli-system.md`
  - PRD 追溯: [REQ-017]

## 2026-04-27 - 受控扩展回流
- [CHANGE] T1.2.2: 收紧 packaged service surface 的语义边界
  - 用户原话: "开始吧。/change auto 模式，自动运行整个流程"
  - 修改内容: 明确 `second-nature-runtime` / lifecycle service 只提供 packaged runtime carrier、lifecycle truth 与最小 activation spine，不再表述为已完成 heartbeat host bridge
  - 影响范围: `05_TASKS.md`；`ADR_005_HEARTBEAT_RUNTIME_BOUNDARY.md`；`cli-system.md`
  - PRD 追溯: [REQ-017]
- [CHANGE] T1.2.3: 新增 `heartbeat_check + HEARTBEAT.md` shipping bridge 收口任务
  - 用户原话: "开始吧。/change auto 模式，自动运行整个流程"
  - 修改内容: 将 `HEARTBEAT.md + second_nature_ops("heartbeat_check")` 正式定义为当前 shipping host bridge contract，并补 command parity、验收标准与测试责任
  - 影响范围: `05_TASKS.md`；`ADR_005_HEARTBEAT_RUNTIME_BOUNDARY.md`；`control-plane-system.md`；`cli-system.md`
  - PRD 追溯: [REQ-014]
- [CHANGE] INT-S2 / T3.1.1 / INT-S3: 重划内部主链证明、平台协议证明与宿主闭环证明边界
  - 用户原话: "开始吧。/change auto 模式，自动运行整个流程"
  - 修改内容: 明确 INT-S2 只证明 runtime 内 heartbeat spine，不再外推成宿主闭环；明确 T3.1.1 不再单独承担真实平台连通性结论；把真实宿主 heartbeat 主链验证与最小平台出口验证统一挂到 INT-S3
  - 影响范围: `05_TASKS.md`；`control-plane-system.md`；`cli-system.md`
  - PRD 追溯: [REQ-014], [REQ-015], [REQ-018]

## 2026-03-27 - 初始化
- [ADD] 创建 `.anws` v4 版本

