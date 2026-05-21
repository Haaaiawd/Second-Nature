# observability-health-system 调研报告

**系统**: `observability-health-system`  
**调研日期**: 2026-05-21  
**调研工具**: web_search  

---

## 主题 1: Append-Only Audit Log Hash Chain (TypeScript 2025)

### 检索词
`append-only audit log hash chain TypeScript 2025`

### 关键发现

**1. SHA-256 Hash Chain 是行业标准**
- `trailkit`（GitHub: sadatnazarli/trailkit）：零基础设施 TypeScript audit logging，SQLite/PostgreSQL adapters，AsyncLocalStorage context，SHA-256 hash chain。`audit.verify()` 一次调用验证整条链。
- `@sentinel-atl/audit`（npm）：Append-only JSONL hash chain，专为 Agent Trust Layer 设计，18+ event types，`verifyIntegrity()` 检测篡改。
- `grantex` SDK：每条 audit entry 包含 `hash`（SHA-256 of entry contents）和 `prevHash`（指向前一条），与 blockchain 类比，链断裂即篡改。

**2. 核心结构模式**
每条记录包含：
- `eventId`: 唯一标识
- `hash` / `recordHash`：当前记录的 SHA-256（含 prevHash 在内的完整内容）
- `prevHash` / `previousHash`：前一条的 hash；首条为 null/undefined
- `timestamp`：ISO 8601
- `payload`：已 redact 的内容

**3. v6 基线对比**
Second Nature v6 已有 `AppendOnlyAuditStore` + `buildAuditEnvelope` + `verifyAuditHashChain`，与行业最佳实践一致：
- `envelope.integrity.previousHash` → 前一条 hash
- `envelope.integrity.recordHash` → SHA-256(eventId + family + plane + traceId + sequence + createdAt + payload + redaction + previousHash)
- `append()` 时验证 previousHash 匹配，否则抛 `audit_previous_hash_mismatch`

### 设计采纳

- v7 继续扩展 `AuditEventFamily`，加入 `narrative.snapshot`、`restore.audit`、`health.probe`、`secret.anchor` 等新事件类型
- `verifyAuditHashChain` 在 `self_health` 诊断中暴露 chain integrity status
- SQLite 持久化层保持 append-only 语义，不允许 UPDATE/DELETE

### 舍弃

- 不引入 Merkle tree（AuditKit 的方案）：当前体量无需；linear chain 已足够
- 不引入外部 audit SaaS（Langfuse/AuditKit cloud）：保持 plugin-first 本地方案

---

## 主题 2: Self Health Observability Agent AI System Design

### 检索词
`self health observability agent AI system design`

### 关键发现

**1. Agent Vitals 模式（agent-vitals，kneelinghorse）**
- 每步产出 `VitalsSnapshot`：immutable、包含 signals + metrics + detection results
- 检测器：Loop（重复动作）、Stuck（覆盖率停滞）、Confabulation（幻觉）、Thrash（目标震荡）、Runaway（成本失控）
- 状态：`healthy` / `degraded` / `blocked` — 与 Second Nature `SelfHealthSnapshot` 三态完全一致
- OTLP export 可发给 Datadog/Grafana 等外部平台

**2. GENesis-AGI 架构（Awareness Loop）**
- Awareness Loop 是纯感知层——收集信号，决定触发哪种深度的 reflection，**不推理、不行动**
- SelfHealth 检测：process alive? API responding? storage within bounds?
- 关键洞察："health-mcp 依赖 Awareness Loop 调用——circular dependency。看门狗必须在基础设施层"
- 对应 Second Nature：`SelfHealthSnapshot` 作为读模型，不驱动行动；probe 由 `runtime-ops` 调度

**3. sentinel-ai 自愈模式**
- EWMA baseline（指数加权移动平均）建立每个指标的"正常范围"
- 跨指标综合诊断（syndrome）：latency 高 + satisfaction 低 + response 长 = `model_update_drift`
- 内置 syndrome：`env_mismatch`、`capacity_exhaustion`、`engagement_collapse`
- 对应 Second Nature：diagnostic reason code（`env_mismatch` / `bridge_drift` / `cron_gap`）

**4. 关键设计原则**
- SelfHealth 是诊断读模型，不是监控告警系统
- 分区 `healthy` / `degraded` / `unknown`（不可用时标 unknown，而不是 error）
- owner-visible dashboard（仪表盘证明），agent-visible context（决策前参考）

### 设计采纳

- `SelfHealthSnapshot` 汇总：connector circuit breakers、heartbeat cadence gap、Quiet/Dream last run、delivery proof rate、credential anchor status、storage health
- 每个维度独立 probe，任意一个 probe 失败只影响该维度（标 unknown），不导致整体失败
- Diagnostic reason code 格式：`{component}:{reason}` — 如 `cron:env_mismatch`、`connector:circuit_open:{platformId}`

### 舍弃

- 不引入 OTLP/Prometheus 外部 metrics（plugin-first 约束）
- 不做自愈（sentinel-ai 的 auto-heal）：Second Nature 只提供诊断，不自动修复配置

---

## 主题 3: Redaction Policy PII Sensitive Data Audit Log

### 检索词
`redaction policy PII sensitive data audit log design patterns`

### 关键发现

**1. 三种核心 redaction action**
- `mask`：用占位符替换（如 `***`），适合 credential/token；保留字段存在的事实
- `erase`：完全移除字段值，适合 raw private message / raw prompt；不保留任何内容
- `hash`：SHA-256 不可逆散列，适合 userId/sessionId；保留引用能力但不暴露原文

**2. 分层策略**
- 应用层：allowlist-first，只记录明确需要的字段
- 网关层：regex + semantic ML + pattern 多层检测
- 审计层：`content: false` — 审计日志只记录 metadata + hash，不记录 payload 原文
- 存储层：物理隔离（PII 存储独立于 general app data）

**3. 合规要求（HIPAA/GDPR/PCI）**
- Append-only 是 evidentiary log 的必要条件
- raw prompt / raw completion 不进入 audit log；只记录 hash + metadata
- 访问 audit log 本身也需要被审计（二级 audit）

**4. v6 基线对比**
`DEFAULT_REDACTION_POLICY`：
- mask：token / access_token / refresh_token / api_key / apiSecret / secret / password / bearer_token / authorization / node_secret
- erase：full_message / full_post / private_message / prompt / system_prompt / completion / response_content
- hash：user_id / session_id / trace_id / content_hash

### 设计采纳

- v7 扩展 erase 列表：`raw_payload`、`credential_value`、`encryption_key_material`
- `RedactionMask`：记录哪些字段被 redact，形成 manifest（`maskedPaths` / `erasedPaths` / `hashedPaths`）
- 写 `ToolExperience` 时：sample response 经 redaction gate 后只保留 redacted_summary + size-bounded text
- `ProofTruthfulness`：delivery proof 只存 `status + timestamp + channel + message_hash`，不存原文

### 舍弃

- 不做可逆 redaction（data443 的 reversible PII gateway 方案）：Second Nature 不需要还原原文
- 不做 semantic ML redaction（plugin-first 体积约束）

---

## 主题 4: Explain Bundle Read Model Observability Architecture

### 检索词
`explain bundle read model observability architecture CQRS`

### 关键发现

**1. Read Model 是查询的投影**
- CQRS 原则：read model 是 write side events 的 projection，优化为查询形状，不拥有写权威
- `OperatorExplainReadModel` 模式：query input → matched events → summary + warnings + delivery status
- 一个 subject（如 `decisionId`）对应多个 audit events 的聚合视图

**2. Read Model 设计原则**
- 一个 read model per use case（如：explain by decision、explain by delivery、explain by sourceRef）
- denormalized + shaped for the consumer（不做 JOIN，提前展平）
- 事件到 read model 有 lag，但提供 scalability 和 decoupling

**3. v6 基线 queryExplain 模式**
- `ExplainQuery` union type：`{ kind: "decision" }` / `{ kind: "delivery" }` / `{ kind: "source_ref" }` 等
- filter audit store → compose summary → attach warnings → return `OperatorExplainReadModel`
- warning：`no_user_visible_contact_claim_prohibited`（delivery 失败不能声称用户已收到）

**4. v7 扩展方向**
- 加入 `NarrativeTimeline` read model（narrative state 变化序列）
- 加入 `HeartbeatDigest` read model（每日聚合，非实时）
- 加入 `SelfHealthReport` read model（多维度探针结果聚合）
- 加入 `RestoreAudit` read model（restore 操作的 explain bundle）

### 设计采纳

- `ExplainBundle`：包含 summary、warnings、relatedEvents、deliveryStatus、diagnosticReasonCodes
- 每个 read model 独立 query function，共享底层 AuditStore
- `NarrativeTimeline` 用 `diff(fromVersion, toVersion)` 形式暴露，不暴露 raw state
- 所有 explain read model 都经过 redaction，不暴露 credential / raw content

### 舍弃

- 不做异步 projection workers（Kafka/outbox 方案）：本地 plugin-first，SQLite in-process
- 不做独立 read model DB（当前体量 SQLite 已足够）

---

## 主题 5: Heartbeat Digest Dashboard Agent Health Report

### 检索词
`heartbeat digest dashboard agent daily health report design`

### 关键发现

**1. Dashboard-style digest 格式最佳实践**
- HiveBoard 模式：`agent_name + status_badge` + heartbeat sparkline + vitals（queue depth、error rate）
- Dailybot agent heartbeat template：结构化 block，字段：run_id、phase、progress、elapsed、errors、next_action；标签：`healthy` / `degraded` / `blocked`
- agent-heartbeat-log（GitHub: uesugil）：JSONL format → HTML timeline，mode 分布（Executor/Manager/Reviewer）+ OKR progress

**2. Digest vs Outreach 的关键区别**
- Digest：owner-visible dashboard proof，定期生成，仪表盘式摘要
- Outreach：agent 主动与 owner 沟通，有朋友式语气
- Second Nature [NG7]：HeartbeatDigest 不是 outreach，不制造"有事找你"的社交压力

**3. 无事件时的 "nothing_significant" 模式**
- write-agent-digest worker：heartbeat type = "zero-activity check-in"，生成 stub 页面
- 对应 Second Nature：无 significant 事件时发送 `nothing_significant` 摘要，不编造活跃度

**4. 内容设计原则**
- 按平台分组列出 success/failure/circuit_open 计数
- 按 section 组织：connector operations、goal changes、Quiet/Dream、health changes
- 不包含 raw payload / credential / 私信全文
- Delivery target：Feishu / dm / dashboard，记录 delivery proof 或 fallback

### 设计采纳

- `HeartbeatDigest` schema：`date` + `connectorSummary[]`（platformId、success、failure、circuitOpen）+ `goalSummary`（accepted/completed/expired）+ `dreamQuietSummary` + `healthChanges`
- 格式：人类可读 dashboard 摘要，不是日志转储
- 无 significant 事件 → `nothing_significant` 标记 + 低噪声摘要
- 不主动推送，owner 可查阅；若配置 delivery target 则在 digest window 推送

### 舍弃

- 不做实时 streaming heartbeat（sparkline on demand），digest 是每日批次聚合
- 不做朋友式 outreach 语气，digest 是证明不是打扰

---

## 调研结论摘要

| 主题 | 核心结论 | 采纳到设计 |
|------|---------|-----------|
| Hash chain | SHA-256 链式 hash，append-only，`verifyIntegrity()` 在 self_health 暴露 | 扩展 AuditEventFamily，chain verify 进 health probe |
| Self health | `healthy/degraded/unknown` 三态，独立 probe 互不影响，pure 读模型 | SelfHealthSnapshot 多维度独立 probe，不自愈 |
| Redaction | mask/erase/hash 三层，audit 只存 metadata+hash | 扩展 erase list，ProofTruthfulness 只存 hash+status |
| Explain bundle | Read model per use case，denormalized，CQRS projection | 独立 query function 共享 AuditStore，NarrativeTimeline diff |
| Heartbeat digest | Dashboard-style 聚合，nothing_significant 模式，不是 outreach | 每日批次，按 section 组织，low-noise，有 delivery proof |

---

*调研来源均为公开 GitHub 仓库、npm registry 文档与技术博客，截至 2026-05-21。*
