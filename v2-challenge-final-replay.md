# Replay - v2-challenge-final

- goal: 对 Second Nature v2 进行最终轮设计复查，验证遗留问题并识别最后一批真实断点
- mode: audit
- totalSteps: 5
- currentStep: 5
- status: completed

## Steps

### Step 1

- shouldConverge: false
- mustConclude: false

这轮不是再做开放式找茬，而是做最终收敛：哪些问题已经足够关单，哪些仍然会在 blueprint/forge 阶段造成系统性返工。当前确认：上一轮三大方向修复是有效的，设计成熟度明显提升；但复查发现新风险主要集中在'跨系统 shared contract 是否真的单源'和'状态/标识枚举是否一致'。这类问题不像理念缺失那样显眼，却最容易在实现阶段制造隐性返工。

### Step 2

- shouldConverge: false
- mustConclude: false

第一类风险仍是 effect commit protocol 的正式宿主没有闭合。control-plane 已把 createIntentCommitRecord/advanceIntentCommitState/commitIntentOutcome/loadIntentCommitRecord/abortIntentCommit 拉进主路径，connector 也承认 state-system 是 canonical owner，但 state-system 自己还没有把这些接口、实体、状态机写进正式 L0/L1。结果不是协议不存在，而是协议被最关键的 owner 系统缺席声明。这个缺口如果不补，后续实现一定会在 state 层临时加私有能力，破坏现在刚建立起来的架构克制。

### Step 3

- shouldConverge: false
- mustConclude: false

第二类风险是 shared contract 口号与实际文档不一致。observability 明说 DecisionRecord/ExecutionAttempt/AnchorChangeAudit 必须来自 shared contract，禁止各系统维护漂移副本；但 control-plane.detail 和 observability.detail 仍各自定义了 DecisionRecord，observability L0 也保留了自己的接口形状。同时 OutreachEvaluationInput/OutreachEvaluationResult 只被引用，不存在正式定义；ModelAssistPort 还把 evaluateOutreachCandidate 声明成 Promise<ModelEvaluationResult>，而 detail 里的 shouldAllowOutreach 却要求 OutreachEvaluationResult。也就是说，这一轮最大的 schema 风险不是某个字段少了，而是你们已经决定单源，却还没真正把单源对象落下来。

### Step 4

- shouldConverge: true
- mustConclude: false

第三类风险是状态机枚举未统一。state-system/cli-system 把凭据中间态写成 pending_verification；connector-system 的失败分类和 recoverVerification 前置条件却使用 verification_required，甚至 operation contract 里还出现 challenged；observability 的 credential 事件又写 registered/pending_verification/verified/expired/revoked，没有 active。对长期系统来说，这不是命名洁癖，而是恢复逻辑、解释链、审计统计会直接分叉：同一凭据到底是 active 还是 verified、pending_verification 还是 verification_required，最终会影响 route planner、CLI 展示、审计查询和恢复测试。

### Step 5

- shouldConverge: true
- mustConclude: true

最终收敛：这次 challenge 已经足以支撑最后一轮审查。项目方向成立，旧的战略性断点大多修复，但最终剩下的核心问题集中在契约统一而非功能缺失。最高优先级应是三件事：一，把 effect commit protocol 正式落到 state-system，闭合 owner；二，把 shared contract 真正提炼为单源，至少收掉 DecisionRecord 和 outreach evaluation 相关类型漂移；三，统一 credential lifecycle 与 commit/protocol 的状态枚举，不允许 pending_verification/verification_required/challenged、active/verified 继续并存。若这三件事收口，v2 设计就足以撑起 blueprint；若不收，后面实现会在接口层大量返工。

## Final Conclusion

最终收敛：这次 challenge 已经足以支撑最后一轮审查。项目方向成立，旧的战略性断点大多修复，但最终剩下的核心问题集中在契约统一而非功能缺失。最高优先级应是三件事：一，把 effect commit protocol 正式落到 state-system，闭合 owner；二，把 shared contract 真正提炼为单源，至少收掉 DecisionRecord 和 outreach evaluation 相关类型漂移；三，统一 credential lifecycle 与 commit/protocol 的状态枚举，不允许 pending_verification/verification_required/challenged、active/verified 继续并存。若这三件事收口，v2 设计就足以撑起 blueprint；若不收，后面实现会在接口层大量返工。
