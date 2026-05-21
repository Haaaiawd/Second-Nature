# Wave 39 Code Review — 2026-05-18

> 审查范围: Waves 36–39 (S5 Life Loop Activation) 全部变更
> 审查模式: 4 子代理并行 × 6 Lens 静态审查
> 子代理: A(L1+L2 契约忠实度&任务兑现), B(L3 架构适配&复杂度), C(L4+L5 静态风险&验证证据), D(L6 回流一致性&交接)

---

## 1. 总结结论

**Partial Pass** ⚠️

Waves 36–39 的核心闭环路径已完成编码与测试（真实 connector evidence → platform-specific intent → source-backed outreach → owner reply feedback → RelationshipMemory），但存在 **8 Critical + 8 High + 8 Medium + 7 Low** 共 31 条发现，需在交付 Claw 插件前修复。

**阻断交付的发现**: CR-06(barrel export 缺失), CR-07(README v5 标记), CR-08(版本号漂移) 直接影响外部用户的第一印象与宿主加载正确性，必须立即修复。

---

## 2. 审查范围与静态边界

### 已审代码
| 文件 | 波次 | 行数 | 审阅代理 |
|------|------|------|---------|
| `src/core/second-nature/heartbeat/heartbeat-loop.ts` | 36/37 | 477 | A, B, C |
| `src/core/second-nature/orchestrator/intent-planner.ts` | 37 | 292 | A, B, C |
| `src/core/second-nature/orchestrator/platform-capability-router.ts` | 37 | 135 | A, B, C, D |
| `src/cli/ops/workspace-heartbeat-runner.ts` | 36/37 | 191 | A, B, C |
| `src/core/second-nature/feedback/owner-reply-feedback.ts` | 39 | 174 | A, B, C, D |
| `tests/integration/connectors/t3-3-1-real-connector-evidence.test.ts` | 36 | 237 | A, C |
| `tests/integration/control-plane/t2-4-1-heartbeat-platform-intent.test.ts` | 37 | 200 | A, C |
| `tests/unit/control-plane/t2-4-1-platform-intent.test.ts` | 37 | 166 | A, C |
| `tests/integration/control-plane/t2-4-2-source-backed-outreach-loop.test.ts` | 38 | 217 | A |
| `tests/integration/state/t4-2-1-owner-reply-relationship-loop.test.ts` | 39 | 166 | A, B, C |

### 已审文档
- `.anws/v6/01_PRD.md`
- `.anws/v6/02_ARCHITECTURE_OVERVIEW.md`
- `.anws/v6/03_ADR/` (ADR-001 ~ ADR-007)
- `.anws/v6/04_SYSTEM_DESIGN/` (control-plane, state, behavioral-guidance, connector, observability, cli, dream)
- `.anws/v6/05A_TASKS.md`
- `.anws/v6/05B_VERIFICATION_PLAN.md`
- `AGENTS.md`
- `README.md` / `README.zh-CN.md`
- `plugin/openclaw.plugin.json`
- `plugin/index.ts`
- `package.json` / `plugin/package.json`

### 静态边界
- 纯代码静态分析，未执行任何测试或运行时验证
- 真实 connector adapter 代码（moltbook/evomap 内部实现）未审
- OpenClaw 宿主环境行为无法静态确认

---

## 3. 契约 → 代码映射摘要

| 核心承诺 | 实现区域 | 验证文件 | 映射状态 |
|---------|---------|---------|---------|
| T3.3.1 connector success → evidence artifact + index | `heartbeat-loop.ts:147-169` + `map-life-evidence.ts` | `t3-3-1-*.test.ts` | ✅ 完整 |
| T2.4.1 accepted goal → platformId:capability intent | `intent-planner.ts` + `platform-capability-router.ts` | `t2-4-1-*.test.ts` | ⚠️ 部分 |
| T2.4.2 evidence → outreach → delivery/fallback | `heartbeat-loop.ts` + `dispatch-user-outreach.ts` | `t2-4-2-*.test.ts` | ⚠️ 部分 |
| T4.2.1 owner reply → chronicle → RelationshipMemory | `owner-reply-feedback.ts` | `t4-2-1-*.test.ts` | ⚠️ 部分 |
| T1.4.2 goal criteria alias / explain relationship | `ops-router.ts` + `resolve-subject.ts` | `t1-4-2-*.test.ts` | ✅ 完整 |

---

## 4. Lens 结果摘要

| Lens | 结论 | 关键发现 |
|------|------|---------|
| L1 契约忠实度 | Pass | Evidence 真实性保证 ✅; sourceRefs 可追溯 ✅; KNOWN_PLATFORM_IDS 硬编码 ⚠️; acceptedBy 枚举未定义 ⚠️ |
| L2 任务兑现 | Pass | T3.3.1/T4.2.1 闭合 ✅; T2.4.2 sourceRefs 可能虚构 ⚠️; tone 推断关键词不足 ⚠️ |
| L3 架构适配 | Partial Pass | platformId router 与 Dynamic Registry 不一致 🔴; intent-planner 不读 narrative/relationship 🔴; 代码重复 ⚠️ |
| L4 静态运行风险 | Partial Pass | 核心错误路径安全 ✅; 空字符串无防御 🔴; PII 泄露风险 ⚠️; 歧义平台处理 ⚠️ |
| L5 验证证据 | Partial Pass | 集成测试完整 ✅; T4.2.1/T3.3.1 缺单元测试 🔴; 边界场景覆盖不足 ❌ |
| L6 回流一致性 | Partial Pass | AGENTS.md/05A_TASKS 准确 ✅; barrel export 缺失 🔴; README 版本过时 🔴; manifest 版本漂移 🔴 |

---

## 5. Issues

### 🔴 Critical

**CR-01 | L1+L3 | platformId 推断与 Dynamic Registry 模型不一致**
- **Evidence**: `src/core/second-nature/orchestrator/platform-capability-router.ts:20` 硬编码 `KNOWN_PLATFORM_IDS = ["moltbook", "instreet", "evomap"]`; `intent-planner.ts:54` 传入 registry 但 router 未使用
- **Impact**: v6 dynamic connector ecosystem 无法工作；新增平台无法被自动识别，与 ADR-002 §动态注册、connector-system.md §4.1 相悖
- **Minimum Fix**: 修改 `resolvePlatformForIntent` 接收 `CapabilityContractRegistry`，从 `registry.listConnectors()` 动态读取平台列表
- **Anchor**: ADR-002, connector-system.md §4.1, T2.4.1 验收标准 A

**CR-02 | L3 | intent-planner 不读 NarrativeState / RelationshipMemory**
- **Evidence**: `intent-planner.ts:222-266` 仅读 `acceptedGoals`，不传 narrative/relationship; `heartbeat-loop.ts:314-317` 调用时不传
- **Impact**: narrative focus 无法影响候选优先级；relationship 无法影响 outreach 时机；违反 control-plane-system.md §4.2 "self-aware planning"
- **Minimum Fix**: 扩展 `SnapshotInputs` 含 `narrativeState?` + `relationshipMemory?`；在 `workspace-heartbeat-runner.ts` 加载；在 planner 中使用调整优先级
- **Anchor**: control-plane-system.md §4.2, §5.1

**CR-03 | L4 | owner-reply-feedback.ts 缺少空字符串防御**
- **Evidence**: `src/core/second-nature/feedback/owner-reply-feedback.ts:108-110` 直接传入 `input.replyText` 到 `inferTone/inferTiming/inferTopics`，未检查 null/empty
- **Impact**: 空回复被静默忽略（tone → "unknown" → 使用 prior），无审计线索；无法区分"无回复"和"空回复"
- **Minimum Fix**: 添加显式空值检查，空回复时记录 `empty_reply` 到 chronicle
- **Anchor**: T4.2.1 / 05B_VERIFICATION_PLAN.md

**CR-04 | L5 | T4.2.1 推断函数缺少单元测试**
- **Evidence**: 无 `tests/unit/feedback/t4-2-1-*.test.ts`；`inferTone(""), inferTiming(""), inferTopics("")` 及冲突关键词场景均未测试
- **Impact**: 无法独立验证推断逻辑；边界场景无保障
- **Minimum Fix**: 创建 `tests/unit/feedback/t4-2-1-owner-reply-inference.test.ts`，覆盖空字符串、冲突关键词、超长文本
- **Anchor**: 05B_VERIFICATION_PLAN.md §T4.2.1

**CR-05 | L1+L4+L5 | platform-capability-router 歧义平台处理不明确**
- **Evidence**: `platform-capability-router.ts:120-131` 多候选时返回第一个，无歧义标记；验证计划要求 "ambiguous paths produce explicit denied reason"
- **Impact**: guard 层被迫拒绝，但 intent 本身无标记；测试未覆盖多候选场景
- **Minimum Fix**: 返回 `{ platformId?, ambiguous? }` 结构；guard 层对 `ambiguous=true` 显式拒绝
- **Anchor**: T2.4.1 / 05B_VERIFICATION_PLAN.md §410-415

**CR-06 | L6 | processOwnerReply 未通过 barrel export 暴露**
- **Evidence**: `src/core/second-nature/feedback/owner-reply-feedback.ts:98` 实现存在；`src/core/second-nature/index.ts` 无 feedback 导出
- **Impact**: 新开发者无法从公共 barrel 发现 API；测试使用深层路径导入，增加维护成本
- **Minimum Fix**: `src/core/second-nature/index.ts` 添加 `export * from "./feedback/owner-reply-feedback.js";`
- **Anchor**: 项目导出约定（所有公共 API 经 barrel 暴露）

**CR-07 | L6 | README.md 架构版本标记过时 (v5)**
- **Evidence**: `README.md:17` badge 仍为 `Architecture-v5`；AGENTS.md:84 已标记 `.anws/v6`
- **Impact**: 新用户误认为项目仍在 v5；交接信息混淆
- **Minimum Fix**: 更新 badge 为 `Architecture-v6`
- **Anchor**: README.md:17

**CR-08 | L6 | plugin manifest 与 package 版本号漂移**
- **Evidence**: `plugin/openclaw.plugin.json:4` → 0.1.23; `package.json:3` → 0.1.24; `plugin/package.json:3` → 0.1.25
- **Impact**: OpenClaw 宿主读取 manifest 版本与实际发布包不一致；升级路径混乱
- **Minimum Fix**: 统一三个文件版本号为 0.1.25（或当前最新）
- **Anchor**: plugin/openclaw.plugin.json:4

---

### 🟠 High

**H-01 | L2 | outreach sourceRefs 可能基于虚构 count**
- **Evidence**: `intent-planner.ts:32-39` evidenceRefs 为空时返回 `life-evidence-summary` URI；`heartbeat-loop.ts:97-106` 传递至 outreach
- **Impact**: outreach draft 可能基于"有 3 条事件"而非真实 evidence，违反 T2.4.2 "evidence-backed"承诺
- **Minimum Fix**: evidenceRefs 为空时 sourceRefs 置空，guard 层拒绝 (insufficient_sources)
- **Anchor**: T2.4.2 验收标准 D, PRD US-005

**H-02 | L1 | goal priority acceptedBy 枚举未定义**
- **Evidence**: `goal-priority.ts:56` 检查 `"policy_allowlist"`，但 AgentGoal schema 中未见此枚举值
- **Impact**: agent-proposed goal 可能意外获得优先级，违反 T2.1.4 "proposal 不越权"
- **Minimum Fix**: `agent-goal-store.ts` 定义 `acceptedBy: "owner" | "policy_allowlist"` 枚举并验证
- **Anchor**: T2.1.4 验收标准 C, PRD US-002

**H-03 | L3 | goalInfluenceRefs 填充与 applyGoalPriority 返回结构不同步**
- **Evidence**: `intent-planner.ts:46-209` 所有 plan* 函数返回 `goalInfluenceRefs: []`；`goal-priority.ts:95-99` 在 applyGoalPriority 中填充
- **Impact**: 职责边界模糊；observability 无法记录 planner 阶段 goal 信息
- **Minimum Fix**: planner 预先填充 goalInfluenceRefs，或在 HeartbeatDecisionTracePayload 中记录
- **Anchor**: control-plane-system.md §4.2

**H-04 | L3 | owner-reply-feedback 双写无事务保证**
- **Evidence**: `owner-reply-feedback.ts:98-174` chronicle 写入与 relationship 更新为两个独立 store 操作
- **Impact**: relationship 更新失败时 chronicle 已写入，状态不一致；下次 heartbeat 看不到最新 reply
- **Minimum Fix**: 先验证 chronicle 写入成功再更新 relationship；失败时记录 observability 事件；返回 `relationshipUpdateError?`
- **Anchor**: state-system.md §4.3, control-plane-system.md §5.3

**H-05 | L3+L4 | acceptedGoals 加载错误处理不清晰**
- **Evidence**: `workspace-heartbeat-runner.ts:109-121` 失败时 `acceptedGoals = undefined`，无法区分"无 goal"和"加载失败"
- **Impact**: goal store 故障时无声降级；与 control-plane-system.md §5.3 "state_snapshot_unavailable → degraded" 不符
- **Minimum Fix**: `SnapshotInputs` 添加 `acceptedGoalsLoadError?`；区分两种状态；记录 observability
- **Anchor**: control-plane-system.md §5.3

**H-06 | L5 | t2-4-1-heartbeat 断言过弱**
- **Evidence**: `tests/integration/control-plane/t2-4-1-heartbeat-platform-intent.test.ts:75-78` 仅断言 `status === "intent_selected"`，未验证 platformId
- **Impact**: 注释说"verify through connectorExecutor"但代码无此验证
- **Minimum Fix**: 添加 `assert.ok(result.selectedIntentId?.includes("moltbook"))`
- **Anchor**: T2.4.1 / 05B_VERIFICATION_PLAN.md

**H-07 | L4 | owner-reply-feedback 可能泄露 PII**
- **Evidence**: `owner-reply-feedback.ts:117` `summary: input.replyText.slice(0, 500)` 直接存储到 chronicle
- **Impact**: owner 回复可能含敏感信息；audit 查询可能暴露
- **Minimum Fix**: 实现 redaction（信用卡、密码、邮箱等）；或仅存储摘要；审计查询应用 RedactionManifest
- **Anchor**: REQ-006 (sensitive audit leak 防御), T4.2.1

**H-08 | L4 | registry.hasCapability() 失败降级不明确**
- **Evidence**: `platform-capability-router.ts:81-85` catch 后返回 false，但 planner 仍生成 intent
- **Impact**: registry 故障时无法区分"不支持"和"故障"
- **Minimum Fix**: 记录 warn 日志，或返回标记区分两种情况
- **Anchor**: T2.4.1 / 05B_VERIFICATION_PLAN.md

---

### 🟡 Medium

**M-01 | L2 | owner reply tone 推断关键词不足**
- **Evidence**: `owner-reply-feedback.ts:28-30` 关键词列表较短
- **Minimum Fix**: 扩充关键词或置信度低时标记 "unknown"
- **Anchor**: T4.2.1

**M-02 | L1 | narrative-update confidence 计算过于简化**
- **Evidence**: `narrative-update.ts:42-50` `min(intentSources / 3, 1) + 0.1`
- **Minimum Fix**: 补充单元测试覆盖边界，或调整公式
- **Anchor**: T2.1.5

**M-03 | L3 | AgentGoal 类型被多模块导入形成隐性耦合**
- **Evidence**: `intent-planner.ts:214`, `platform-capability-router.ts:16`, `goal-priority.ts:11` 都导入 `AgentGoal`
- **Minimum Fix**: 各模块定义本地 Context 接口，只含所需字段
- **Anchor**: control-plane-system.md §4.2

**M-04 | L3 | intent-planner 工厂函数重复**
- **Evidence**: `intent-planner.ts:48-210` 四个 plan* 函数结构高度相似
- **Minimum Fix**: 提取 `planIntentWithKind(kind, priority, ...)` 工厂函数
- **Anchor**: 代码质量

**M-05 | L3 | owner-reply 推断函数硬编码**
- **Evidence**: `owner-reply-feedback.ts:28-64` 关键词列表硬编码
- **Minimum Fix**: 提取为 `ReplyInferenceConfig` 配置驱动
- **Anchor**: behavioral-guidance-system.md §7.2

**M-06 | L5 | T4.2.1 缺少冲突关键词测试**
- **Evidence**: 无 "positive + negative" 混合场景测试
- **Minimum Fix**: 添加冲突关键词测试
- **Anchor**: T4.2.1

**M-07 | L5 | T3.3.1 缺少单元测试**
- **Evidence**: 无 `tests/unit/connectors/t3-3-1-evidence-mapper.test.ts`
- **Minimum Fix**: 创建单元测试覆盖 mapLifeEvidence 边界
- **Anchor**: T3.3.1

**M-08 | L4+L5 | heartbeat-loop platformId "unknown" 降级无 guard**
- **Evidence**: `heartbeat-loop.ts:139, 157` `intent.platformId ?? "unknown"`
- **Minimum Fix**: guard 层检查 `platformId === "unknown"` 并拒绝
- **Anchor**: T2.4.1

---

### 🟢 Low

**L-01 | L1 | workspace-heartbeat-runner lifeEvidenceEmptyReason 映射不完整**
- **Evidence**: `workspace-heartbeat-runner.ts:94-96` 仅映射 "no_sources"
- **Minimum Fix**: 补充映射或注释说明
- **Anchor**: T2.2.2

**L-02 | L3 | platform-capability-router URI 解析不完整**
- **Evidence**: `platform-capability-router.ts:64-69` 不处理 `platform://moltbook/feed.read`
- **Minimum Fix**: 增强 URI 解析
- **Anchor**: connector-system.md §5.3

**L-03 | L3 | narrative progress 去重逻辑简单**
- **Evidence**: `narrative-update.ts:88-93` 使用字符串 includes 去重
- **Minimum Fix**: 使用 intent id 或 hash 去重
- **Anchor**: narrative-update.ts

**L-04 | L5 | t2-4-1-D 测试阈值硬编码**
- **Evidence**: `t4-2-1-owner-reply-relationship-loop.test.ts:121` `assert.ok(affinity > 0.6)` 无说明
- **Minimum Fix**: 使用命名常量
- **Anchor**: T4.2.1

**L-05 | L6 | INT-S5 关门报告仍为计划状态**
- **Evidence**: `05A_TASKS.md:934` `[ ]` 未勾选
- **Minimum Fix**: Wave 40 生成 `reports/int-s5-v6-life-loop-activation.md`
- **Anchor**: 05A_TASKS.md

**L-06 | L6 | AGENTS.md Wave 39 测试增量未精确说明**
- **Evidence**: AGENTS.md:310 记录 "214 测试全绿" 但未列出增量
- **Minimum Fix**: 补充 "T4.2.1 新增 6 个测试"
- **Anchor**: AGENTS.md

**L-07 | L6 | plugin/index.ts 头注释未提及 T4.2.1**
- **Evidence**: `plugin/index.ts:1-53` 未提及 owner reply feedback
- **Minimum Fix**: 头注释补充新功能说明
- **Anchor**: plugin/index.ts

---

## 6. 安全 / 测试覆盖补充

### 高风险缺口汇总

| 缺口 | 严重度 | 影响 | 修复建议 |
|------|--------|------|---------|
| 动态 connector 与 platformId 推断兼容性 | 🔴 Critical | T2.4.1 在真实 connector 上可能失效 | INT-S5 前改为 registry 动态读取 |
| outreach sourceRefs 虚构边界 | 🟠 High | 违反 evidence-backed 承诺 | guard 层拒绝空 evidence |
| goal priority 授权治理 | 🟠 High | agent-proposed goal 可能越权 | 定义 acceptedBy 枚举 |
| 真实 connector evidence 验证 | 🟠 High | T3.3.1 无法静态确认 | INT-S5 smoke test |
| 文本推断鲁棒性 | 🟠 High | 空/超长/特殊字符无防御 | 添加输入校验 + 单元测试 |
| PII 泄露 | 🟠 High | chronicle 存储原文 | redaction 或摘要存储 |
| 双写一致性 | 🟠 High | chronicle/relationship 不一致 | 添加 observability + 错误返回 |

### 立即修复清单 (交付 Claw 前)

1. **CR-06**: `src/core/second-nature/index.ts` 添加 feedback barrel export
2. **CR-07**: `README.md:17` 更新 Architecture badge 为 v6
3. **CR-08**: 统一 `package.json` / `plugin/package.json` / `plugin/openclaw.plugin.json` 版本号
4. **CR-03**: `owner-reply-feedback.ts` 添加空字符串防御
5. **CR-04**: 创建 `tests/unit/feedback/t4-2-1-owner-reply-inference.test.ts`
6. **CR-01**: `platform-capability-router.ts` 改为 registry 动态读取
7. **CR-05**: 歧义平台返回 `{ platformId?, ambiguous? }`

### 后续优化 (Wave 40/41)

8. **CR-02**: intent-planner 读 narrative/relationship (工作量 3-4h)
9. **H-01**: outreach guard 拒绝空 evidence
10. **H-02**: acceptedBy 枚举定义
11. **H-04**: owner-reply 双写一致性
12. **M-03~05**: 代码重复重构

---

**审查完成时间**: 2026-05-18
**审查代理**: A(L1+L2), B(L3), C(L4+L5), D(L6)
**汇总**: Nyx
**落盘路径**: `.anws/v6/wave-reviews/wave-39-review.md`
