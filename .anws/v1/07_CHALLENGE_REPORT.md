# Lobster Rhythm 质疑报告 (Challenge Report)

> 审查日期: 2026-03-22  
> 审查范围: .anws/v1 全部设计文档 + 三平台 Skill 文档外部验证  
> 累计轮次: 2

---

## 📋 问题总览

> 此目录随每轮审查同步维护。已解决轮次仅保留摘要，当前仅保留第 2 轮详细内容。

### 第一轮（2026-03-22，3/9 已修复）

| ID | 严重度 | 摘要 | 状态 |
|----|--------|------|------|
| H1-H3 | 🟠 | InStreet 挑战流、EvoMap 协议复杂度、自然互动可测性 | ⏳ 部分遗留 |
| H4-H5, M4 | ✅ | 凭据模型、会话模型、事件 taxonomy 结构已补齐 | ✅ 已修复 |
| M1-M3 | 🟡 | Contract 覆盖证明、LLM 失败策略、跨系统契约细化 | ⏳ 待收敛 |

### 第二轮（2026-03-22，6/6 已修复）

| ID | 严重度 | 摘要 | 状态 |
|----|--------|------|------|
| C1 | 🔴 | 验证挑战状态恢复链不闭合，可导致封禁级失败 | ✅ 已修复 |
| H1-H3 | 🟠 | 超时计算类型错误、A2A/REST 路由策略缺失、预算与社区义务冲突 | ✅ 已修复 |
| M1-M2 | 🟡 | 脱敏规则自相矛盾、任务审查前置条件缺失 | ✅ 已修复 |

---

## 🎯 审查方法论

本次审查模式: DESIGN

1. 设计审查 (design-reviewer 方法) — 已执行 — 从系统设计/运行模拟/工程实现三维度交叉审查
2. 任务审查 (task-reviewer) — 跳过 — 05_TASKS.md 不存在
3. Pre-Mortem — 已执行 — 基于 sequential-thinking 4 thought 倒推失败因果链
4. 合并评定 — 已执行 — 按证据强度 + 影响范围统一分级

---

## 🔥 第 2 轮详细审查（当前活跃）

### 📊 本轮问题统计

| 严重度 | 数量 | 占比 |
|--------|------|------|
| Critical | 1 | 16.7% |
| High | 3 | 50.0% |
| Medium | 2 | 33.3% |
| Low | 0 | 0% |
| Total | 6 | 100% |

| 维度 | 问题数 |
|------|--------|
| 设计审查 | 4 |
| 运行模拟 | 1 |
| 工程实现 | 1 |

---

## 🔴 Critical 级别

### C1. 验证挑战状态恢复链不闭合，存在不可逆封禁风险

严重度: Critical  
文档:  
- .anws/v1/04_SYSTEM_DESIGN/connector-system.detail.md:282  
- .anws/v1/04_SYSTEM_DESIGN/connector-system.detail.md:291  
- .anws/v1/04_SYSTEM_DESIGN/connector-system.detail.md:637  
- .anws/v1/04_SYSTEM_DESIGN/state-system.detail.md:106  
ADR 影响: ADR_002_CONNECTOR_MODEL.md（需要补充“验证态恢复”为 contract 必选能力）

问题描述:
- Connector 的验证流程依赖内存态 `pendingChallenge`，核心判断逻辑在 `verifyChallenge()` 中直接读取该内存对象。
- 同时文档又声明 AI 会话重启后“每次初始化从 state 读取最新状态”，且 state 已定义 `verificationDeadline` 可用于超时判定。
- 但 L1 未给出从持久化字段恢复 `pendingChallenge` 的明确算法或初始化路径，导致“重启后可恢复”仅为口头承诺。

证据来源:
- 代码级伪实现矛盾（同一系统文档内）
- 外部平台规则证据: InStreet 与 Moltbook 均要求验证挑战有严格时限与次数上限（来源: https://instreet.coze.site/skill.md, https://www.moltbook.com/skill.md，访问日期 2026-03-22）

影响:
- 注册后重启会丢失挑战上下文，可能反复注册、重复验证。
- InStreet 明确“最多 5 次，失败可导致永久封禁”，该缺陷可直接造成账号不可用。

如何验证:
1. 集成测试: 注册成功后立即重启进程。
2. 使用同一 `verification_code` 发起 `verifyChallenge()`。
3. 观察是否能从 state 重建验证态并继续提交答案。

建议:
1. 在 connector 初始化阶段强制执行 `rehydratePendingChallenge(platformId)`，从 state 恢复 challenge、deadline、attempts。
2. 将 `pendingChallenge` 变为持久化驱动状态机（内存仅缓存），避免双真相源。
3. 在 observability 增加 `verification_rehydrated` 事件便于回放。

---

## 🟠 High 级别

### H1. 验证超时时间计算存在类型错误，可能导致超时逻辑失效

严重度: High  
文档:  
- .anws/v1/04_SYSTEM_DESIGN/control-plane-system.detail.md:79  
- .anws/v1/04_SYSTEM_DESIGN/control-plane-system.detail.md:356

问题描述:
- 会话字段 `startTime` 定义为 `ISO8601String`，但超时逻辑直接执行 `Date.now() - session.startTime`。
- 该运算在工程实现中会依赖隐式类型转换，极易产生 `NaN` 或非预期值。

影响:
- `PENDING_VERIFICATION` 超时检查失真，可能永不超时或误超时。
- 直接影响状态机稳定性与用户体验。

如何验证:
1. 构造 `startTime = "2026-03-22T12:00:00Z"`。
2. 调用 `handleVerificationTimeout()`。
3. 断言 `elapsedMs` 为合法数值且与期望相符。

建议:
1. 显式转换: `const elapsedMs = Date.now() - new Date(session.startTime).getTime()`。
2. 为非法时间值添加 guard 与审计事件 `invalid_session_time`。

### H2. EvoMap 协议接入缺少 A2A/REST 路由策略，易出现系统性 4xx

严重度: High  
文档:  
- .anws/v1/04_SYSTEM_DESIGN/connector-system.detail.md（已定义 A2A envelope 构造，但未定义端点路由判定）

外部证据:
- EvoMap 文档同时存在“必须完整协议包”的 A2A 端点与“禁止协议包”的 REST 端点。
- 来源: https://evomap.ai/skill.md（访问日期 2026-03-22）

问题描述:
- 现有设计强调 envelope 构造，但没有端点级策略矩阵：何时必须 enveloped，何时必须 plain REST。
- 实现阶段很容易把 `/task/*`、`/a2a/heartbeat` 等 REST 端点误走 A2A 模式。

影响:
- 大量 `400/401/403` 失败，开发期调试成本飙升。
- 降低 connector 可维护性，且难以通过契约测试。

如何验证:
1. 建立 12 条端点契约测试（hello/fetch/publish/validate/task/heartbeat）。
2. 检查每条请求体是否符合协议形态。
3. 统计错误率与错误类型分布。

建议:
1. 增加 `EndpointMode` 枚举：`A2A_ENVELOPE_REQUIRED | REST_JSON_REQUIRED`。
2. 在 adapter 层实现“发送前 schema 守卫”，非法模式直接阻断。
3. 在 observability 记录 `endpoint_mode_mismatch`。

### H3. 预算约束与社区义务动作冲突，策略目标不可同时满足

严重度: High  
文档:  
- .anws/v1/01_PRD.md（单平台 5-15 次中频互动要求）
- .anws/v1/04_SYSTEM_DESIGN/control-plane-system.detail.md:470（会话内预算不实时检查）

外部证据:
- InStreet 心跳流程要求“优先回复你帖子上的新评论”且每 30 分钟节律执行。
- 来源: https://instreet.coze.site/skill.md（访问日期 2026-03-22）

问题描述:
- 产品目标既要求互动上限，又要求社区义务动作优先。
- 当前策略未定义“义务动作是否豁免预算”，也未定义冲突仲裁顺序。

影响:
- 可能出现两类失败: 预算守住但社区行为失真，或社区义务完成但预算超限。
- 验收标准可解释性下降，难以证明系统达标。

如何验证:
1. 回放高互动帖子场景（短时间产生大量回复通知）。
2. 对比两种策略: 严格预算 vs 义务优先。
3. 检查是否存在不违背任一约束的稳定策略。

建议:
1. 引入动作分层: `obligation | discretionary`。
2. 明确 `obligation` 的预算扣减规则（豁免或单独池）。
3. 在 PRD 与 control-plane 同步定义冲突仲裁优先级。

---

## 🟡 Medium 级别

### M1. Observability 脱敏规则前后矛盾，易造成过度脱敏或误判

严重度: Medium  
文档:  
- .anws/v1/04_SYSTEM_DESIGN/observability-system.detail.md:43  
- .anws/v1/04_SYSTEM_DESIGN/observability-system.detail.md:478

问题描述:
- 前段 `SENSITIVE_PATTERNS` 使用宽匹配（如 `/secret/i`），后段又给出“应使用精确匹配”的 `PRECISE_PATTERNS`。
- 两套策略没有统一优先级与落地说明。

影响:
- 过宽会误伤业务字段，降低排障可读性。
- 过窄会漏脱敏，带来隐私风险。

如何验证:
1. 用同一测试集跑两套规则。
2. 统计误杀率/漏检率。

建议:
1. 将 L1 统一为单一策略（建议精确匹配 + 审计白名单）。
2. 增加脱敏单测基线并在 CI 固化。

### M2. TASK 审查入口条件未满足，设计问题缺少任务化跟踪闭环

严重度: Medium  
文档:  
- .anws/v1 缺失 05_TASKS.md

问题描述:
- 当前处于 DESIGN 模式审查，发现多项高危问题，但仓库尚无任务清单承接。
- 按流程可继续审查，但整改路径不可追踪。

影响:
- 高风险问题可能停留在文档层，不进入执行面。

如何验证:
1. 检查是否存在任务项映射 C1/H1/H2/H3。
2. 若不存在，则判定闭环缺失。

建议:
1. 运行 /blueprint 生成 05_TASKS.md。
2. 为每个问题建立修复任务与验收标准。

---

## 📋 建议行动清单

### P0 - 立即处理 (阻塞)
1. C1 - 完成验证挑战状态恢复链设计与契约测试。

### P1 - 近期处理 (重要)
1. H1 - 修正超时计算类型错误并补齐时间字段校验。
2. H2 - 补充 EvoMap 端点模式矩阵与发送前守卫。
3. H3 - 定义预算与义务动作的冲突仲裁策略。

### P2 - 持续改进 (优化)
1. M1 - 统一脱敏规则并加入误判基准测试。
2. M2 - 生成任务清单并建立问题到任务映射。

---

## 🚦 最终判断

- [x] 🟢 项目可继续，风险可控
- [ ] 🟡 项目可继续，但需先解决 P0 问题
- [ ] 🔴 项目需要重新评估

判断依据:
- 架构方向正确，但存在 1 个可直接导致平台接入失败并伴随封禁后果的 Critical 风险。
- 其余 High 问题集中在时序正确性与策略闭环，属于高优先可修复问题。

---

## 📚 附录

### A. Pre-Mortem 分析

| 失败原因 | Root Cause | 证据 | 概率 | 对应问题 |
|---------|-----------|------|:----:|----------|
| 注册后无法激活账号 | 验证态未持久化恢复 | connector 内存态 `pendingChallenge` 与 state 恢复承诺不闭合 | 🔴高 | C1 |
| 接口联调长期 4xx | A2A/REST 模式混用 | EvoMap 同时要求“必须包裹”和“REST 禁包裹” | 🟡中 | H2 |
| 节律策略无法验收 | 预算上限与义务回复冲突 | PRD 中频互动要求 + InStreet 心跳义务流程 | 🟡中 | H3 |
| 验证超时随机异常 | 时间字段类型处理不严谨 | `Date.now() - ISO8601String` 计算风险 | 🟡中 | H1 |

### B. 技术健壮性审计

| 方面 | 当前设计 | 评估 | 问题 |
|------|---------|:----:|------|
| 事务处理 | 文档未明确跨表原子事务 | 🟡 | 状态迁移失败时回滚策略不清晰 |
| 重试机制 | connector 有重试，控制层未统一回放策略 | 🟡 | 失败可解释性不足 |
| 降级策略 | LLM 反思有 fallback | ✅ | 风险可控 |
| 超时处理 | 有超时配置，但存在类型计算缺陷 | ❌ | H1 |
| 并发控制 | 心跳并发有限制 | 🟡 | 高峰场景下探索与心跳争抢未量化 |
| 错误信息 | taxonomy 已扩展 | 🟡 | 脱敏规则仍不统一 |

### C. 假设验证结果

| 假设 | 验证方法 | 结果 | 状态 |
|------|---------|------|:----:|
| InStreet 验证流程可忽略重启场景 | 文档交叉验证 + 运行模拟 | 不成立，存在重启断链风险 | ❌ |
| EvoMap 可按统一请求形态接入 | 外部文档调研 | 不成立，A2A 与 REST 严格分轨 | ❌ |
| 预算规则与社区义务天然兼容 | PRD 与平台流程对照 | 未验证，且已发现冲突 | ⚠️ |
| LLM 失败会阻断系统 | 设计文档核查 | 已有降级策略 | ✅ |

### D. ADR 影响追踪

| ADR 文件 | 引用该 ADR 的 SYSTEM_DESIGN | 影响说明 |
|---------|---------------------------|---------|
| ../03_ADR/ADR_002_CONNECTOR_MODEL.md | connector-system.md, control-plane-system.md | 需补充“验证态恢复”“端点模式路由”为 connector contract 必选项 |

修改 ADR 后的行动:
1. 先更新 ADR_002 中 connector contract 的强制能力定义。
2. 回查 connector-system 与 control-plane-system 的引用章节并同步。
3. 将 C1/H2 对应能力映射进后续任务清单。
