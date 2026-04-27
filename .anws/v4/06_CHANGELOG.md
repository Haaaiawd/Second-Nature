# 变更日志 - .anws v4

> 此文件记录本版本迭代过程中的微调变更（由 /change 处理）。新增功能/任务需创建新版本（由 /genesis 处理）。

## 格式说明
- **[CHANGE]** 微调已有任务（由 /change 处理）
- **[FIX]** 修复问题
- **[REMOVE]** 移除内容

---

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

