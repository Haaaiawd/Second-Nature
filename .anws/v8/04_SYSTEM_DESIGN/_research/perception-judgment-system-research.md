# perception-judgment-system Research

## 1. 问题与范围

| 子问题 | 方向 | 预期产出 |
| --- | --- | --- |
| Evidence 如何变成 agent-readable perception？ | 混合 | 定义 `EvidenceItem -> PerceptionCard` 的最小语义契约。 |
| Judgment 如何保持 agent-authored 但可降级？ | 混合 | 定义 `JudgmentVerdict` 的输入、输出、降级和安全边界。 |
| public technical 与 credential-shaped risk 如何分开？ | 向内 + 本地证据 | 定义 sensitivity/risk flags 的上下文规则。 |

不包含：connector payload 解析实现、外部动作执行、长期记忆写入。

## 2. 核心洞察

1. v8 的语义断点不是 evidence 不存在，而是没有强制转换为 `PerceptionCard` 与 `JudgmentVerdict`。
2. Judgment 必须读取 source refs、goals、accepted memory projection 与 affordance，但不得把 affordance 当成“该不该做”的答案。
3. 安全分类应把普通安全术语作为 public technical vocabulary 处理，只有 value-like secret shape 才升级敏感。

## 3. 详细发现

### Evidence 到 Perception

`.anws/v8/01_PRD.md` [REQ-002] 要求 perception 输出 topic、entities、novelty、relevance、summary、risk flags 和 source refs；`.anws/v8/concept_model.json` 将 `PerceptionCard` 定义为 Nyx 可阅读的语义对象。因此 L0 设计应把 perception 作为 bounded transformation，而不是 connector summary 的别名。

### Agent Judgment

`.anws/v8/01_PRD.md` [REQ-003] 要求 Nyx 基于 perception 自行判断下一步；`.anws/v8/02_ARCHITECTURE_OVERVIEW.md` 明确 control-plane 不做语义判断。因此本系统输出 `JudgmentVerdict`，control-plane 只编排它。

### Sensitivity 分类

`.anws/v8/00_DEEPWIKI_MECHANISM_AUDIT.md` §3 指出现有 Dream redaction 与 state write validation 容易被混淆；v8 需要区分 domain vocabulary 与 credential-shaped secrets。该规则属于 perception risk flags，最终存储/LLM redaction 仍由 state/observability 边界承接。

## 4. 创意/方案表

| 方案 | 判定 | 理由 |
| --- | --- | --- |
| 直接让 LLM 读 raw evidence 并判断 | 拒绝 | 违反 source-backed、redaction 和可降级要求。 |
| Rules-first perception + optional ModelAssistPort | 采纳 | model 不可用时仍能输出 `perception_rules_only`。 |
| 每个平台单独 judgment | 拒绝 | 违反 ADR-004 的 platform-neutral autonomy。 |

## 5. 行动建议

- L0 文档应把 `PerceptionCard` 和 `JudgmentVerdict` 作为两个明确输出，并声明低置信 judgment 不得产生 external write action。
- L0 文档应定义 `public_technical`、`credential_shape_detected`、`sensitive_blocked` 等 risk flags 的责任边界。

## 6. 局限与待探

无阻塞缺口；具体 scoring 阈值留给 `/blueprint` 拆任务时按 fixture 校准。

## 7. 参考来源

- `.anws/v8/01_PRD.md` [REQ-001], [REQ-002], [REQ-003], [REQ-007]
- `.anws/v8/02_ARCHITECTURE_OVERVIEW.md` System 3
- `.anws/v8/concept_model.json`
- `.anws/v8/00_DEEPWIKI_MECHANISM_AUDIT.md` §3, §4.2, §6
- `.anws/v8/03_ADR/ADR_002_LIVING_PERCEPTION_LOOP.md`
- `.anws/v8/03_ADR/ADR_004_PLATFORM_NEUTRAL_AUTONOMY_POLICY.md`

Skill harvesting 未使用；本轮依据 v8 本地 genesis 产物与机制审计收敛。
