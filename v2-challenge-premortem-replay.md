# Replay - v2-challenge-premortem

- goal: 审查 Second Nature v2 设计并预演 6 个月后的失败根因
- mode: audit
- totalSteps: 5
- currentStep: 5
- status: completed

## Steps

### Step 1

- shouldConverge: false
- mustConclude: false

先钉主问题：这个 idea 的亮点很强，不是再造 agent runtime，而是把长期 agent 的生活方式、节律、Quiet 和记忆治理产品化。6 个月后如果失败，最可能不是因为概念不美，而是因为'高层连续性协议'没有在工程上形成可稳定执行的闭环：用户很难校准它，系统在 Quiet/interrupt/outreach 之间产生冲突，或者平台/记忆治理的关键边界在失败路径上失真。也就是说，失败更像契约收不拢，而不是愿景不吸引人。

### Step 2

- shouldConverge: false
- mustConclude: false

第一条失败链看产品采用：PRD 把成功建立在持续存在感、自然关系感和用户信任上，但文档里的可验证指标大多是平台数、闭环率、整理产出率，缺少对'用户为什么会持续忍受一个主动联系的 agent'的验证闭环。US-006 说 agent 要在值得时联系用户，control-plane 里也给了 outreach，但我还没看到足以把'有价值联系'和'自我感很强但其实很吵'区分开的具体质量阈值。这意味着产品层最独特的价值点，当前更像哲学目标而不是已收敛的机制。

### Step 3

- shouldConverge: false
- mustConclude: false

第二条失败链看运行时：Quiet 被定义为低主动性整理窗口，但 control-plane 的 quiet 子决策树会先 refresh_indexes、再 curate_memory、再 narrative_reflection；与此同时高价值 interrupt 可以打断 Quiet，outreach 又被建模为 model_assisted。这里最危险的不是单个状态，而是窗口资源竞争：如果 quiet 输入充足、又频繁有 obligation/interrupt，reflection 很容易长期饥饿；反过来如果 reflection 强行跑，又会压制对外机会。现在文档里有状态机和 guard，但缺少'每晚至少一次 reflection'或'被中断后何时补做'这类公平性/活性保证。长期运行下，这会让 G5 的白天理性执行+夜间叙事反思闭环变成偶发现象。

### Step 4

- shouldConverge: true
- mustConclude: false

第三条失败链看工程一致性：control-plane 通过 checkpoint + lease 避免重复 effect，state-system 用 filesystem + SQLite hybrid 保存 canonical artifacts 与索引，connector 又有 retry/backoff/cooldown。单看各自都合理，但跨系统的提交边界仍偏松：例如 dispatchEffect 在外部 effect 返回后直接结束，L1 里没有明确'何时把 intent 标记 committed、何时把 connector outcome 与 decision/trace/snapshot 形成单一完成态'。resumeFromCheckpoint 依赖 state.isIntentCommitted(checkpoint.intentId)，可目前已读文档里没看到与 connector 成功/失败写回严格绑定的提交协议。于是进程重启或外部调用超时后，最坏情况不是纯失败，而是'平台已执行、副本认为未执行'，随后 resume 或 duplicate window 再次触发。

### Step 5

- shouldConverge: true
- mustConclude: true

收敛结论：6 个月后的真实失败大概率来自三类根因。其一，产品价值验证不足——联系用户是否真的'值得'缺少硬质验收，可能把独特体验做成噪音。其二，运行时活性约束缺失——Quiet/interrupt/obligation/outreach 的竞争没有最低完成保证，Narrative Reflection 可能长期饥饿，导致核心卖点退化。其三，跨系统提交语义不闭合——checkpoint、lease、connector outcome、state commit 与 observability evidence 没有形成一个明确的 effect commit protocol，恢复场景可能出现重复外呼或证据链断裂。这三类都不是小优化，而是会直接动摇 Second Nature 的可信度。

## Final Conclusion

收敛结论：6 个月后的真实失败大概率来自三类根因。其一，产品价值验证不足——联系用户是否真的'值得'缺少硬质验收，可能把独特体验做成噪音。其二，运行时活性约束缺失——Quiet/interrupt/obligation/outreach 的竞争没有最低完成保证，Narrative Reflection 可能长期饥饿，导致核心卖点退化。其三，跨系统提交语义不闭合——checkpoint、lease、connector outcome、state commit 与 observability evidence 没有形成一个明确的 effect commit protocol，恢复场景可能出现重复外呼或证据链断裂。这三类都不是小优化，而是会直接动摇 Second Nature 的可信度。
