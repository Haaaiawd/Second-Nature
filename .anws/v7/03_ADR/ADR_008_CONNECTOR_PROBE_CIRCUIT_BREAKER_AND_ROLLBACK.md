# ADR-008: Probe Truth, History Browser, and Bounded Rollback

## 状态
Accepted

## 日期
2026-05-21

## 背景
Dry connector test 曾给出假健康；narrative 只能看到最新版本；设错 goal、写错 evidence、删错记录时没有 undo。v7 需要把真实探针、历史浏览和有限回滚接进同一套可恢复性原则。

## 决策驱动因素
- Dry health 不得冒充真实 endpoint 成功。
- Narrative/decision 变化必须可 diff 和 timeline 查询。
- Mutable state 写入前应保留有限 restore snapshot。
- Rollback 不能绕过 credential、trust policy 或 audit。

## 候选方案

### 方案 A: 只保留 audit log
- **优点**: 已有基础。
- **缺点**: 不方便 diff，不等于可 restore。

### 方案 B: 全量长期版本库
- **优点**: 回滚强。
- **缺点**: 存储和隐私成本高，不适合 plugin-first。

### 方案 C: Wet probe + NarrativeTimeline + bounded RestoreSnapshot
- **优点**: 真实健康、可追溯、可有限撤回。
- **缺点**: 需要 snapshot scope、retention 和 restore audit。

## 决策
采用方案 C。Connector 支持 `connector_test --wet`；observability 提供 `narrative:diff` / `timeline`；state-memory 在目标 mutable state 写入前保留最近 3 版 snapshot，restore 必须写 audit，不恢复 credential 明文，不绕过 trust policy。

## 后果

### 正面
- 404/401 这种真实失败不会被 dry ok 掩盖。
- Narrative 从“最新一版”变成可浏览历史。
- 误操作有最小恢复窗口。

### 负面
- Snapshot scope 要谨慎，避免保存敏感 raw content。
- Restore 需要处理版本冲突和部分恢复失败。

### 需要的后续行动
- 定义 `narrative:diff`、`timeline`、`restore` CLI/ops contract。
- 为 snapshot retention、restore audit 和 sensitive exclusion 写验证。

## 参考资料
- `.anws/v7/01_PRD.md` [REQ-009], [REQ-011]

## 影响范围
本 ADR 被以下系统引用:
- [connector-system](../04_SYSTEM_DESIGN/connector-system.md) - §8 Trade-offs
- [state-memory-system](../04_SYSTEM_DESIGN/state-memory-system.md) - §8 Trade-offs
- [observability-health-system](../04_SYSTEM_DESIGN/observability-health-system.md) - §8 Trade-offs
- [runtime-ops-system](../04_SYSTEM_DESIGN/runtime-ops-system.md) - §8 Trade-offs
