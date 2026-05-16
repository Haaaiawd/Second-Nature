# Connector System Research

**System ID**: `connector-system`  
**Target**: `.anws/v6`  
**Date**: 2026-05-15  
**Scope**: Dynamic connector ecosystem, manifest registration, capability namespace, trust policy, and v5 parity.

---

## 1. Problem & Scope

| 子问题 | 方向 | 预期产出 |
| --- | --- | --- |
| 动态 connector 应如何注册而不污染核心代码？ | 混合 | manifest scan、schema validation、conflict policy |
| workspace connector 如何避免任意代码执行？ | 向外 | declarative-only default、custom adapter trust gate |
| v5 connector 契约哪些应继承？ | 向内 | capability、route planner、idempotency、evidence mapping |
| side effect retry 如何保持安全？ | 向外 | idempotency key、bounded retry、jitter |

**范围内**: `manifest.yaml` schema、DynamicConnectorRegistry、CapabilityContractRegistry namespace、trust policy、reload semantics、v5 connector parity。  
**范围外**: 15+ 平台内容建设、每个平台 adapter 的完整实现。

---

## 2. Core Insights

1. v6 connector 的目标不是“更多平台脚本”，而是让平台异构性被 manifest、capability 和 runner policy 包住。
2. 动态注册只应自动启用声明式 runner；workspace 中的 custom adapter、skill、browser runner 必须默认 pending trust。
3. v5 的 `CapabilityContractRegistry`、`ConnectorRoutePlanner`、policy layer 和 evidence mapper 是好骨架，应增量演进而不是重写成脚本目录。
4. 同名 `platformId` 冲突必须 fail-closed；覆盖只能来自 owner 显式配置。
5. side-effect retry 只有在 idempotency 和 effect commit 都成立时才安全。

---

## 3. Detailed Findings

### Q1. Connector Ecosystem Pattern

Airbyte 文档把自身描述为 agent 的 data/context layer，并提供 open-source type-safe connectors、managed credentials、HTTP API、MCP server 等接口；这说明 connector 生态的核心价值在于标准化接入与凭据/接口抽象，而不是让上层直接理解每个平台。来源：<https://docs.airbyte.com/>（2026-05-15 检索）。

Airbyte connector testing 文章强调 connector validation、record schema、error handling 和 regression tests；这支持 SN v6 对 manifest contract、schema validation 和 v5 parity regression 的要求。来源：<https://airbyte.com/blog/how-we-test-airbyte-and-marketplace-connectors>。

### Q2. Side-effect Retry and Idempotency

Stripe API 文档将 idempotency key 定义为安全重试创建/更新请求的机制，并要求复用 key 时参数一致；AWS Builders Library 明确指出有副作用的 API 若没有幂等机制通常不安全重试，并建议 timeout、bounded retry、backoff 和 jitter。

来源：
- <https://docs.stripe.com/api/idempotent_requests>
- <https://aws.amazon.com/builders-library/timeouts-retries-and-backoff-with-jitter/>

**对 SN 的约束**: `task.claim`、`post.publish`、`message.send` 等 side-effect capability 必须要求 idempotency key；degraded channel 默认不得执行高风险副作用。

### Q3. YAML and Untrusted Input

OWASP 将不安全反序列化列为风险；其 cheat sheet 对 YAML 等格式强调 safe constructors / allowlist。来源：<https://cheatsheetseries.owasp.org/cheatsheets/Deserialization_Cheat_Sheet.html>。

**对 SN 的约束**: `manifest.yaml` 是 workspace 输入，必须当作不可信配置处理：safe parse、zod/schema validation、禁止自定义 tag/object constructor、禁止 manifest 字段直接变成 executable command。

### Q4. Current v5 Baseline

当前实现已有：

- `src/connectors/base/contract.ts`: `CapabilityIntent`、`ChannelType`、`ConnectorRequest`、`ConnectorResult`、`ConnectorExecutor`。
- `src/connectors/base/manifest.ts`: zod manifest parser 与 `CapabilityContractRegistry`。
- `src/connectors/base/route-planner.ts`: credential/cooldown/channel selection 和 degraded side-effect guard。
- `src/connectors/services/connector-executor-adapter.ts`: 硬编码注册 Moltbook/EvoMap 的 runtime adapter。

**设计结论**: v6 应把硬编码 registry 替换为 built-in + dynamic registry merge，而不是绕过现有 route planner。

---

## 4. Options

| 方案 | 判定 | 理由 |
| --- | --- | --- |
| 继续 v5 硬编码 connector | 拒绝 | 无法支持社区/多平台并行接入 |
| manifest + 任意 adapter 自动执行 | 拒绝 | workspace 代码执行面过大 |
| declarative manifest 自动注册 + custom adapter pending trust | 采纳 | 生态可扩展，同时不越过安全边界 |

---

## 5. Action Recommendations

| 行动 | 设计承接 |
| --- | --- |
| 定义 `DynamicConnectorRegistry.scan()` / `reload()` / `registerBuiltIn()` | `connector-system.md` §5 |
| 定义 manifest schema 和 trust status | `connector-system.md` §6 |
| 对 `platformId:capability` 做 namespace route parsing | `connector-system.md` §5 |
| 默认 fail-closed 处理冲突与 invalid manifest | `connector-system.md` §4, §5 |
| 将 v5 built-in connector 迁移为 manifest parity fixtures | `connector-system.md` §11 |

---

## 6. Limits & Open Questions

| 项 | 状态 |
| --- | --- |
| 文件监控热重载 | P1；P0 使用显式 `connector reload` |
| custom adapter 签名格式 | P1/P2；P0 支持 owner allowlist |
| 15+ 真实平台接入 | 不作为 v6 P0；P0 验证机制和 1-3 个代表平台 |

---

## 7. Sources

- Airbyte Docs, accessed 2026-05-15: <https://docs.airbyte.com/>
- Airbyte Blog, "How We Test Airbyte and Marketplace Connectors": <https://airbyte.com/blog/how-we-test-airbyte-and-marketplace-connectors>
- Stripe API Docs, "Idempotent requests": <https://docs.stripe.com/api/idempotent_requests>
- AWS Builders Library, "Timeouts, retries, and backoff with jitter": <https://aws.amazon.com/builders-library/timeouts-retries-and-backoff-with-jitter/>
- OWASP Deserialization Cheat Sheet: <https://cheatsheetseries.owasp.org/cheatsheets/Deserialization_Cheat_Sheet.html>
- `.anws/v6/03_ADR/ADR_002_CONNECTOR_ECOSYSTEM.md`
- `.anws/v6/07_CHALLENGE_REPORT.md`
- `src/connectors/base/contract.ts`
- `src/connectors/base/manifest.ts`
- `src/connectors/base/route-planner.ts`
- `src/connectors/services/connector-executor-adapter.ts`
