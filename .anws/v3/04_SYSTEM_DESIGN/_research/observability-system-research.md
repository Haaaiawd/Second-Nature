# observability-system 调研摘要

**日期**: 2026-03-23
**来源工作流**: `/explore`
**系统**: `observability-system`

---

## 1. 核心结论

- `observability-system` 不应是“多打一层日志”，而应是 Second Nature 的 **解释与治理证据层**。
- 最推荐模式是：`decision ledger + correlated telemetry + governance audit`
- deny / defer / escalate 与 allow 一样重要，必须被正式记录。
- OpenTelemetry 适合作为相关性骨架，不适合作为全部审计真相源。
- local-first 最佳实践是双平面：运行观测平面可采样，治理审计平面 append-only、长期保真。

## 2. 推荐架构模式

- `Decision Ledger`
- `Correlated Telemetry Plane`
- `Governance Audit Plane`
- `Provenance Graph`
- `Sensitive-by-structure`

## 3. 建议吸收的设计点

- OPA Decision Logs：`decision_id`、masked/erased 字段、决策与 trace 关联
- OpenTelemetry：trace/span/event、span links、collector transform/filter
- Phoenix / Weave / OpenAI Agents SDK：agent run / tool call / guardrail / handoff 的高层 span 语义
- Kubernetes Audit：who / what / when / object / stage / outcome
- SQLite Session Extension：changeset / patchset / conflict / invert 的审计抽象

## 4. 应避免的反模式

- 只记录执行日志，不记录为什么未执行
- 审计与运行日志混在一个平面里
- 只保留最终结果，不保留 proposal/apply/diff/provenance
- 为解释性而保存过多敏感原文
- 让 Quiet / outreach 只留下开始/完成，不记录压制与中断原因

## 5. 对本系统的直接影响

- 必须定义一等实体：`DecisionRecord`, `ExecutionAttempt`, `RecoveryEvent`, `RiskEvent`, `ProvenanceEdge`, `AnchorChangeAudit`, `QuietLifecycleEvent`, `OutreachDecision`
- connector failure taxonomy、retry、verification、cooldown 都应被领域化建模
- state-system proposal/apply/diff 必须在 observability 中有治理证据链
- 需要 `redaction_manifest`, `sensitivity_level`, `content_ref`, `explanation_capsule`

## 6. 参考资料

- `https://www.openpolicyagent.org/docs/latest/management-decision-logs/`
- `https://opentelemetry.io/docs/concepts/signals/traces/`
- `https://opentelemetry.io/docs/specs/otel/trace/api/`
- `https://opentelemetry.io/docs/collector/transforming-telemetry/`
- `https://opentelemetry.io/docs/specs/semconv/gen-ai/`
- `https://openai.github.io/openai-agents-python/tracing/`
- `https://arize.com/docs/phoenix/tracing/llm-traces`
- `https://weave-docs.wandb.ai/guides/tracking/tracing`
- `https://kubernetes.io/docs/tasks/debug/debug-cluster/audit/`
- `https://learn.microsoft.com/en-us/azure/architecture/patterns/retry`
- `https://sqlite.org/sessionintro.html`
