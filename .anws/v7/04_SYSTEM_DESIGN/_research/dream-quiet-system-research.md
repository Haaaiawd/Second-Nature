# dream-quiet-system Research

**System**: `dream-quiet-system`
**Date**: 2026-05-21
**Purpose**: 支撑 Dream/Quiet pipeline 设计中的 memory consolidation、source-backed claims、reflection pattern 和 accepted projection lifecycle 的外部证据与设计参考。

---

## 1. Claude Auto-Dream: Memory Consolidation Architecture

**来源**: claude-wiki.com/auto-dream.html, claude-wiki.com/memory-design.html, HFurther/claude-code-stable

### 核心发现

Claude Code 的 Auto-Dream 是当前最成熟的 LLM agent memory consolidation 参考实现：

- **四阶段管道**: Orient (读取现有 memory 目录) -> Gather (针对性搜索 session transcripts) -> Consolidate (去重、合并、时间锚定) -> Prune (删除过时、矛盾的记忆)。
- **五门触发**: feature toggle -> 24h 时间门 -> 10min 扫描节流 -> 5 session 累积门 -> 文件系统锁。
- **Fire-and-forget**: Dream 作为 forked sub-agent 在后台运行，不阻塞主会话。
- **只读代码访问**: Dream sub-agent 不能修改代码或 memory 以外的文件。
- **Grep-first**: 不全量读取 transcripts，而是针对性搜索 user corrections、explicit saves、recurring themes、architecture decisions。

### 对本系统的启发

| Claude Auto-Dream | Second Nature dream-quiet-system | 差异 |
| --- | --- | --- |
| Session transcripts 作为输入 | life evidence refs + ToolExperience + SessionChronicle + RelationshipMemory | 更丰富的 embodied 输入 |
| 4 阶段管道 | Quiet (evidence -> claims -> diary) + Dream (claims -> insights -> projections) | 分为两个显式阶段 |
| 直接写入 memory 文件 | candidate -> validation -> accepted/archived lifecycle | 更严格的 acceptance gate |
| 无 source grounding 要求 | 每条 claim 必须 source-backed | 防 hallucination 核心护栏 |
| 锁机制防并发 | DreamRunLock with TTL | 类似 |

### 采纳与舍弃

- **采纳**: 后台异步执行、不阻塞心跳、锁机制、去重/合并逻辑、时间锚定。
- **舍弃**: Claude 没有 candidate/accepted 分离，我们需要更严格的 lifecycle；Claude 没有 source grounding validation。

---

## 2. Source-Grounded Memory: projmem 和 GroundMemory

**来源**: m4ll0k/projmem (GitHub), huss-mo/GroundMemory (GitHub)

### 核心发现

**projmem** 的核心理念是"存储 claims 而不是 text，每次读取时重新验证"：
- 每个保存的 belief 是结构化的、机器可检查的 claim。
- 每次读取时自动重新验证 claim 是否仍然成立。
- `contradicted` flag 作为硬 STOP 信号。
- 解决的问题：跨 session 遗忘、笔记悄悄过时、没有阻断信号。

**GroundMemory** 提供分层记忆架构：
- MEMORY.md (长期事实) / USER.md (用户画像) / AGENTS.md (行为指令)
- 每个 session 启动时 bootstrap 加载持久化事实。
- 跨工具共享同一个记忆工作空间。

### 对本系统的启发

- **QuietClaim** 的设计可以直接借鉴 projmem 的 structured claim + re-validation 模式。
- **source_refs** 作为 claim 的必备字段与 projmem 的 `defined-at` 结构化定位类似。
- **accepted projection lifecycle** 中 rejected claims 的归档不销毁策略与 projmem 的 `REFUTED` 标记理念一致。

---

## 3. Agent Reflection & Self-Reflection Patterns

**来源**: arxiv.org/html/2405.10467v1 (Agent Design Pattern Catalogue), AutoGen Reflection, agent-patterns.readthedocs.io

### 核心发现

学术界和工程界对 agent reflection 有三种主流模式：

1. **Self-Reflection**: agent 对自身输出生成 critique 并 refine。
2. **Cross-Reflection**: 另一个 agent 或外部系统提供反馈。
3. **Reflexion** (Shinn et al.): 跨 trial 的持久化 reflection memory，verbal reinforcement learning。

关键特征：
- Reflection 是 post-acceptance 的学习步骤，不是质量门。
- Reflexion 的 persistent memory 跨运行累积 insight。
- 所有模式都强调 iterative improvement，但 Second Nature 的 Quiet/Dream 不是 retry loop，而是 daily consolidation。

### 对本系统的启发

- Quiet 不是 retry/refine 循环，而是 daily reflection + source-backed claim 生成。
- Dream 更接近 Reflexion 的跨 trial insight 累积，但有 candidate/accepted gate。
- 我们的 DailyDiary 是 reflection 的自然语言产物，不是 critique。

---

## 4. Prospection-Guided Retrieval (PGR)

**来源**: arxiv.org/pdf/2605.14177

### 核心发现

PGR 将记忆检索从"回顾性查找"转变为"前瞻性模拟"：
- 给定查询，先展开为 plausible next steps 的树。
- 用模拟的未来状态作为检索 cue，唤起相关但语义距离远的记忆。
- PGR 是 retrieval policy，不是 storage mechanism；正交于底层记忆表示。

### 对本系统的启发

- Dream 的 projection generation 与 PGR 的"模拟未来"有概念相似性。
- 但 Dream projection 是 candidate，不直接用于实时检索；它经过 acceptance gate 后才进入 EmbodiedContext。
- 未来可考虑 PGR 启发的检索策略来改进 Dream input sampling。

---

## 5. EgoMem: Lifelong Memory Agent

**来源**: arxiv.org/html/2509.11914

### 核心发现

EgoMem 为全双工多模态模型设计终身记忆：
- 三异步进程：检索、对话、记忆管理。
- 记忆管理进程自动检测对话边界并提取信息更新长期记忆。
- Fact-consistency scores > 87%。

### 对本系统的启发

- 异步记忆管理与 Dream 的异步管道设计一致。
- Quiet 的 evidence aggregation 类似 EgoMem 的自动信息提取。
- 但 EgoMem 没有 source grounding 约束或 candidate/accepted lifecycle。

---

## 6. 调研结论摘要

| 设计决策 | 支撑调研 |
| --- | --- |
| Quiet/Dream 分为两个显式阶段 | Claude Auto-Dream 单阶段不够；reflection 文献支持 generate + consolidate 分离 |
| source-backed claim 作为硬约束 | projmem 的 structured claim + re-validation; Claude Auto-Dream 没有此约束但产出质量无保证 |
| candidate/accepted lifecycle | Claude 直接写入 memory 无 gate；projmem 的 contradicted flag 提供了类似但更轻量的验证 |
| 后台异步执行 + 锁 | Claude Auto-Dream 五门触发 + filesystem lock; EgoMem 异步进程 |
| DailyDiary 自然语言输出 | reflection pattern 文献中的 verbal feedback；Claude 的 consolidation 输出也是自然语言 |
| Quiet 完成后自动触发 Dream | Claude 的 Auto-Dream 在 idle 时自动触发；本系统在 Quiet completion 后触发更精确 |
| redaction gate 在 model assist 前 | Claude 不做 redaction（因为是本地 transcripts）；但 Second Nature 可能向外部 LLM 发送，需要 redaction |
