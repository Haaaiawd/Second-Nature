# ADR-006: Delivery, Channel Feedback, and Self Health Must Be Truthful

## 状态
Accepted

## 日期
2026-05-21

## 背景
主动联系曾因 isolated session 没有 channel 而失败；手动 heartbeat 与 systemd cron env 不一致导致测试结果不等同真实结果。v7 需要让 delivery truth、channel feedback 和 self health 成为身体健康的一部分。

## 决策驱动因素
- 缺少 delivery proof 不得标记 sent。
- current_channel / dm 是 delivery mode，不是 outreach 语气。
- cron env、bridge env、workspace root、credential、Dream lock、storage 必须在 self health 中可见。
- 手动 connector run 必须隔离 heartbeat cadence。

## 候选方案

### 方案 A: 只记录 delivery attempt
- **优点**: 简单。
- **缺点**: Owner 是否听见、host 是否 drop 不清楚。

### 方案 B: 把所有消息都当 outreach
- **优点**: 统一发送路径。
- **缺点**: digest、dashboard、状态证明会被误读成社交打扰。

### 方案 C: ChannelFeedback + SelfHealth + delivery proof
- **优点**: 清楚区分 sent/not_sent/fallback；把宿主漂移纳入诊断。
- **缺点**: 需要 host-specific probe 和 fallback 语义。

## 决策
采用方案 C。delivery 需要 messageId 或 hostProofRef；ChannelFeedback 进入 RelationshipMemory；SelfHealth 聚合 root/env/credential/connector/delivery/Dream/storage/setup 状态。`connector:run` 和 wet test 作为 manual trigger，不改变自然 heartbeat cadence。

## 后果

### 正面
- 不再把 host drop 冒充已发送。
- Agent 能知道身体哪里坏了，而不是误判自己意图失败。

### 负面
- 宿主差异需要 E2E checklist。
- self health 要严格 redaction，避免泄漏配置。

### 需要的后续行动
- 设计 `ChannelFeedback` schema 和 `self_health` JSON surface。
- host E2E 覆盖 current_channel、dm、no channel、proof missing。

## 参考资料
- `.anws/v7/01_PRD.md` [REQ-006], [REQ-007]

## 影响范围
本 ADR 被以下系统引用:
- [runtime-ops-system](../04_SYSTEM_DESIGN/runtime-ops-system.md) - §8 Trade-offs
- [observability-health-system](../04_SYSTEM_DESIGN/observability-health-system.md) - §8 Trade-offs
- [guidance-voice-system](../04_SYSTEM_DESIGN/guidance-voice-system.md) - §8 Trade-offs
