# action-closure-policy-system Research

## 1. 问题与范围

| 子问题 | 方向 | 预期产出 |
| --- | --- | --- |
| Agent 自主动作如何不绕过安全边界？ | 混合 | 定义 `ActionProposal -> ActionPolicyDecision` 强制门禁。 |
| Heartbeat 后怎样算闭环？ | 混合 | 定义 `ActionClosureRecord` 的完整字段和 no-action 语义。 |
| 平台差异如何进入而不变成平台脑？ | 向内 | 定义 platform profile、affordance、connector capability 的依赖边界。 |

不包含：connector runner 实现、draft 文案生成算法、ops command 展示。

## 2. 核心洞察

1. `ActionPolicyDecision` 是自主行动的统一安全门，不是替代 agent judgment 的规则脑。
2. `ActionClosureRecord` 必须记录 input、decision、execution/output、post_processing 和 next_state，否则 heartbeat 仍是 silent polling。
3. connector 只能执行已允许的能力，不能从 payload 或平台名推导“该不该做”。

## 3. 详细发现

### Policy Gate

`.anws/v8/03_ADR/ADR_004_PLATFORM_NEUTRAL_AUTONOMY_POLICY.md` 采纳 platform-neutral action taxonomy and policy gate。系统设计需要把 platform policy、source refs、risk posture、owner preference、affordance 作为输入，并输出 allow、defer、downgrade、deny。

### Closure Ledger

`.anws/v8/01_PRD.md` [REQ-009] 要求每轮 heartbeat 后至少产生 `ActionClosureRecord` 或 `no_action_reason`。闭环不是执行成功才写账；denied、downgraded、failed、deferred 都是 closure 事实。

### 平台边界

`.anws/v8/02_ARCHITECTURE_OVERVIEW.md` 将 connector 定义为手脚执行边界，将 body-tool 定义为“能不能做”，将 action-closure-policy 定义为自主边界和闭环账本。因此本系统依赖平台约束，但不把平台适配逻辑内聚进自身。

## 4. 创意/方案表

| 方案 | 判定 | 理由 |
| --- | --- | --- |
| connector 内部判断是否回复/发布 | 拒绝 | 手脚不能决定该不该行动。 |
| control-plane 直接执行 judged action | 拒绝 | control-plane 会变成大脑并绕过安全门。 |
| action 系统统一 proposal/policy/closure | 采纳 | 契合 ADR-002 与 ADR-004，并可被 Quiet/Dream 消费。 |

## 5. 行动建议

- L0 文档应把 no-action reason 作为一等输出，而不是错误分支。
- L0 文档应定义 write-side action 只有 `allow` 后才能进入 connector execution；`downgrade` 进入 draft/notify。

## 6. 局限与待探

无阻塞缺口；具体 owner preference schema 可由 state-memory-system 详细设计继续收敛。

## 7. 参考来源

- `.anws/v8/01_PRD.md` [REQ-003], [REQ-004], [REQ-009]
- `.anws/v8/02_ARCHITECTURE_OVERVIEW.md` System 4, System 6, System 7
- `.anws/v8/concept_model.json`
- `.anws/v8/03_ADR/ADR_002_LIVING_PERCEPTION_LOOP.md`
- `.anws/v8/03_ADR/ADR_004_PLATFORM_NEUTRAL_AUTONOMY_POLICY.md`
- `.anws/v8/00_DEEPWIKI_MECHANISM_AUDIT.md` §6.4, §6.5

Skill harvesting 未使用；本轮依据 v8 本地 genesis 产物与机制审计收敛。
