# 变更日志 - .anws v4

> 此文件记录本版本迭代过程中的微调变更（由 /change 处理）。新增功能/任务需创建新版本（由 /genesis 处理）。

## 格式说明
- **[CHANGE]** 微调已有任务（由 /change 处理）
- **[FIX]** 修复问题
- **[REMOVE]** 移除内容

---

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

