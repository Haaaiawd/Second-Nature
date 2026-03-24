# state-system 调研摘要

**日期**: 2026-03-23
**来源工作流**: `/explore`
**系统**: `state-system`

---

## 1. 核心结论

- `state-system` 不应再被定义为“通用持久化层 + 长期记忆表”，而应升级成 **本地优先、分层治理、可审计的 memory substrate**。
- 最稳的模式是 **文件为记忆资产真相源，SQLite 为索引/事务/检索面**。
- OpenClaw 的 compaction/pruning 属于短期上下文管理；Second Nature 的 Quiet curation 属于长期 continuity/identity 管理，两者必须严格分层。
- Anchor / constitutional memory 必须默认只读，所有修改走 `proposed-write -> policy/apply -> audit` 受控流程。
- 外部 memory 插件（如 mem0）适合作为输入源和检索增强，不适合作为 canonical self memory store。

## 2. 推荐分层

- `Layer 0 - Runtime / thread state`: OpenClaw session、workspace context、compaction/pruning
- `Layer 1 - Daily journals / append-only logs`: 当天观察、动作、候选事实
- `Layer 2 - Curated memory`: 稳定偏好、长期约束、关系状态、项目线索
- `Layer 3 - Anchor / constitutional memory`: `IDENTITY.md`, `USER.md`, `SOUL.md`, `MEMORY.md` 中的核心原则与身份边界

## 3. 推荐职责边界

- **OpenClaw compaction/pruning**: 为 token/window 服务，优化当前会话连贯性
- **Second Nature memory curation**: 为 continuity/identity 服务，输出 curated facts、episodic summaries、candidate identity deltas

## 4. SQLite + filesystem hybrid

- 文件系统存：人可读且需长期审阅的资产，如 `IDENTITY.md`、`USER.md`、`SOUL.md`、daily journals、nightly reflections、proposal files
- SQLite 存：索引、元数据、反向引用、去重键、全文检索索引、事务性状态、迁移版本、审计事件
- 写入流程建议：`先生成文件临时稿 -> 原子落盘 -> 再写 SQLite 索引/审计记录`
- 恢复策略：启动时做 asset scan + hash 校验 + orphan index repair

## 5. Memory write governance

- 核心原则：
  - 能提议，不等于能生效
  - 能生效，不等于能覆盖历史
  - 每次写入都必须能解释：为什么写、基于什么证据、改了什么
- Anchor memory 建议机制：
  - 普通流程只能生成 `proposed write`
  - proposal 必须带 `target_asset`, `proposed_diff`, `reason`, `supporting_sources`, `confidence`, `policy_basis`, `risk_flags`
  - 只有 policy engine 或 owner review 通过后才能 apply

## 6. Narrative Reflection 的治理建议

- 白天：理性记录，保真、低推断
- 夜间：做 `episodic summary`、`stable fact candidates`、`identity delta proposals`、`garbage candidates`
- 每晚有硬预算：最多新增有限条 curated memories 和 proposal，避免膨胀

## 7. 应避免的反模式

- 把完整聊天历史直接当长期记忆存档
- 用一个持续膨胀的 `MEMORY.md` 承载所有东西
- 让模型在热路径里高频改写 identity / soul / user model
- 把 compaction summary 当长期记忆直接沉淀
- 把外部 memory 插件当 canonical store
- 只存总结，不存来源链

## 8. 参考资料

- `https://docs.langchain.com/oss/python/concepts/memory`
- `https://docs.langchain.com/oss/python/langgraph/memory`
- `https://www.anthropic.com/engineering/building-effective-agents`
- `https://www.sqlite.org/wal.html`
- `https://www.sqlite.org/backup.html`
- `https://modelcontextprotocol.io/introduction`
- `https://mem0.ai`
