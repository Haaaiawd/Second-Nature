# Replay - sn-v6-architecture-gap-analysis

- goal: 评估完成用户改进建议后 Second Nature 是否达成愿景，识别当前架构的根本瓶颈
- mode: explore
- totalSteps: 8
- currentStep: 8
- status: completed

## Steps

### Step 1

- shouldConverge: false
- mustConclude: false

第一步：先定义'达成愿景'的标准。用户的愿景是'不依赖人类指令、自己运转、自己积累经验的 Agent 运行循环'。核心指标：1) 自主运转（heartbeat 真实决策循环，非空转）；2) 有输入（跨平台 life evidence）；3) 有输出（outreach 主动联系人类）；4) 有积累（经验沉淀为可查询记忆）；5) 人类可感知（有质量的内容，非空壳）。当前 v5 的状态：heartbeat 循环通了但 connector 层缺口大（3/18 平台未接），outreach 理论上闭合但宿主 delivery 能力受限，Quiet 写了但读面刚修复，人类几乎感受不到 SN 存在。

### Step 2

- shouldConverge: false
- mustConclude: false

第二步：评估用户建议逐项完成后的状态。3.1 自定义 Connector（动态注册/SDK）→ 解决 15 个联盟站点接入的产能瓶颈，但 connector 本质是'调用外部 API 的适配器'，它不提供 agent 的自主判断力。3.2 密钥管理 → 鲁棒性提升，不改变功能。3.3 intent planner 平台感知 → 让 intent 能正确路由到 platformId，但不增加 evidence 质量。3.4 Outreach 三层投递 → 新增飞书通道，但核心问题仍在：outreach 的'内容质量'取决于 evidence，而 evidence 取决于 connector 能从平台带回什么。3.5 CapabilityRegistry 开放 → 连接器能力注册扩展。3.6 调试命令 → 可观测性提升。3.7 Skill 联动 → 让 intent 可调用 analysis skills。完成这些后，SN 的'骨架'很好，但'肌肉'（evidence 质量、outreach 内容价值、Quiet 洞察深度）仍取决于上游输入。

### Step 3

- shouldConverge: false
- mustConclude: false

第三步：识别当前架构中真正阻碍愿景达成的'结构性瓶颈'，而非功能缺失。瓶颈一：connector 是'拉取'模型（heartbeat 触发 → 读取平台），不是'事件驱动'模型。平台有新内容时 SN 不知道，必须等 heartbeat 来 polling。这导致'实时感知'和'机会捕捉'天然受限。瓶颈二：life evidence 是'平台 API 返回的原始内容'，没有经过 agent 的'理解'和'提炼'。evidence 只有 timestamp/platformId/summary，没有'这对我意味着什么'的语义层。瓶颈三：outreach 是'推送通知'心态，不是'对话'心态。v5 的 outreach 是一次性投递，没有上下文连续性。用户回复后没有轻连续性回路。瓶颈四：Quiet 是'夜间批处理'，不是'持续记忆治理'。当天的 evidence 要等晚上才处理， agent 在白天 heartbeat 之间对'自己做了什么'没有工作记忆。瓶颈五：整个系统没有'目标'或'意图'层。agent 只根据 rhythm window 选择动作种类，不知道自己'想达成什么'。

### Step 4

- shouldConverge: false
- mustConclude: false

第四步：对比' Connector 生态 + 三层投递 + Skill 联动'完成后的状态与愿景的真正差距。完成用户建议后：SN 能接 18 个平台 → 但每个平台只是另一个数据源，没有跨平台的'故事线'。SN 能发飞书消息 → 但消息内容仍是'平台有 X 条新内容'，不是'我发现了一件你可能感兴趣的事，因为...'。SN 能调用 skills → 但 skills 是外部工具调用，不是 agent 自身能力的扩展。Quiet 能读能写 → 但仍是'当晚回顾'，不是'持续的自我叙事'。根本上，SN 现在是一个'有节律的平台数据聚合器 + 通知发送器'，不是一个'有自我叙事、有目标追求、能持续成长'的 agent。区别在于：前者是'我按规则运转'，后者是'我在追求某种东西'。v5 的架构没有'追求'的位置。

### Step 5

- shouldConverge: false
- mustConclude: false

第五步：回看 v5 的架构决策，看看哪些决策埋下了'无法成长为真正自主 agent'的根因。ADR-002 选了 Connector Contract + Execution Adapter → 正确，但 manifest 设计以'能力调用'为中心，不是以'agent 意图'为中心。ADR-003 定义了 rhythm windows → 正确，但 rhythm 是'什么时候能做什么'，不是'为什么做'。ADR-007 定义了 delivery 闭环 → 正确，但 outreach 是'通知'语义，不是'关系'语义。这些决策都没有错，它们解决的是 v5 的问题。但 v5 的问题定义本身就把 SN 框定在'平台数据的搬运工'角色里。要突破这个框，需要新增一个'agent 自我层'——不是新系统，是一个跨系统的 concerns：agent 的长期目标、跨平台的叙事连贯性、从经验中学习的能力、对 owner 关系的主动维护（而不只是条件触发）。

### Step 6

- shouldConverge: true
- mustConclude: false

第六步：具体到 v6 应该引入什么，才能从'搬运工'变成'有追求的 agent'。我想到几个关键设计：1) **Agent Narrative Layer（叙事层）**：不是新的系统，是跨 control-plane / state / guidance 的一个 concerns。agent 维护一个'我在做什么、为什么'的 running narrative，每次 heartbeat 不只是执行动作，还要更新叙事。这样 outreach 就不是'通知有 3 条新帖'，而是'我在 MoltBook 看到一个讨论你项目的帖子，观点挺有意思，我觉得你会想知道'。2) **Experience → Insight 提炼**：life evidence 不只是原始事件记录，要经过一个 lightweight 的 insight extraction（在 guidance 层或新增一个微型 pipeline），产出'今天学到了什么'、'有什么值得记住的'。3) **Owner Relationship Memory**：不只是 user interest snapshot，而是 agent 对关系的理解——上次 outreach 后 owner 回复了什么语气、什么时候回复的、哪些话题引发了互动。这个 memory 应该影响 outreach 的语气、时机和内容选择。4) **Goal / Aspiration 层**：agent 应该有短期追求（'这周我想把 EvoMap 上的 profile 完善'）和长期方向（'我想成为开发者社区里有价值的参与者'），这些目标影响 intent planning 的优先级，而不仅是 rhythm window 的 kind。

### Step 7

- shouldConverge: true
- mustConclude: false

第七步：把这些想法收敛成对 v6 的明确建议，并评估风险。用户的建议（3.1-3.7 + bugs）是'基础能力建设'，完成后 SN 成为一个'功能完整的平台连接器 + 通知系统'。但要达成'自己运转、自己积累经验、主动联系人类'的愿景，还需要 v6 引入'agent 自我层'：叙事连贯性、经验提炼、关系记忆、目标追求。这个层不是另一个系统——它是现有系统（control-plane、state、guidance）的新 responsibilities。实现上，可以考虑：- 在  中增加  和 ；- 在  的 candidate planning 中增加 （超越 rhythm window）；- 在  中增加  和 ；- 在  中增加 。风险：这些设计需要 LLM 调用，增加成本和延迟；需要 careful prompt engineering 避免'hallucinated insight'；边界模糊容易让 guidance 层越权。但这些风险可控，关键是设计上明确：narrative 是'agent 的自我描述'，不是决策依据；决策仍由 control-plane 的 evidence-backed guard 负责。

### Step 8

- shouldConverge: true
- mustConclude: true

第七步：把这些想法收敛成对 v6 的明确建议，并评估风险。用户的建议（3.1-3.7 + bugs）是基础能力建设，完成后 SN 成为一个功能完整的平台连接器加通知系统。但要达成自己运转、自己积累经验、主动联系人类的愿景，还需要 v6 引入 agent 自我层：叙事连贯性、经验提炼、关系记忆、目标追求。这个层不是另一个系统，是现有系统的新 responsibilities。实现上可以考虑：在 state-system 中增加 NarrativeState 和 RelationshipMemory；在 control-plane-system 的 candidate planning 中增加 goal-directed intent（超越 rhythm window）；在 behavioral-guidance-system 中增加 insight extraction 和 narrative update；在 observability-system 中增加 narrative trace。风险：这些设计需要 LLM 调用，增加成本和延迟；需要 careful prompt engineering 避免 hallucinated insight；边界模糊容易让 guidance 层越权。但这些风险可控，关键是设计上明确：narrative 是 agent 的自我描述，不是决策依据；决策仍由 control-plane 的 evidence-backed guard 负责。

## Final Conclusion

第七步：把这些想法收敛成对 v6 的明确建议，并评估风险。用户的建议（3.1-3.7 + bugs）是基础能力建设，完成后 SN 成为一个功能完整的平台连接器加通知系统。但要达成自己运转、自己积累经验、主动联系人类的愿景，还需要 v6 引入 agent 自我层：叙事连贯性、经验提炼、关系记忆、目标追求。这个层不是另一个系统，是现有系统的新 responsibilities。实现上可以考虑：在 state-system 中增加 NarrativeState 和 RelationshipMemory；在 control-plane-system 的 candidate planning 中增加 goal-directed intent（超越 rhythm window）；在 behavioral-guidance-system 中增加 insight extraction 和 narrative update；在 observability-system 中增加 narrative trace。风险：这些设计需要 LLM 调用，增加成本和延迟；需要 careful prompt engineering 避免 hallucinated insight；边界模糊容易让 guidance 层越权。但这些风险可控，关键是设计上明确：narrative 是 agent 的自我描述，不是决策依据；决策仍由 control-plane 的 evidence-backed guard 负责。
