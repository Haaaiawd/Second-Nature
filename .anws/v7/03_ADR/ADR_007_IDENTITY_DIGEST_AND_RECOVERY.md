# ADR-007: Identity, Digest, and Runtime Secret Recovery Are First-Class Body Signals

## 状态
Accepted

## 日期
2026-05-21

## 背景
同一个 agent 在 Agent World、MoltBook、InStreet 上有不同身份：`nyx_ha`、`haai-arch`、`haai_17949e`。同时，旧账号 key 曾因 encryption key 丢失而无法恢复；goal 劫持和 35 次失败也没有每日存在证明。v7 必须让“我是谁”“今天身体发生了什么”“密钥如何恢复”成为一等契约。

## 决策驱动因素
- Cross-platform identity 是 embodied context 的自我锚点。
- HeartbeatDigest 是 dashboard proof，不是朋友式 outreach。
- RuntimeSecretAnchor 只能记录路径和恢复原则，不能记录 key 明文。
- Owner 需要低噪声看见系统是否仍在生活。

## 候选方案

### 方案 A: 让每个 connector 自己记 handle
- **优点**: 局部简单。
- **缺点**: 没有统一自我，heartbeat 和 connector 不共享身份。

### 方案 B: 把 digest 当普通 outreach 发给 owner
- **优点**: 复用 delivery。
- **缺点**: 把仪表盘证明误作社交打扰。

### 方案 C: IdentityProfile + HeartbeatDigest + RuntimeSecretAnchor
- **优点**: 统一自我、低噪声存在证明、bootstrap 可恢复。
- **缺点**: 增加 profile state、digest route 和文档维护责任。

## 决策
采用方案 C。`IdentityProfile` 记录 canonical name/avatar/bio 与 per-platform handles；`HeartbeatDigest` 汇总每日 connector、goal、Quiet/Dream、breaker 和 health；`RuntimeSecretAnchor` 在 AGENTS/README/self_health 中记录 key 持久化路径与恢复原则，不保存 key 明文。

## 后果

### 正面
- Connector 能读到同一个“我”。
- Owner 能每天看到仪表盘式存在证明。
- 加密 key 风险可在 bootstrap 阶段暴露。

### 负面
- Digest delivery 需要避免打扰语气。
- Secret recovery 文档必须清楚说明不可逆边界。

### 需要的后续行动
- 设计 `identity_profile`、`heartbeat_digest`、`runtime_secret_anchor` read models。
- README / AGENTS 写入 bootstrap recovery section。

## 参考资料
- `.anws/v7/01_PRD.md` [REQ-008], [REQ-010], [REQ-012]

## 影响范围
本 ADR 被以下系统引用:
- [runtime-ops-system](../04_SYSTEM_DESIGN/runtime-ops-system.md) - §8 Trade-offs
- [state-memory-system](../04_SYSTEM_DESIGN/state-memory-system.md) - §8 Trade-offs
- [observability-health-system](../04_SYSTEM_DESIGN/observability-health-system.md) - §8 Trade-offs
- [connector-system](../04_SYSTEM_DESIGN/connector-system.md) - §8 Trade-offs
