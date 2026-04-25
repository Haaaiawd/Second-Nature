# connector-system 调研摘要

**日期**: 2026-03-23
**来源工作流**: `/explore`
**系统**: `connector-system`

---

## 1. 核心结论

- `connector-system` 不应是“平台 API 封装层”，而应是 **能力契约 + 执行路由 + 韧性治理 + 可观测性** 的统一层。
- 最关键的架构判断：统一的是 `operation intent + execution semantics`，不是每个平台的 endpoint 形状。
- 最危险的反模式是把 connector 写成 `if platform === X then call API else run CLI` 的流程脚本。

## 2. 推荐架构模式

- `Capability Contract`
- `Connector Manifest`
- `Execution Adapter Layer`
- `Route Planner`
- `Outcome Normalizer`
- `Policy Layer`

## 3. 可借鉴点

- Airbyte：spec/check/discover、manifest 化 connector authoring
- Temporal：声明式 retry policy、non-retryable failures
- Stripe：idempotency key 语义
- AWS Builders Library：backoff + jitter + single retry layer
- A2A / MCP：capability discovery、envelope / binding 边界
- OpenTelemetry：trace/log/event correlation

## 4. 应避免的反模式

- per-platform 巨类，把 auth/retry/parsing/business rules 全塞一起
- 让 CLI/skill fallback 与 API 看起来等价
- 以平台名称做主路由，而不是 capability + channel capability
- 用字符串匹配做错误分类
- side-effecting 操作无幂等上下文就自动重试

## 5. 对本系统的影响

- 应增加 capability taxonomy、channel taxonomy、failure taxonomy、credential state model、execution event schema
- execution channel 建议标准枚举：`api_rest`, `api_rpc`, `a2a`, `mcp`, `cli`, `skill`, `browser`
- 失败分类建议至少包括：`transport_failure`, `auth_failure`, `credential_expired`, `verification_required`, `rate_limited`, `cooldown_blocked`, `parse_failure`, `protocol_mismatch`, `semantic_rejection`, `idempotency_conflict`, `concurrency_conflict`, `permanent_input_error`, `unknown_platform_change`

## 6. 参考资料

- `https://docs.airbyte.com/platform/understanding-airbyte/airbyte-protocol`
- `https://docs.airbyte.com/platform/connector-development/connector-builder-ui/overview`
- `https://docs.temporal.io/encyclopedia/retry-policies`
- `https://aws.amazon.com/builders-library/timeouts-retries-and-backoff-with-jitter/`
- `https://docs.stripe.com/api/idempotent_requests`
- `https://raw.githubusercontent.com/google/A2A/main/README.md`
- `https://github.com/modelcontextprotocol/modelcontextprotocol/blob/main/README.md`
- `https://opentelemetry.io/docs/concepts/signals/traces/`
- `https://openai.github.io/openai-agents-python/`
- `https://auth0.com/docs/secure/tokens/token-best-practices`
