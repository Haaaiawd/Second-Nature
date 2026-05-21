# ADR-005: Quiet Writes Diary, Dream Continues Sleep Consolidation

## 状态
Accepted

## 日期
2026-05-21

## 背景
v6 的 Quiet claim 可能只有 `{statement: ""}` 或薄 summary，Dream 声明存在但不自然运行。用户希望 Quiet 像日记：今天看到了什么、什么值得注意、明天想看什么；Quiet 完成后 Dream 接着反思、去重、建 insight。

## 决策驱动因素
- Quiet 不应只是一句技术 summary。
- 语言可以自然、感性、有哲思，但必须 source-backed。
- Dream 不该依赖人类手动说“该做梦了”。
- Candidate 与 accepted 必须分离，只有 accepted projection 回到 heartbeat。

## 候选方案

### 方案 A: 保持当前 summary + manual dream
- **优点**: 改动小。
- **缺点**: 睡眠整理不成闭环，产物薄。

### 方案 B: 让 Dream 直接写入行动决策
- **优点**: 回流强。
- **缺点**: 越权，容易把候选整理当结论。

### 方案 C: Quiet DailyDiary + auto Dream + accepted projection
- **优点**: 自然写作、自动睡眠、严格候选/接受分离。
- **缺点**: 需要调度、source grounding 和质量测试。

## 决策
采用方案 C。Quiet 生成 `DailyDiary` 和 grounded claims；Quiet 完成后在允许窗口触发 Dream，Dream 生成 candidate outputs，经验证后形成 accepted projection。Heartbeat 只读取 accepted projection。

## 后果

### 正面
- Quiet 更有灵魂，但不编故事。
- Dream 真正接在日常节律后面。
- 第二天 heartbeat 能带着昨晚沉淀醒来。

### 负面
- 自然语言质量需要测试和审阅准则。
- Dream auto-schedule 要有 lock、budget、skip reason。

### 需要的后续行动
- 定义 DailyDiary artifact schema。
- 设计 Quiet completion -> Dream schedule trigger。
- 把 inner guide 风格原则写入 guidance/quiet 设计。

## 参考资料
- `docs/claw-second-nature-inner-guide.md`
- `.anws/v7/01_PRD.md` [REQ-005]

## 影响范围
本 ADR 被以下系统引用:
- [dream-quiet-system](../04_SYSTEM_DESIGN/dream-quiet-system.md) - §8 Trade-offs
- [control-plane-system](../04_SYSTEM_DESIGN/control-plane-system.md) - §8 Trade-offs
- [guidance-voice-system](../04_SYSTEM_DESIGN/guidance-voice-system.md) - §8 Trade-offs
