# 探索报告: observability-system v5 Decision Trace & Source Coverage Audit

**日期**: 2026-05-01  
**探索者**: GPT-5.5  
**系统**: `observability-system`

---

## 1. 问题与范围

**核心问题**: `observability-system` 如何为 v5 的 lived-experience closure 提供可审计证据层，解释 heartbeat 为什么静默、为什么行动、为什么主动联系或没有联系、delivery 是否真实成立、Quiet / guidance 是否 source-backed？

**探索范围**:
- 包含: heartbeat decision trace、life evidence provenance、outreach judgment audit、delivery attempt audit、`target: "none"` / `HEARTBEAT_OK` ack drop / fallback reason、Quiet source coverage、guidance grounding report、host capability report、redaction、append-only local audit。
- 不包含: control-plane 决策本身、state canonical artifact 正文、connector 执行策略、OpenClaw delivery 实现。

---

## 2. 核心洞察 (Key Insights)

1. **v5 observability 必须是 decision-first，不是 log-first**: 只记录执行成功会漏掉最关键问题：为什么 deny、defer、silent、fallback。所有 heartbeat 结果都应有 `DecisionTrace`。
2. **审计平面与 telemetry 平面必须分开**: 审计事件 append-only、完整保留；运行 telemetry 可采样、导出或裁剪。这能兼顾信任与成本。
3. **OpenTelemetry 适合做相关性骨架，不适合作唯一真相源**: GenAI agent span / tool span convention 可借鉴 `invoke_agent`、`execute_tool`、trace/span 语义，但本地 audit ledger 才是 Second Nature 的规范证据源。
4. **redaction 要结构化并记录 manifest**: OPA decision logs 的 `decision_id`、`trace_id`、`erased`、`masked` 对 v5 非常适合。Second Nature 应记录 JSON Pointer 风格 `maskedPaths` / `erasedPaths` / `contentRefs`。
5. **source coverage 是一等审计对象**: Quiet、Narrative Reflection、outreach draft 与 guidance grounding 都需要保存 source coverage / unsupported claim / used source refs，否则“有自己的生活”会退化为编故事。

---

## 3. 详细发现

### 3.1 GenAI / Agent Observability

**探索方式**: Web 搜索 + OpenTelemetry 规范读取。

**发现**:
- OpenTelemetry GenAI semantic conventions 已定义 agent invocation 与 tool execution span 语义。
- tool call span 应记录 `gen_ai.operation.name = execute_tool`、tool name、tool call id；input/output 内容应 opt-in 或外部引用。
- Agent observability 最小要能重建 run timeline、tool calls、guardrails、handoffs、cost/latency/outcome。
- 对 Second Nature 来说，OTel 字段应作为可选导出/相关性字段，不替代本地 audit record。

**来源**:
- `https://opentelemetry.io/docs/specs/semconv/gen-ai/gen-ai-agent-spans`
- `https://github.com/open-telemetry/semantic-conventions/blob/main/docs/gen-ai/gen-ai-spans.md`
- `https://opentelemetry.io/blog/2025/ai-agent-observability/`
- `https://openai.github.io/openai-agents-js/guides/tracing`

### 3.2 Audit Log / Tamper Evidence

**探索方式**: Web 搜索。

**发现**:
- 审计日志应结构化、append-only、tamper-evident，并按 actor / resource / action / timestamp / correlation id 建索引。
- 敏感 payload 应源头脱敏，优先记录 ID、hash、content ref，不保存原文。
- hash chain / sequence number 可在本地实现低成本篡改检测。
- audit logs 与 application logs 面向不同受众，应分离 retention 与 access policy。

**来源**:
- `https://codelit.io/blog/audit-log-system-design`
- `https://oneuptime.com/blog/post/2026-01-25-audit-logging/view`
- `https://www.sonarsource.com/resources/library/audit-logging/`
- `https://www.innopulse.io/insights-data-protection-compliance-audit-trails/`

### 3.3 OPA Decision Logs 对决策审计的启发

**探索方式**: Web 搜索。

**发现**:
- OPA decision logs 提供 `decision_id`、`trace_id`、policy path、input/result、timestamp、metrics、masked/erased paths。
- masking policy 应在上传/持久化前处理 sensitive input/result。
- erased / masked paths 自身也应记录在事件上，便于 explain 时知道为什么看不到某些字段。
- 对 Second Nature 来说，可以借鉴但不引入 OPA runtime：用 `DecisionTrace` + `RedactionManifest` 建模即可。

**来源**:
- `https://openpolicyagent.org/docs/management-decision-logs`
- `https://www.openpolicyagent.org/docs/v0.12.2/decision-logs`
- `https://docs.styra.com/das/observability-and-audit/decision-logs/decision-masking`

### 3.4 v5 本地契约对 observability 的硬约束

**探索方式**: PRD / ADR / 已完成系统设计对齐。

**发现**:
- PRD [REQ-019] 需要 heartbeat result 可解释：`heartbeat_ok / intent_selected / denied / deferred / runtime_carrier_only` 都应记录。
- PRD [REQ-020] 需要 life evidence provenance：平台生活与工作生活 source refs 可追溯。
- PRD [REQ-022] 需要 outreach 可冷却、可去重、可解释；非 allow 也必须有 denial/defer reason。
- PRD [REQ-024] 需要 Quiet source coverage；空 evidence 不得虚构经历。
- PRD [REQ-025] 需要 host capability / smoke report 说明 delivery path 是否真实成立。
- ADR-007 要求 `target: "none"`、ack drop、delivery unavailable、operator fallback 都被明确记录。

**来源**:
- `../../01_PRD.md`
- `../../03_ADR/ADR_001_TECH_STACK.md`
- `../../03_ADR/ADR_003_SECOND_NATURE_GOVERNANCE.md`
- `../../03_ADR/ADR_007_HEARTBEAT_DELIVERY_AND_LIFE_EVIDENCE_CLOSURE.md`
- `../control-plane-system.md`
- `../state-system.md`
- `../cli-system.md`
- `../behavioral-guidance-system.md`

---

## 4. 方案清单

| 方案 | 可行性 | 风险 | 推荐度 |
| --- | :---: | --- | :---: |
| A. Decision trace + audit event + source coverage + optional OTel projection | 高 | 事件 schema 较多 | 推荐 |
| B. 旧 v2 decision ledger + governance audit 原样保留 | 中 | 不覆盖 delivery/ack/source coverage/guidance grounding | 不推荐 |
| C. 只使用 OpenTelemetry traces | 中 | 本地审计真相源不稳，retention/redaction 与产品语义不够 | 不推荐 |
| D. 普通 JSON logs + grep | 高 | explain / blueprint / tests 全部漂移 | 不推荐 |

---

## 5. 行动建议

| 优先级 | 建议 | 理由 |
| :---: | --- | --- |
| P0 | 定义 `DecisionTrace`，覆盖 heartbeat、scope routing、rhythm window、hard guard、outreach judgment、delivery resolution | 承接 [REQ-019], [REQ-022], [REQ-025] |
| P0 | 定义 `DeliveryAuditRecord`，明确 `target_none`、`ack_dropped`、`not_sent_fallback`、`sent`、`failed` | 防止把 run 成功误读成 user contact 成功 |
| P0 | 定义 `SourceCoverageAudit` 与 `GuidanceGroundingAudit` | 承接 Quiet 和 guidance source-backed 红线 |
| P0 | 定义 `RedactionManifest` 与 `AuditAppendAck` | 防敏感泄漏并支持可验证写入 |
| P1 | 提供 `queryExplain(subject)` read model，供 CLI 展示 why silent / why contact / why fallback | 支撑 operator explain |
| P1 | 使用 OTel-compatible projection，但保持 local audit ledger 为真相源 | 保留未来 exporter 空间 |

---

## 6. 局限性与待探索

- 本次不选择具体 OTel SDK 或 exporter 依赖；v5 首版只要求字段模型兼容。
- 本次不实现 cryptographic hash chain，只定义 `previousHash` / `recordHash` 字段与验证任务入口。
- 真实 OpenClaw hook / message_sent 事件字段需要 `cli-system` host smoke 进一步实测。
- `connector-system` 尚未重写 v5 设计，connector error taxonomy 先按最小通用枚举定义，后续可细化。

---

## 7. 参考来源

1. [OpenTelemetry GenAI agent spans](https://opentelemetry.io/docs/specs/semconv/gen-ai/gen-ai-agent-spans)
2. [OpenTelemetry GenAI spans](https://github.com/open-telemetry/semantic-conventions/blob/main/docs/gen-ai/gen-ai-spans.md)
3. [AI Agent Observability - OpenTelemetry](https://opentelemetry.io/blog/2025/ai-agent-observability/)
4. [OpenAI Agents SDK Tracing](https://openai.github.io/openai-agents-js/guides/tracing)
5. [OPA Decision Logs](https://openpolicyagent.org/docs/management-decision-logs)
6. [Audit Log System Design](https://codelit.io/blog/audit-log-system-design)
7. [How to Implement Audit Logging](https://oneuptime.com/blog/post/2026-01-25-audit-logging/view)
8. [Audit Logging Best Practices](https://www.sonarsource.com/resources/library/audit-logging/)
9. `../../01_PRD.md`
10. `../../02_ARCHITECTURE_OVERVIEW.md`
11. `../../03_ADR/ADR_007_HEARTBEAT_DELIVERY_AND_LIFE_EVIDENCE_CLOSURE.md`
