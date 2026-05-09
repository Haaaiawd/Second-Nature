# 探索报告: connector-system v5 Source-backed Platform Execution

**日期**: 2026-05-01  
**探索者**: GPT-5.5  
**系统**: `connector-system`

---

## 1. 问题与范围

**核心问题**: `connector-system` 如何在不重写平台客户端、不污染 control-plane 的前提下，把平台浏览、互动、任务发现与工作推进变成 source-backed `LifeEvidenceCandidate`，并为 v5 lived-experience closure 提供可恢复、可审计、可降级的执行层？

**探索范围**:
- 包含: connector manifest、capability taxonomy、execution adapter、API-first / degraded fallback、retry/backoff、idempotency、verification recovery、source refs、life evidence candidate、observability event。
- 不包含: outreach judgment、delivery target 解析、长期记忆治理、platform flavor / 社区文化模板。

---

## 2. 核心洞察 (Key Insights)

1. **v5 connector 的核心产物不是平台 DTO，而是 source-backed evidence candidate**: 平台原始响应必须收敛为 `ConnectorResult` + `LifeEvidenceCandidate[]` + `SourceRef[]`，否则 Quiet / outreach 会失去事实来源。
2. **统一的是 capability intent，不是 endpoint 形状**: Airbyte 的 spec/check/discover 思路说明 connector 应先声明能力、schema 和验证方式。Second Nature 应使用 manifest-first，而不是平台 if/else。
3. **side-effecting 操作必须带 effect semantics**: 发帖、回复、claim task 这类动作必须有 idempotency key、retry safety 和 effect commit link；无幂等就不能自动重试。
4. **fallback 是 degraded execution，不是等价通道**: CLI / skill / browser fallback 可以救 demo 和 bootstrap，但必须被 manifest 显式声明，并在 result / observability 里标记 degraded。
5. **connector 只能生产候选和事实，不能判断是否联系用户**: 它可以说“这里有一个可能值得看的内容”，但不能自己做 user interest、cooldown、dedupe 或 delivery 决策。

---

## 3. 详细发现

### 3.1 Manifest-first Connector Pattern

**探索方式**: Airbyte protocol / connector best practices / connector architecture 搜索。

**发现**:
- Airbyte 将 `spec/check/discover/read` 作为 connector 基础协议：先声明连接配置、验证连接、发现 stream/schema，再读取。
- 对 Second Nature 来说，等价模式应是 `describeConnector()` / `checkConnector()` / `discoverCapabilities()` / `executeCapability()`。
- connector 应优先证明 declared capability 可靠，而不是堆更多半生不熟 endpoint。

**来源**:
- `https://docs.airbyte.com/platform/understanding-airbyte/airbyte-protocol.md`
- `https://docs.airbyte.com/connector-development/tutorials/custom-python-connector/discover`
- `https://docs.airbyte.com/platform/connector-development/best-practices`

### 3.2 Adapter + Policy Layer

**探索方式**: connector SDK / team connector 架构实践搜索。

**发现**:
- 可靠 connector 通常分为 transport/client layer、adapter layer、domain/policy layer。
- transport 处理 HTTP/CLI/browser，adapter 转换外部 payload，policy 处理 auth、retry、rate limit、idempotency、routing。
- 反模式是 per-platform 巨类和字符串错误分类。

**来源**:
- `https://quickconnect.app/design-patterns-for-developer-sdks-that-simplify-team-connec`
- `https://quickconnect.app/designing-scalable-team-connectors-best-practices-for-develo`
- `https://kafka.apache.org/35/kafka-connect/connector-development-guide/`

### 3.3 Retry / Backoff / Idempotency

**探索方式**: Stripe / AWS Builders Library / Airbyte error handling 搜索。

**发现**:
- Stripe 推荐 mutating request 使用 idempotency key，且重试必须使用同一 key；复用 key 时参数不一致应报错。
- AWS Builders Library 明确指出有副作用的远程调用如果没有幂等性，重试可能放大问题；应使用 capped exponential backoff + jitter，并限制重试次数。
- Airbyte error handler 也推荐按 status / response filter 决定 retry、rate limit、fail，并尊重 Retry-After。

**来源**:
- `https://stripe.com/docs/api/idempotent_requests`
- `https://stripe.com/blog/idempotency`
- `https://aws.amazon.com/builders-library/timeouts-retries-and-backoff-with-jitter/`
- `https://docs.airbyte.com/platform/connector-development/connector-builder-ui/error-handling.md`

### 3.4 Agent Tool / Provenance / Observability

**探索方式**: agent connectors / observability / provenance 搜索。

**发现**:
- Agent connector 应把 tool/action 输入输出、source refs、trace ids 和 failure reasons 记录下来，便于后续解释和回放。
- MCP / external tool ecosystem 倾向 tool discovery、connection health、permissions、per-agent tool assignment。
- 对 Second Nature 来说，connector output 必须带 `sourceRefs`、`rawRef` / `contentRef`、`sensitivity`、`eventType`，而不是只给 summary。

**来源**:
- `https://sre.azure.com/docs/concepts/connectors`
- `https://www.arthur.ai/blog/best-practices-for-building-agents-part-1-observability-and-tracing`
- `https://rafaelsilva.com/files/publications/souza2025rewords.pdf`

### 3.5 v5 本地契约约束

**探索方式**: PRD / ADR / 已完成系统设计对齐。

**发现**:
- PRD [REQ-020] 要求 platform browse / work progress 进入 life evidence，并包含 timestamp、platformId、summary、sourceRefs、eventType。
- PRD [REQ-021] 要求 exploration/social/work windows 由 control-plane 规划；connector 不拥有 rhythm gate。
- PRD [REQ-022] 要求主动联系 evidence-backed；connector 只提供 evidence，不做 outreach judgment。
- PRD [REQ-024] 要求 Quiet 消费 source-backed life evidence；connector source refs 是 Quiet 的事实输入之一。
- ADR-002 规定 Connector Contract + Execution Adapter，API-first，CLI/skill fallback 仅作为 fallback/bootstrap/demo acceleration。
- ADR-007 规定 life evidence 是主动联系和 Quiet 的事实来源。

**来源**:
- `../../01_PRD.md`
- `../../02_ARCHITECTURE_OVERVIEW.md`
- `../../03_ADR/ADR_002_CONNECTOR_MODEL.md`
- `../../03_ADR/ADR_007_HEARTBEAT_DELIVERY_AND_LIFE_EVIDENCE_CLOSURE.md`
- `../state-system.md`
- `../observability-system.md`
- `../control-plane-system.md`

---

## 4. 方案清单

| 方案 | 可行性 | 风险 | 推荐度 |
| --- | :---: | --- | :---: |
| A. Manifest-first + capability contract + execution adapter + evidence mapper | 高 | 类型和测试较多 | 推荐 |
| B. 保留旧 v2 contract/adapter，但只补需求号 | 中 | 漏掉 source refs / effect commit / v5 evidence closure | 不推荐 |
| C. 每个平台暴露专用方法 | 高 | control-plane 被平台细节污染 | 不推荐 |
| D. 纯 CLI/skill wrapper | 中 | 脆弱、不可审计、无法保证 evidence 质量 | 不推荐 |

---

## 5. 行动建议

| 优先级 | 建议 | 理由 |
| :---: | --- | --- |
| P0 | 定义 `ConnectorManifest` / `CapabilityIntent` / `ExecutionChannel` / `ConnectorResult` | 收束平台差异 |
| P0 | 定义 `LifeEvidenceCandidate` 与 `SourceRef` 输出契约 | 承接 [REQ-020], [REQ-024] |
| P0 | 区分 read-only、side-effect、task-claim、heartbeat keepalive effect semantics | 决定 retry/idempotency 安全性 |
| P0 | side-effecting operation 必须要求 `idempotencyKey` 或标记 `retryUnsafe` | 防重复发帖/回复/claim |
| P0 | 输出 `ConnectorAttemptAudit` 给 observability | 支撑 failure explain |
| P1 | 定义 `describeConnector()` / `checkConnector()` / `discoverCapabilities()` | 支撑 CLI status 与 blueprint 验证 |
| P1 | 标记 degraded fallback channel | 不把 browser/skill 当稳定 API |

---

## 6. 局限性与待探索

- Moltbook / InStreet / EvoMap 的真实 API / skill 字段仍需后续 forge 或 host smoke 验证。
- 本次不实现 platform-specific connector 代码，只定义 contract 与行为边界。
- MCP 作为 future execution channel 可保留，但 v5 首版不要求建立 MCP server。
- browser automation fallback 风险高，应只做 explicit degraded channel，不做默认路径。

---

## 7. 参考来源

1. [Airbyte Protocol](https://docs.airbyte.com/platform/understanding-airbyte/airbyte-protocol.md)
2. [Airbyte Discover](https://docs.airbyte.com/connector-development/tutorials/custom-python-connector/discover)
3. [Airbyte Connector Best Practices](https://docs.airbyte.com/platform/connector-development/best-practices)
4. [Airbyte Error Handling](https://docs.airbyte.com/platform/connector-development/connector-builder-ui/error-handling.md)
5. [Stripe Idempotent Requests](https://stripe.com/docs/api/idempotent_requests)
6. [Stripe Idempotency](https://stripe.com/blog/idempotency)
7. [AWS Builders Library: Timeouts, retries and backoff with jitter](https://aws.amazon.com/builders-library/timeouts-retries-and-backoff-with-jitter/)
8. [Kafka Connector Development Guide](https://kafka.apache.org/35/kafka-connect/connector-development-guide/)
9. [Azure SRE Agent Connectors](https://sre.azure.com/docs/concepts/connectors)
10. `../../03_ADR/ADR_002_CONNECTOR_MODEL.md`
11. `../../03_ADR/ADR_007_HEARTBEAT_DELIVERY_AND_LIFE_EVIDENCE_CLOSURE.md`
