# 变更日志 - .anws v5

> 此文件记录本版本迭代过程中的微调变更（由 /change 处理）。新增功能/任务需创建新版本（由 /genesis 处理）。

## 格式说明
- **[CHANGE]** 微调已有任务（由 /change 处理）
- **[FIX]** 修复问题
- **[REMOVE]** 移除内容

---

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

