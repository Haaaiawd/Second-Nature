# 变更日志 - .anws v2

> 此文件记录本版本迭代过程中的微调变更（由 /change 处理）。新增功能/任务需创建新版本（由 /genesis 处理）。

## 格式说明
- **[CHANGE]** 微调已有任务（由 /change 处理）
- **[FIX]** 修复问题
- **[REMOVE]** 移除内容

---

## 2026-03-23 - 初始化
- [ADD] 创建 `.anws` v2 版本

## 2026-03-25 - 微调变更
- [CHANGE] T5.2.2: 明确 policy write 必须落到 state-system canonical store
  - 用户原话: "通过 /change 明确补齐 policy canonical store"
  - 修改内容: 为 `T5.2.2` 增加 policy canonical 写路径约束与验证要求，并在 `cli-system.md`、`state-system.md` 中补齐 policy canonical owner、最小数据模型与 `savePolicy/loadPolicy` port 约束
  - 影响范围: `.anws/v2/05_TASKS.md`, `.anws/v2/04_SYSTEM_DESIGN/cli-system.md`, `.anws/v2/04_SYSTEM_DESIGN/state-system.md`
  - PRD 追溯: [REQ-001]
