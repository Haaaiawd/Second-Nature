# Dream System Research

**System ID**: `dream-system`  
**Target**: `.anws/v6`  
**Date**: 2026-05-15  
**Scope**: Evidence-backed asynchronous memory consolidation for Second Nature v6.

---

## 1. Problem & Scope

| 子问题 | 方向 | 预期产出 |
| --- | --- | --- |
| Claude Dreams 机制哪些原则可借鉴？ | 向外 | 异步、输入输出分离、review-before-accept 的约束 |
| SN Dream 与 v5 Quiet 的职责边界如何切开？ | 混合 | 从 report writer 演进为 candidate memory output 的边界 |
| Dream 如何失败而不污染 active memory？ | 混合 | candidate/accepted/archived/partial 生命周期 |
| Dream 的成本、超时、脱敏如何落到设计？ | 向外 | budget、operator timeout、redaction gate |

**范围内**: Dream pipeline、sampling、redaction、LLM fallback、output lifecycle、trace contract。  
**范围外**: 具体 LLM prompt 文案、state-system 完整 schema、CLI 命令实现。

---

## 2. Core Insights

1. Claude Dreams 的关键不是“用 LLM 重写记忆”，而是异步 job 读取既有 memory 与 sessions 后产出独立 output store，输入不被修改。
2. SN Dream 必须把 output store 设为 `candidate`，否则 LLM 幻觉或错误合并会污染长期 memory。
3. v5 Quiet 可作为 source-backed artifact 基线保留，但 Dream 的验收对象必须升级为 MemoryStore、Insight、NarrativeUpdate 和 RelationshipUpdate。
4. 完整 LLM Dream 不应承诺 5 分钟 P95；规则/采样阶段可设本地性能目标，LLM 阶段按 async job + operator timeout 管。
5. LLM 不可用不是失败终点，Dream 应降级为 rules-only consolidation 并写 trace。

---

## 3. Detailed Findings

### Q1. Claude Dreams 机制

Anthropic 官方 Dreams 文档将 dreaming 定义为 Research Preview；它读取一个 existing memory store 与 1-100 个 past sessions，产出独立的新 memory store，输入 store 不被修改，运行是异步 job，耗时随输入规模从分钟到数十分钟级。来源：<https://platform.claude.com/docs/en/managed-agents/dreams>（2026-05-15 检索）。

Anthropic 2026-05-06 博客进一步说明 dreaming 是 scheduled process，可自动更新 memory，也可先由开发者 review 再落地。来源：<https://claude.com/blog/new-in-claude-managed-agents>。

**对 SN 的约束**: SN 不直接依赖 Claude Managed Agents Dreams API；只借鉴机制原则：async、input/output separation、review-before-accept、memory curation。

### Q2. Quiet 到 Dream 的演进

当前代码基线中 `src/core/second-nature/quiet/run-source-backed-quiet.ts` 对空 evidence 返回 `quiet_empty_state`，对非空 evidence 写 source-backed Quiet artifact；它没有重构 MemoryStore、没有 insight lifecycle，也不更新 relationship memory。

**设计结论**: Dream 应保留 Quiet 的“无 evidence 不虚构”原则，但输出对象从 report artifact 变为 candidate MemoryStore。

### Q3. Output Lifecycle

ADR-004 已要求 input store 不被修改和 output store 分离；challenge 报告 CH-V6-03 指出缺少接纳生命周期会导致坏输出污染 active memory。

**设计结论**: `DreamOutputLifecycle` 必须包含 `candidate`、`accepted`、`archived`、`partial`；heartbeat 和 guidance 只能消费 accepted output 或 state-system 暴露的 accepted projections。

### Q4. Cost, Timeout, Redaction

PRD v6 规定月度 LLM 预算默认 $20，单次 Dream LLM 调用目标成本 <= $0.5；完整 LLM Dream 默认 operator timeout 30min；凭据、私信正文、PII 不得发送给 LLM。

**设计结论**: Dream pipeline 需要 `DreamBudgetPort`、`DreamModelPort`、`RedactionPort` 和 `DreamTracePort`，且 LLM 阶段前必须有 sensitivity gate。

---

## 4. Options

| 方案 | 判定 | 理由 |
| --- | --- | --- |
| 纯规则 consolidation | 备用降级 | 成本低、可测，但 insight/narrative 质量弱 |
| 纯 LLM 全量重写 | 拒绝 | 成本、token 上限、幻觉和隐私风险都太高 |
| 规则 + 采样 + 可选 LLM + 验证合并 | 采纳 | 能控制成本并保留洞察能力，符合 ADR-004 |

---

## 5. Action Recommendations

| 行动 | 设计承接 |
| --- | --- |
| 将 Dream 主路径定义为 async job，不阻塞 heartbeat | `dream-system.md` §4, §5 |
| 将 output store 初始状态设为 `candidate` | `dream-system.md` §5, §6 |
| LLM 不可用或超预算时 rules-only fallback | `dream-system.md` §5, §10 |
| DreamTrace 记录 input size、duration、cost、fallback reason | `dream-system.md` §5, §11 |
| Redaction 在 LLM 前执行，失败时 archive candidate | `dream-system.md` §9 |

---

## 6. Limits & Open Questions

| 项 | 状态 |
| --- | --- |
| LLM provider 具体 SDK | 不在 design-system 决策；由 `DreamModelPort` 隔离 |
| MemoryStore 物理表/文件格式 | 由 `state-system.md` 定义；Dream 只消费 port |
| Insight quality score | v6 P0 只要求 source grounding 与 schema validation，评分可 P1 |

---

## 7. Sources

- Anthropic Claude API Docs, "Dreams", accessed 2026-05-15: <https://platform.claude.com/docs/en/managed-agents/dreams>
- Anthropic Blog, "New in Claude Managed Agents: dreaming, outcomes, and multiagent orchestration", 2026-05-06: <https://claude.com/blog/new-in-claude-managed-agents>
- `.anws/v6/01_PRD.md`
- `.anws/v6/02_ARCHITECTURE_OVERVIEW.md`
- `.anws/v6/03_ADR/ADR_004_DREAM_MECHANISM.md`
- `.anws/v6/07_CHALLENGE_REPORT.md`
- `src/core/second-nature/quiet/run-source-backed-quiet.ts`
