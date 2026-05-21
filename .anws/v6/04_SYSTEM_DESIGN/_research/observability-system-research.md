# Observability System Research

**System ID**: `observability-system`  
**Target**: `.anws/v6`  
**Date**: 2026-05-15  
**Scope**: v6 audit, trace, explain, and safety observability for Dream, narrative, connector inventory, and existing heartbeat/delivery/source coverage.

---

## 1. Problem & Scope

| 子问题 | 方向 | 预期产出 |
| --- | --- | --- |
| v6 新增 DreamTrace / NarrativeTrace 应如何接入 v5 audit ledger？ | 混合 | 事件族、字段、query owner |
| agent/LLM 相关 telemetry 能否借鉴 OpenTelemetry？ | 向外 | OTel-compatible projection，但本地 ledger 为真源 |
| 敏感输入、prompt、模型输出如何不落审计原文？ | 向外 | redaction manifest、content refs、opt-in full content |
| connector inventory 与 connector attempt 如何分列？ | 混合 | inventory snapshot vs execution telemetry |

**范围内**: audit event families、DreamTrace、NarrativeTrace、connector inventory audit、redaction、explain read model、hash-chain integrity。  
**范围外**: 外部 APM 部署、完整 OTel exporter、dashboard UI。

---

## 2. Core Insights

1. v6 observability 的核心不是“更多日志”，而是能解释 Dream、narrative、goal、connector 为什么被接受、拒绝、降级或静默。
2. OpenTelemetry GenAI conventions 适合做 projection 字段语言，但其 GenAI 规范仍处 Development，不能当本地审计真相源。
3. OTel 明确不应默认捕获 instruction/input/output 原文，这与 SN 的 source ref + redaction manifest 策略一致。
4. OPA decision logs 的 mask/erase 思路适合 SN：敏感字段可被移除或替换，同时记录被处理的 JSON Pointer。
5. Connector inventory 是注册状态，connector attempt 是执行遥测；混在一起会让 `connector:status` 变成不可信。

---

## 3. Detailed Findings

### Q1. OpenTelemetry GenAI / Agent conventions

OpenTelemetry GenAI semantic conventions 目前标为 Development，并覆盖 events、exceptions、metrics、model spans、agent spans；agent spans 使用 `invoke_agent` / `invoke_workflow` 等 operation name。来源：<https://opentelemetry.io/docs/specs/semconv/gen-ai/> 与 <https://opentelemetry.io/docs/specs/semconv/gen-ai/gen-ai-agent-spans/>（2026-05-15 检索）。

**设计结论**: observability-system 可以输出 OTel-compatible projection，但本地 audit ledger 仍是 truth source。

### Q2. Prompt / model content capture

OpenTelemetry GenAI span 文档指出 model instructions、user messages、model outputs 通常敏感且体积大，instrumentation 默认不应捕获；生产环境更适合把内容存外部并在 span 上记录引用。来源：<https://opentelemetry.io/docs/specs/semconv/gen-ai/gen-ai-spans/>。

**设计结论**: `DreamTrace` 和 `GuidanceGroundingAudit` 默认只记录 hash/contentRef/sourceRefs，不保存完整 prompt、私信正文或模型输出原文。

### Q3. Decision log redaction

OPA decision logs 支持 masking sensitive data；mask policy 返回 JSON Pointer，日志中会记录 erased paths。来源：<https://www.openpolicyagent.org/docs/management-decision-logs>。

**设计结论**: `RedactionManifest` 应记录 `maskedPaths`、`erasedPaths`、`hashedPaths`、`contentRefPaths`，explain 时直接告诉 operator 哪些字段被隐藏。

### Q4. v6 新增事件族

`dream-system.md` 要求 `DreamTrace` 记录 input size、duration、cost、fallback、lifecycle；`connector-system.md` 要求 inventory audit 记录 conflicts、validation errors、trust status；PRD v6 要求 `sn status` / `dream:recent` 展示人类可读状态。

**设计结论**: 新增 `dream.*`、`narrative.*`、`connector.inventory.*` 三类不采样审计；connector attempt 仍可按错误不采样、成功可摘要的 telemetry 策略处理。

---

## 4. Options

| 方案 | 判定 | 理由 |
| --- | --- | --- |
| OTel-only | 拒绝 | 离线 explain、redaction、retention 和产品语义不稳 |
| 本地 audit ledger + OTel projection | 采纳 | 保留本地真相源，同时给未来 exporter 留路 |
| 保存完整 prompt/model output | 拒绝 | 隐私、成本和泄漏面太大 |
| 保存 content ref + hash + redaction manifest | 采纳 | 可解释、可脱敏、可按权限解析 |
| connector inventory 和 attempt 共用一张事件 | 拒绝 | 注册失败与执行失败会混淆 |

---

## 5. Action Recommendations

| 行动 | 设计承接 |
| --- | --- |
| 定义 `recordDreamTrace()` 与 `DreamTrace` schema | `observability-system.md` §5, §6 |
| 定义 `recordNarrativeTrace()`，记录 narrative 变更与 unsupported claims | `observability-system.md` §5, §6 |
| 定义 `recordConnectorInventory()`，与 `recordConnectorAttempt()` 分离 | `observability-system.md` §5, §6 |
| 将 redaction manifest 作为所有 audit append 的共同 envelope | `observability-system.md` §5, §9 |
| `queryExplain()` 支持 decisionId、dreamRunId、narrativeId、platformId、fallbackRef | `observability-system.md` §5 |

---

## 6. Limits & Open Questions

| 项 | 状态 |
| --- | --- |
| OTLP exporter | P1/P2；v6 P0 只要求 projection model 不阻塞本地审计 |
| full content break-glass | 不进 P0；未来需 owner policy 和单独审计 |
| dashboard UI | 不进 observability-system P0；CLI/read model 先闭环 |
| external APM vendor | 非目标；本地 JSON audit bundle 足够 |

---

## 7. Sources

- `.anws/v6/01_PRD.md`
- `.anws/v6/02_ARCHITECTURE_OVERVIEW.md`
- `.anws/v6/04_SYSTEM_DESIGN/dream-system.md`
- `.anws/v6/04_SYSTEM_DESIGN/connector-system.md`
- `.anws/v5/04_SYSTEM_DESIGN/observability-system.md`
- OpenTelemetry, "Semantic conventions for generative AI systems", accessed 2026-05-15: <https://opentelemetry.io/docs/specs/semconv/gen-ai/>
- OpenTelemetry, "Semantic Conventions for GenAI agent and framework spans", accessed 2026-05-15: <https://opentelemetry.io/docs/specs/semconv/gen-ai/gen-ai-agent-spans/>
- OpenTelemetry, "Semantic conventions for generative client AI spans", accessed 2026-05-15: <https://opentelemetry.io/docs/specs/semconv/gen-ai/gen-ai-spans/>
- Open Policy Agent, "Decision Logs", accessed 2026-05-15: <https://www.openpolicyagent.org/docs/management-decision-logs>
- `src/observability/audit/append-only-audit-store.ts`
- `src/observability/query/explain-query.ts`
- `src/observability/services/runtime-decision-recorder.ts`
