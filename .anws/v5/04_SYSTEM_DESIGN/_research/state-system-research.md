# 探索报告: state-system v5 Life Evidence & Memory Substrate

**日期**: 2026-05-01  
**探索者**: GPT-5.5  
**系统**: `state-system`

---

## 1. 问题与范围

**核心问题**: `state-system` 如何在 Second Nature v5 中成为 life evidence、user interest snapshot、Quiet artifact、operator fallback 与 workspace memory 的本地可信来源，而不是退化成泛化“长期记忆表”？

**探索范围**:
- 包含: source-backed life evidence、平台/工作事件入库、用户兴趣快照、Quiet source coverage、daily journal/report、curated memory、anchor proposal、delivery fallback、SQLite/sql.js + filesystem hybrid、provenance graph。
- 不包含: control-plane 的决策算法、behavioral-guidance 的最终表达模板、connector 平台 API 细节、observability 的完整日志系统。

---

## 2. 核心洞察 (Key Insights)

1. **v5 的 state 真相源首先是 evidence，不是 memory**: `LifeEvidence` 是主动联系和 Quiet 的事实底座；`curated memory` 只是治理后的派生层，不能反过来替代原始 source refs。
2. **最稳的架构是 tiered memory + provenance pointers**: 外部 agent memory 实践都在强调 raw log / summary / belief 分层，并用 source pointers 支撑审计和回退。
3. **UserInterestSnapshot 必须是可解释快照，不是新 persona store**: 它从 `USER.md`、`MEMORY.md`、历史互动和 evidence 中提取信号，但每条兴趣必须保留 source refs、confidence 和 staleness。
4. **Quiet source coverage 是 admission gate**: Narrative Reflection 可以主观，但 claim 必须能追溯到 evidence；当天 evidence 为空时只能产出 empty-state / maintenance，不得虚构经历。
5. **SQLite/sql.js 适合作为索引和治理面，filesystem 适合作为可读 artifact 面**: WAL、atomic write、backup API、repair scan 是本地优先状态系统的关键运维实践。

---

## 3. 详细发现

### 3.1 Agent memory 最佳实践: 分层、可追溯、可回退

**探索方式**: Web 搜索 + 内部架构收敛。

**发现**:
- 新近 agent memory 研究强调将 raw experiences、summaries、observations/beliefs 分层，避免把推断和证据混在一起。
- Tiered memory 模式建议默认读低成本 summary；当证据不足时回退到 linked raw logs。
- 记忆单元需要 temporal metadata、entity links、provenance edges 和 revision history，才能回答“这个结论从哪来”。
- Hindsight 类实践强调 `world / experience / observation` 区分，observations 是 evidence-grounded consolidation，不是模型随口总结。

**来源**:
- `https://arxiv.org/html/2602.17913v1`
- `https://arxiv.org/pdf/2512.12818`
- `https://hindsight.vectorize.io/best-practices`

### 3.2 v5 local-first storage 的真实约束

**探索方式**: SQLite 官方文档与运维实践搜索。

**发现**:
- SQLite WAL 适合本地读多写少/小事务场景，能让读写并发更稳定。
- WAL 需要 checkpoint 策略，否则 WAL 文件可能膨胀。
- live backup 不应直接复制数据库文件；应使用 SQLite Backup API 或 `.backup` / `VACUUM INTO`。
- SQLite 没有内建权限模型，安全边界主要依赖文件系统权限和应用层加密/脱敏。

**来源**:
- `https://sqlite.org/wal.html`
- `https://openillumi.com/en/en-sqlite-safe-backup-method/`
- `https://dzx.fr/blog/understanding-sqlite/`

### 3.3 Second Nature v5 对 state-system 的新增硬契约

**探索方式**: PRD / ADR / control-plane / cli-system 对齐。

**发现**:
- [REQ-020] 要求平台浏览和工作推进都能写入 `LifeEvidence`，字段至少包括 timestamp、platformId/source、summary、sourceRefs、eventType。
- [REQ-023] 要求 `UserInterestSnapshot` 从 anchor files 和近期互动构建，缺失时必须降级为 evidence-only，不得编造喜好。
- [REQ-024] 要求 Quiet 能在非空 evidence 下生成 source-backed report/reflection，在空 evidence 下产出解释而非虚构。
- ADR-007 要求 delivery unavailable fallback 包含 reason、source refs、candidate message、下一步建议，且不得声称已联系用户。

**来源**:
- `../../01_PRD.md`
- `../../03_ADR/ADR_007_HEARTBEAT_DELIVERY_AND_LIFE_EVIDENCE_CLOSURE.md`
- `../control-plane-system.md`
- `../cli-system.md`

### 3.4 v2 state design 的可复用与必须替换部分

**探索方式**: 旧设计审查。

**可复用**:
- filesystem + SQLite hybrid
- Anchor Memory proposal/apply
- credential canonical store
- repair / backup / provenance

**必须替换**:
- 旧 [REQ-005]/[REQ-008] 追溯链已不适配 v5 PRD，必须改为 [REQ-020] 到 [REQ-024]。
- `daily_journal` 需要升级为 `LifeEvidence` 原始证据流，而不是泛 activity log。
- `generateDailyReport` 不能只依赖 reflection summary，必须计算 `sourceCoverage`。
- `UserInterestSnapshot` 与 `DeliveryFallback` 需要成为一等 read/write model。

---

## 4. 方案清单

| 方案 | 可行性 | 风险 | 推荐度 |
| --- | :---: | --- | :---: |
| A. Evidence-first tiered memory: raw LifeEvidence + derived snapshots + governed artifacts | 高 | schema/契约较重 | 推荐 |
| B. 继续 v2 memory substrate，只小补 LifeEvidence 字段 | 中 | 容易把 v5 关键闭环做成附录 | 不推荐 |
| C. 全 SQLite 存储所有 memory 和 report 正文 | 中 | 与 workspace memory 和人工审阅割裂 | 不推荐 |
| D. 外部 memory SaaS / plugin 作为 canonical store | 低 | 隐私、审计、离线与真相源复杂 | 不推荐 |

---

## 5. 行动建议

| 优先级 | 建议 | 理由 |
| :---: | --- | --- |
| P0 | 在 L0 操作契约中把 `appendLifeEvidence`、`loadLifeEvidenceSnapshot`、`loadUserInterestSnapshot`、`writeQuietArtifact`、`writeDeliveryFallback` 作为核心操作 | 这些是 v5 control-plane / guidance / cli 的直接依赖 |
| P0 | 将 `sourceRefs`、`sensitivity`、`confidence`、`staleness` 写入数据模型 | 防止 outreach 和 Quiet 编故事 |
| P0 | 明确 raw evidence、derived snapshot、curated memory、anchor proposal 四层关系 | 避免 memory / evidence / persona 混在一起 |
| P1 | 引入 `sourceCoverage` 作为 QuietArtifact admission / test 指标 | 对齐 REQ-024 与 ADR-007 |
| P1 | 保留 v2 的 proposal/apply、credential vault、repair/backup，但刷新为 v5 术语和接口 | 复用好设计，去掉旧需求编号 |

---

## 6. 局限性与待探索

- 本次只设计单用户、单 agent、本地优先的 schema 和接口，不做多设备同步。
- 未来若 evidence 规模扩大，可能需要全文索引或 embeddings，但首版不应引入外部搜索引擎。
- `UserInterestSnapshot` 的提炼质量依赖后续 behavioral-guidance / Quiet pipeline，state-system 只负责存取和 provenance。
- SQLite/sql.js 在 OpenClaw packaged runtime 中的具体性能和文件权限仍需后续实现验证。

---

## 7. 参考来源

1. [From Lossy to Verified: A Provenance-Aware Tiered Memory for Agents](https://arxiv.org/html/2602.17913v1)
2. [Hindsight is 20/20: Building Agent Memory that Retains, Recalls, and Reflects](https://arxiv.org/pdf/2512.12818)
3. [Hindsight Best Practices](https://hindsight.vectorize.io/best-practices)
4. [SQLite Write-Ahead Logging](https://sqlite.org/wal.html)
5. [The Right Way to Backup SQLite](https://openillumi.com/en/en-sqlite-safe-backup-method/)
6. [Understanding SQLite](https://dzx.fr/blog/understanding-sqlite/)
7. `../../01_PRD.md`
8. `../../02_ARCHITECTURE_OVERVIEW.md`
9. `../../03_ADR/ADR_001_TECH_STACK.md`
10. `../../03_ADR/ADR_003_SECOND_NATURE_GOVERNANCE.md`
11. `../../03_ADR/ADR_007_HEARTBEAT_DELIVERY_AND_LIFE_EVIDENCE_CLOSURE.md`
