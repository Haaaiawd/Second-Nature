# ADR-004: Dream 异步记忆整理机制

## 状态
Accepted

## 日期
2026-05-15

## 背景
v5 的 Quiet 是"夜间批处理"——当天 evidence 写入 JSON artifacts，供 report/quiet 命令读取。但 Quiet 只是"回顾"，没有去重、洞察提取、记忆重构。用户明确要求"参考 Claude 的 dream 形式"，把 Quiet 改名为 Dream，升级为异步记忆整理引擎。

官方 Anthropic Dreams 文档（2026-05-15 核对）显示：Dreams 是 Managed Agents 的 research preview；输入是 pre-existing memory store + 1 到 100 个 past sessions；输出是独立 memory store；输入不被修改；运行通常按分钟到数十分钟计。SN v6 采用这些机制原则，不直接依赖 Claude Managed Agents Dreams API。

## 决策驱动因素
- 因素 1: 用户明确对标 Claude dreaming，要求"异步整理、输入输出分离、重写而非追加"
- 因素 2: SN 需要"理解" experience，而不只是记录 experience
- 因素 3: evidence 会积累重复、矛盾和过时条目，需要定期整理
- 因素 4: outreach 的"有来由"需要 Dream 提炼的 insights 和 narrative 更新
- 因素 5: 月度 LLM 预算 $20，Dream 的 LLM 调用必须可控

## 候选方案

### 方案 A: 纯规则去重 + LLM 洞察提取
- **描述**: Dream 先用规则引擎去重/合并，再用 LLM 提取洞察和更新 narrative。
- **优点**: 规则层处理大部分去重，LLM 只负责高价值洞察，成本可控
- **缺点**: 规则引擎维护成本、复杂模式无法被规则捕捉

### 方案 B: 纯 LLM 全量重写
- **描述**: 像 Claude dreaming 一样，把全部 evidence + chronicle + memory store 发给 LLM，让 LLM 产出全新的 reorganized store。
- **优点**: 最灵活、洞察质量最高
- **缺点**: 成本高（可能一次 Dream 就消耗 $1-2）、大证据量时 token 超限

### 方案 C: 混合模式（推荐）
- **描述**: 
  - **规则层**: 去重、合并重复条目、删除已显式 contradicted 的条目、转换相对时间为绝对时间
  - **采样层**: 大证据量时采样代表性子集（如最近 7 天 + 关键事件）
  - **LLM 层**: 只对采样后的子集调用 LLM，提取洞察、发现模式、更新 narrative
  - **输出**: 规则层产出 + LLM 层产出合并为新的 memory store
- **优点**: 成本可控、质量有保障、可降级（LLM 不可用时只做规则层）
- **缺点**: 需要 careful 合并逻辑

## 决策
选择 **方案 C: 混合模式**。

**核心原则**:
1. **输入输出分离**: Dream 读取 input store，产出 output store；input store 不被修改
2. **重写而非追加**: output store 是全新的 artifact，不是 input store 的 diff
3. **混合处理**: 规则层处理去重/合并/过时清理，LLM 层处理洞察/模式/narrative
4. **采样策略**: 证据量 > 1000 条时，采样最近 7 天 + 关键事件（outreach、owner reply、goal 里程碑）
5. **成本上限**: 默认月度 LLM 预算 $20，单次 Dream LLM 调用目标成本控制在 $0.5 以内；预算由配置覆盖，不硬编码
6. **降级路径**: LLM 不可用时，Dream 只做规则层整理，不提取洞察
7. **运行时现实边界**: 规则/采样阶段可设 P95 < 5min；完整 LLM Dream 是 async job，默认 operator timeout 30min，超时或失败时保留 partial output 并记录 trace
8. **输出接纳治理**: output store 生成后默认处于 `candidate` 状态；被 heartbeat 使用前必须通过 schema validation、source grounding validation、sensitivity redaction check；失败则 archive，不污染 active memory

**类比 Claude dreaming**:
- Claude dream 输入: session transcripts + memory store（官方为 1-100 sessions）
- SN Dream 输入: platform evidence + session chronicle + memory store + observability traces
- Claude dream 输出: reorganized memory store
- SN Dream 输出: reorganized memory store + insights + narrative update + relationship update

## 后果

### 正面
- evidence 质量持续提升，避免"垃圾进垃圾出"
- outreach 有 Dream 提炼的 insights 支撑，内容质量提升
- memory store 保持高信号，长期运行不退化
- 成本可控，规则层处理大部分工作

### 负面
- Dream 调度需要额外机制（定时 cron 或 evidence 积累阈值）
- LLM 洞察可能出现幻觉，需要验证和脱敏
- output store 与 input store 分离，需要管理 storage 增长
- 若 output store 自动替换 active memory，坏输出会放大为长期行为偏差；因此必须有 candidate/accept/archive 生命周期

### 需要的后续行动
- 在 `04_SYSTEM_DESIGN/dream-system.md` 中定义：
  - Dream pipeline 的完整流程（规则层 → 采样层 → LLM 层 → 合并层）
  - Session Chronicle schema（who/what/when/result/owner_reply）
  - MemoryStore schema（去重后的 canonical entries + insights + narrative + relationship）
  - Dream 调度策略（定时 vs 阈值触发）
  - LLM prompt 工程（insight extraction、narrative update、relationship update）
  - 成本控制和降级路径
  - output store candidate/accept/archive 生命周期与 partial output 清理策略

## 参考资料
- `https://platform.claude.com/docs/en/managed-agents/dreams`
- `https://claude.com/blog/new-in-claude-managed-agents`
- UC Berkeley Sleep-time Compute paper (arXiv:2504.13171)
- `.anws/v5/03_ADR/ADR_003_SECOND_NATURE_GOVERNANCE.md`

## 影响范围
- `dream-system` - 核心设计
- `state-system` - SessionChronicle、MemoryStore schema
- `control-plane-system` - Dream 触发指令、narrative 消费
- `behavioral-guidance-system` - insight extraction、narrative update draft
- `observability-system` - DreamTrace
- `cli-system` - `dream:recent` 命令
