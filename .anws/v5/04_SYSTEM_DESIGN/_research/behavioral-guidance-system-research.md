# 探索报告: behavioral-guidance-system v5 Source-backed Guidance Assembly

**日期**: 2026-05-01  
**探索者**: GPT-5.5  
**系统**: `behavioral-guidance-system`

---

## 1. 问题与范围

**核心问题**: `behavioral-guidance-system` 如何在 v5 中生成 source-backed、短句、自然、有来由的 friend-like outreach draft 和 Quiet / reply guidance，同时不拥有行动决策权、投递权或事实真相源？

**探索范围**:
- 包含: context assembly、evidence pack、persona snippet selection、friend-like outreach draft、Quiet narrative guidance、User Reply Scope light continuity、output guard、hallucination prevention、anti-alert-fatigue 表达边界。
- 不包含: outreach allow/deny 决策、delivery target 解析、memory truth 管理、connector 执行、observability 完整 event schema。

---

## 2. 核心洞察 (Key Insights)

1. **v5 guidance 的输入必须是 allow 后的工作集，不是全量记忆**: 最佳实践强调 context engineering，要把稳定政策、任务、约束、working set、evidence 分层打包。对 Second Nature 来说，guidance 只能接收 control-plane 允许后的 evidence refs、interest refs 和 scene context。
2. **朋友式表达要回答 “why now / why me / why this action”**: 主动消息如果没有即时价值和来由，就会变成噪声。draft 应短、自然、可行动，并能说明用户为什么可能关心。
3. **output guard 必须做成事实边界，不是话术库**: 外部 grounding 实践强调引用、claim verification 和“不知道就不要编”。guidance 应输出 `unsupportedClaims` / `guardViolations`，而不是自己补事实。
4. **persona reinforcement 是片段选择，不是 persona store**: 继续复用 `SOUL.md` / `USER.md` / `IDENTITY.md` / `MEMORY.md`，但每次只选少量片段；不得整份注入，更不得把 persona snippet 当 canonical truth。
5. **v3 四段式 payload 可保留，但要升级语义**: `atmosphere / impulses / persona_reinforcement / output_guard` 仍然好用；v5 需要新增 `evidencePack`、`interestBasis`、`draftContract`、`groundingReport`。

---

## 3. 详细发现

### 3.1 Context engineering 对 guidance assembly 的启发

**探索方式**: Web 搜索 + 本地 ADR 对齐。

**发现**:
- 可靠 LLM 系统倾向把 context 分层：stable role/policy、task goal、constraints/schema、working set、evidence、safety wrapper。
- 外部内容要被视作 data，不应被当成 instruction；这对平台内容、user interest snippets、tool output 都适用。
- 过大的 context 会造成 context rot；应优先选择 3-8 个高相关 chunk / evidence refs。
- schema validation 与 citation/source refs 是降低漂移的工程手段。

**来源**:
- `https://www.contextstudios.ai/blog/context-engineering-how-to-build-reliable-llm-systems-by-designing-the-context`
- `https://mbrenndoerfer.com/writing/rag-prompt-engineering-context-citations`
- `https://kingy.ai/blog/advanced-prompting-techniques-for-chatgpt-and-llms-a-full-stack-playbook-for-power-users-builders-and-agent-engineers/`

### 3.2 Proactive message / notification UX 对 friend-like draft 的启发

**探索方式**: Web 搜索。

**发现**:
- 主动通知必须有清晰的 alert-worthy threshold；低价值内容应进入 digest 或静默。
- 每条消息都应回答 why now、why me、why this action。
- 消息要 lead with value，避免先解释系统过程。
- 不同类型的消息 tone 不应一刀切：风险要冷静明确，朋友式分享可以有温度，但都必须可行动。

**来源**:
- `https://agentc2.ai/blog/build-proactive-ai-agent-notifications`
- `https://botgallery.com/how-to-design-bot-ux-for-scheduled-ai-actions-without-creati`
- `https://oneuptime.com/blog/post/2026-02-20-monitoring-alerting-best-practices/view`

### 3.3 Grounded generation / hallucination guard 对 output guard 的启发

**探索方式**: Web 搜索。

**发现**:
- 最有效的 hallucination prevention 是 grounding + strict scope：只能使用给定 context，不足时明确降级。
- 生产系统通常组合 RAG、citation verification、faithfulness checking、confidence scoring。
- 对 Second Nature 来说，draft 不是最终事实验证系统，但 guidance 可以在出稿前做本地 guard：所有 factual claim 必须被 `EvidencePack.sourceCoverage` / `SourceCoverageReport.usedSourceRefs` 或 `UserInterestSnapshot.sourceRefs` 支撑。
- citation hallucination 是真实风险，因此不能让 draft 编出不存在的 source；source refs 应由 state/control-plane 传入并原样引用。

**来源**:
- `https://toolhalla.ai/blog/ai-hallucination-guardrails-2026`
- `https://promptguardrails.com/blog/ai-hallucination-detection-prevention-guide`
- `https://www.lakera.ai/blog/guide-to-hallucinations-in-large-language-models`

### 3.4 v5 本地契约对 guidance 的硬约束

**探索方式**: PRD / ADR / 已完成系统设计对齐。

**发现**:
- PRD [REQ-022] 要求消息短、自然、有来由，且 source-backed。
- PRD [REQ-023] 要求用户兴趣不足时降低置信度或静默，不得编造用户喜好。
- PRD [REQ-024] 要求 Quiet / Narrative Reflection 的所有 claim 可追溯到 source refs。
- ADR-004 明确 guidance 不拥有决策权、投递权、事实真相源管理权。
- control-plane 已定义 `GuidanceDraftPort.draftOutreachMessage(request)`。
- state-system 已定义 `loadEvidenceRefs(refs)`、`UserInterestSnapshot` 和 persona source snippets 读取边界。

**来源**:
- `../../01_PRD.md`
- `../../03_ADR/ADR_004_BEHAVIORAL_GUIDANCE_LAYER.md`
- `../../03_ADR/ADR_007_HEARTBEAT_DELIVERY_AND_LIFE_EVIDENCE_CLOSURE.md`
- `../control-plane-system.md`
- `../state-system.md`

---

## 4. 方案清单

| 方案 | 可行性 | 风险 | 推荐度 |
| --- | :---: | --- | :---: |
| A. Source-backed guidance assembly: evidence pack + persona snippets + output guard + draft contract | 高 | 接口略重 | 推荐 |
| B. 保留 v3 四段式 payload，只补 outreach 文案模板 | 中 | v5 hard boundary 不够，容易编故事 | 不推荐 |
| C. 大型 prompt / full persona injection | 中 | context rot、隐私、人格漂移 | 不推荐 |
| D. skill-first “怎么回复/怎么发帖”教学库 | 低 | 违背 ADR-004，教学味重 | 不推荐 |

---

## 5. 行动建议

| 优先级 | 建议 | 理由 |
| :---: | --- | --- |
| P0 | 将 `draftOutreachMessage(request)` 设计为核心契约，输入必须包含 `judgmentRef`、`evidenceRefs`、`interestRefs`、`deliveryContext` | 直接承接 REQ-022 / ADR-007 |
| P0 | 所有 draft 输出带 `groundingReport`，列出 usedSourceRefs / unsupportedClaims / guardViolations | 防止 guidance 变成编故事层 |
| P0 | 明确 `GuidanceUnavailable` 与 minimal fallback，不因软层失败阻断 control-plane | 对齐 ADR-004 |
| P1 | 将 v3 四段式 payload 扩展为 `GuidancePayload + EvidencePack + DraftContract` | 保留好结构，升级 v5 语义 |
| P1 | 将 `User Reply Scope` 做成 very light continuity，禁止复用平台 `reply` scene | 对齐 ADR-005 |

---

## 6. 局限性与待探索

- 本次不定义最终 prompt 模板全文，只定义可实现的装配契约和 guard 规则。
- 朋友式语气的质量需要后续 fixture / eval；系统设计只能先锁住事实、边界和接口。
- `behavioral-guidance-system` 不直接运行 host smoke；delivery 是否可见仍由 `cli-system` / `control-plane-system` 负责。
- 如果未来需要更复杂的 prompt optimization / DSPy 类能力，应新开 ADR，不应悄悄塞进 guidance。

---

## 7. 参考来源

1. [Context Engineering: How to Build Reliable LLM Systems](https://www.contextstudios.ai/blog/context-engineering-how-to-build-reliable-llm-systems-by-designing-the-context)
2. [RAG Prompt Engineering: Context Placement & Citation Strategies](https://mbrenndoerfer.com/writing/rag-prompt-engineering-context-citations)
3. [Advanced Prompting Techniques for ChatGPT and LLMs](https://kingy.ai/blog/advanced-prompting-techniques-for-chatgpt-and-llms-a-full-stack-playbook-for-power-users-builders-and-agent-engineers/)
4. [Building AI Agents That Message You First](https://agentc2.ai/blog/build-proactive-ai-agent-notifications)
5. [Bot UX for Scheduled AI Actions Without Alert Fatigue](https://botgallery.com/how-to-design-bot-ux-for-scheduled-ai-actions-without-creati)
6. [Monitoring and Alerting Best Practices to Reduce Alert Fatigue](https://oneuptime.com/blog/post/2026-02-20-monitoring-alerting-best-practices/view)
7. [AI Hallucination Guardrails That Actually Work](https://toolhalla.ai/blog/ai-hallucination-guardrails-2026)
8. [AI Hallucination Detection and Prevention](https://promptguardrails.com/blog/ai-hallucination-detection-prevention-guide)
9. [LLM Hallucinations in 2026](https://www.lakera.ai/blog/guide-to-hallucinations-in-large-language-models)
10. `../../01_PRD.md`
11. `../../02_ARCHITECTURE_OVERVIEW.md`
12. `../../03_ADR/ADR_004_BEHAVIORAL_GUIDANCE_LAYER.md`
13. `../../03_ADR/ADR_007_HEARTBEAT_DELIVERY_AND_LIFE_EVIDENCE_CLOSURE.md`
