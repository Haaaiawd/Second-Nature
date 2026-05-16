# 探索报告: behavioral-guidance-system v6 Narrative & Insight Guidance

**日期**: 2026-05-15  
**探索者**: GPT-5.5 / Nyx  
**系统**: `behavioral-guidance-system`

---

## 1. 问题与范围

**核心问题**: `behavioral-guidance-system` 如何在 v6 中从 source-backed outreach draft 扩展到 insight extraction、narrative update proposal 和 relationship-aware tone，同时仍然不拥有决策权、投递权或 canonical state 写入权。

**范围内**: LLM/model port 边界、evidence pack、insight candidate、narrative update proposal、relationship-aware outreach draft、unsupported claim 拦截、prompt/version 管理。  
**范围外**: heartbeat allow/deny、Dream memory lifecycle、state schema、observability ledger 实现、外部平台执行。

---

## 2. 核心洞察

1. **guidance 是 proposal 生产者，不是 state writer**: insight、narrative update、relationship update 都应作为 proposal 返回，由 Dream/control-plane/state lifecycle 决定是否接纳。
2. **LLM 输出必须 schema-first**: v6 引入 Dream 和 narrative 后，纯文本输出会很快失控；每个输出都需要 `sourceRefs`、`confidence`、`unsupportedClaims` 和 `redactionSummary`。
3. **relationship memory 影响语气，不改变事实**: tone/timing/topic 可以影响 draft 风格和冷却提示，但不能让 guidance 断言用户喜欢某事。
4. **prompt/version 是运维对象**: 任何 prompt template 变更都应有版本号，trace 中能回看输出来自哪个 prompt contract。
5. **模型不可用是正常降级路径**: insight extraction 可返回 rules-only / unavailable，不能让 heartbeat 或 Dream lifecycle 因软层失败而损坏状态。

---

## 3. 详细发现

### 3.1 v5 grounding 契约仍是 v6 的底线

v5 已定义 EvidencePack、InterestBasis、GroundingReport 和 `deliveryWording`。v6 只是扩大输出类型，不应放松 source-backed 约束。

**来源**: `.anws/v5/04_SYSTEM_DESIGN/behavioral-guidance-system.md`

### 3.2 Dream 需要的不是“更会写”，而是可接纳的结构化 proposal

Dream pipeline 需要 insight、narrative update 和 relationship update。guidance 可承担模型辅助提取，但输出必须可被 Dream/state 验证，失败时 archive 或降级。

**来源**: `dream-system.md`, `state-system.md`

### 3.3 Narrative Update Draft 的边界尤其危险

如果 guidance 直接说“我现在在追求 X”，控制面可能把它当事实消费。设计必须让 narrative update proposal 显式包含:
- `proposedFocus`
- `proposedProgress[]`
- `proposedNextIntent`
- `sourceRefs[]`
- `unsupportedClaims[]`
- `writeAuthority: "none"`

### 3.4 Prompt injection 面扩大了

v6 会把 platform evidence、chronicle、memory projection 和 relationship summary 放入模型上下文。所有外部内容必须作为 data，不得覆盖 system/developer policy；凭据、PII、私信正文默认不进 prompt。

---

## 4. 方案清单

| 方案 | 可行性 | 风险 | 推荐度 |
| --- | :---: | --- | :---: |
| A. Schema-first proposal generator + deterministic grounding gate | 高 | 接口较严格 | 推荐 |
| B. 复用 v5 outreach 文本生成函数做所有 v6 输出 | 中 | insight/narrative 结构缺失 | 不推荐 |
| C. Dream 直接调用供应商 SDK，绕过 guidance port | 中 | 预算、脱敏、prompt 版本分裂 | 不推荐 |
| D. guidance 直接写 NarrativeState | 低 | 软层越权 | 不推荐 |

---

## 5. 行动建议

| 优先级 | 建议 | 理由 |
| :---: | --- | --- |
| P0 | 增加 `extractInsightCandidates()`、`draftNarrativeUpdate()`、`draftRelationshipUpdate()` 操作契约 | 承接 REQ-001/002/003 |
| P0 | 所有 LLM 输出必须带 `GroundingReport` 和 `unsupportedClaims` | 防 narrative 幻觉 |
| P0 | 定义 `ModelAssistPort`，供应商、模型、密钥、预算均由配置注入 | 避免硬编码和测试不可控 |
| P0 | prompt template 带 `promptVersion`，写入 trace | 方便回归与审计 |
| P1 | relationship-aware tone 只影响 draft style，不改变 allow/deny | 保持 control-plane owner |

---

## 6. 局限性与待探索

- 本报告不选择具体模型；模型选择属于运行配置与后续实现评估。
- 朋友式语气质量仍需要 fixture/eval，不应在设计阶段用主观审美替代测试。
- 如果未来引入 prompt optimization 框架，应单独 ADR。

---

## 7. 参考来源

1. `.anws/v6/01_PRD.md`
2. `.anws/v6/03_ADR/ADR_001_TECH_STACK.md`
3. `.anws/v6/03_ADR/ADR_003_AGENT_SELF_LAYER.md`
4. `.anws/v6/03_ADR/ADR_004_DREAM_MECHANISM.md`
5. `.anws/v6/04_SYSTEM_DESIGN/dream-system.md`
6. `.anws/v6/04_SYSTEM_DESIGN/state-system.md`
7. `.anws/v5/04_SYSTEM_DESIGN/behavioral-guidance-system.md`

