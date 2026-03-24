# 设计审查报告

**审查对象**: `connector-system` + `control-plane-system`  
**审查日期**: 2026-03-22  
**审查者**: design-reviewer (三维框架)

---

## 🔍 设计审查发现

### 摘要

| 维度 | 发现数 | Critical | High | Medium | Low |
|------|:------:|:--------:|:----:|:------:|:---:|
| 系统设计 | 2 | 0 | 1 | 1 | 0 |
| 运行模拟 | 2 | 0 | 1 | 1 | 0 |
| 工程实现 | 3 | 0 | 0 | 2 | 1 |
| **合计** | **7** | **0** | **2** | **4** | **1** |

---

### 系统设计 — SD-01: maintainPresence 接口契约模糊

**严重度**: Medium  
**文档位置**: `connector-system.md` §3.1.1 BaseConnector, §5.3.2 平台特例处理

**问题**:
`BaseConnector.maintainPresence()` 对不同平台语义差异巨大：
- InStreet: 30分钟心跳流程（6个步骤：仪表盘→回复评论→处理通知→私信→浏览→社交）
- EvoMap: 15分钟单次 heartbeat（无步骤）

但接口签名相同，返回类型相同，上层调用者无法感知这种差异，可能导致：
1. 对 InStreet 调用时误判执行时间（实际可能需要几分钟，不是瞬间完成）
2. 对 EvoMap 调用时期待多步骤结果，但实际只有单次响应

**证据**:
- 文档分析: InStreet 心跳流程包含6个步骤（`connector-system.md` §5.3.2）
- 文档分析: EvoMap heartbeat 是单次 POST（`connector-system.md` §5.3.2）
- 推理链: 统一接口返回 `PresenceResult`，但 InStreet 的 `whatToDoNext` 和 EvoMap 的 `pending_events` 语义不同，调用者需要平台特有知识才能正确解析

**影响**:
- `control-plane-system` 调度时无法准确预估执行时间
- 可能导致 InStreet 心跳超时判定错误

**建议**:
1. 在 `PresenceResult` 中增加 `executionMode: 'instant' | 'multi-step'` 字段
2. 对于 multi-step 模式，提供 `estimatedDurationMs` 预估时间
3. 或者：将 maintainPresence 拆分为 `heartbeat()`（瞬时）和 `presenceRoutine()`（多步骤）两个接口

---

### 系统设计 — SD-02: PENDING_VERIFICATION 状态职责边界不清

**严重度**: High  
**文档位置**: `control-plane-system.md` §3.1 状态定义, `connector-system.md` §6.2 凭据生命周期

**问题**:
两个系统都定义了「待验证」状态：
- `control-plane-system`: `PENDING_VERIFICATION` 状态（探索会话级别）
- `connector-system`: `pending_verification` 凭据状态（凭据存储级别）

职责边界不清晰：
1. 当 connector 返回「需验证」时，control-plane 进入 PENDING_VERIFICATION 状态
2. 但凭据验证完成后，谁负责状态同步？connector 还是 control-plane？
3. 如果用户在 CLI 中手动完成验证，通知路径是什么？

**证据**:
- 文档分析: `control-plane-system.md` §3.1 "PENDING_VERIFICATION: 等待用户完成验证"
- 文档分析: `connector-system.md` §6.2 凭据生命周期状态图包含 `pending_verification`
- 推理链: 没有定义两个状态之间的同步机制，可能导致状态漂移

**影响**:
- 验证完成后系统可能无法自动恢复
- 用户可能看到不一致的状态显示（CLI 显示已验证，但 control-plane 仍卡在 PENDING_VERIFICATION）

**建议**:
1. **明确边界**: `connector-system` 负责凭据级别状态，`control-plane-system` 负责会话级别状态
2. **定义事件**: connector 验证状态变更时，通过事件通知 control-plane
3. **统一入口**: 用户在 CLI 完成验证后，统一通过 `connector-system` 更新状态，再事件通知 control-plane

---

### 运行模拟 — RS-01: 调度器同时触发仲裁策略不明确

**严重度**: Medium  
**文档位置**: `control-plane-system.md` §4.2 调度算法

**问题**:
调度器设计说「当调度触发时，优先检查心跳到期的平台，其次是探索到期的平台」，但没有说明：
1. 如果多个平台同时心跳到期，处理顺序是什么？
2. 如果处理第一个平台心跳期间，第二个平台心跳超时了，如何恢复？
3. 调度器的 `getNextEvent()` 每次只返回一个事件，但可能有多个到期事件

**证据**:
- 文档分析: `control-plane-system.md` §4.2 `getNextEvent()` 只返回 `dueSchedules[0]`
- 推理链: InStreet（30分钟）和 EvoMap（15分钟）在某些时刻会同时触发，如果只处理一个，另一个可能超时

**影响**:
- 平台可能意外离线（心跳超时）
- 调度延迟累积

**建议**:
1. 修改 `getNextEvents()` 返回所有到期事件数组
2. 定义并行处理策略（如果平台独立，可并行执行心跳）
3. 或：定义严格的优先级队列，确保高优先级（短间隔）平台不被饿死

---

### 运行模拟 — RS-02: PENDING_VERIFICATION 状态缺少超时处理

**严重度**: High  
**文档位置**: `control-plane-system.md` §3.1 状态定义, §3.3 状态流转条件

**问题**:
`PENDING_VERIFICATION` 状态只有两种出口：
- `verification_complete` → `CONNECTING`
- 没有定义超时出口

如果用户永远不完成验证（比如放弃该平台），会话永远卡在 `PENDING_VERIFICATION`，不会自动清理。

**证据**:
- 文档分析: `control-plane-system.md` §3.1 状态定义图中 `PENDING_VERIFICATION` 只有两个出口
- 文档分析: `connector-system.md` §6.1 InStreet 验证挑战「5分钟内解答」
- 推理链: 虽然 InStreet 有5分钟超时，但 control-plane 没有相应设计

**影响**:
- 资源泄漏（会话对象永不释放）
- 用户无法重新发起该平台探索（因为会话卡在旧状态）

**建议**:
1. 增加 `verification_timeout` 触发条件
2. 超时后进入 `COOLING_DOWN` 或 `FAILED` 状态
3. 允许用户手动取消验证，强制状态转移

---

### 工程实现 — EI-01: CLI Adapter 测试策略未定义

**严重度**: Low  
**文档位置**: `connector-system.md` §2.2 分层架构, §3.2 Execution Adapter

**问题**:
`CliAdapter` 需要解析 CLI 输出，但：
1. 不同平台 CLI 输出格式差异大
2. 设计文档没有定义如何测试 CLI 解析逻辑
3. 没有定义 Mock CLI 的策略

**证据**:
- 文档分析: `connector-system.md` §3.2 "CLI 或 skill/script 仅作为 fallback"
- 推理链: CLI 输出解析是容易出错的地方，但缺少测试契约

**影响**:
- 实现阶段可能遗漏 CLI 适配器测试
- 平台变更 CLI 输出格式时，回归测试困难

**建议**:
1. 定义 `CliAdapter` 的 `parseOutput(stdout: string): Result<T>` 接口
2. 要求每个 CLI 适配器提供：示例输出文件 + 预期解析结果
3. 使用 snapshot testing 验证 CLI 解析稳定性

---

### 工程实现 — EI-02: LLM 相关性判断缺少降级策略

**严重度**: Medium  
**文档位置**: `control-plane-system.md` §4.1 平台选择算法, §5.5 LLM 集成

**问题**:
平台选择算法使用 `calculateRelevance()` 判断目标相关性，可选 LLM 判断，但：
1. 没有定义 LLM 调用超时后的行为
2. 没有定义 LLM 失败（网络/配额/错误）后的降级策略
3. 没有说明如何缓存 LLM 结果避免重复调用

**证据**:
- 文档分析: `control-plane-system.md` §4.1 "相关性 γ: 可由 LLM 判断或标签匹配"
- 文档分析: `control-plane-system.md` §5.5 "LLM 失败有降级" 但没有具体说明
- 推理链: 如果每次平台选择都调用 LLM，成本高且延迟大

**影响**:
- LLM 调用失败时平台选择算法崩溃
- 频繁调用 LLM 导致成本超预算

**建议**:
1. 明确定义降级链：LLM 判断 → 标签匹配 → 固定优先级
2. 定义超时：LLM 调用超过 2s 自动降级为标签匹配
3. 添加缓存：相同目标+平台组合的 LLM 结果缓存 1 小时

---

### 工程实现 — EI-03: 凭据加密缺少恢复机制

**严重度**: Medium  
**文档位置**: `connector-system.md` §6.5 安全要求

**问题**:
凭据加密依赖用户主密码派生密钥，但：
1. 没有定义主密码丢失后的恢复机制
2. 没有定义如何备份加密凭据
3. 没有说明更换主密码时的密钥重加密流程

**证据**:
- 文档分析: `connector-system.md` §6.5 "密钥由用户主密码派生"
- 文档分析: `connector-system.md` §6.5 "支持导出加密凭据备份"
- 推理链: 如果用户忘记主密码，所有平台凭据永久丢失（因为都是加密存储）

**影响**:
- 用户丢失主密码 = 丢失所有平台接入能力
- 没有恢复路径

**建议**:
1. 定义主密码重置流程（需要重新注册所有平台，或提供恢复码机制）
2. 明确提示用户：主密码丢失无法恢复
3. 提供「导出明文备份」功能（用户自担风险）

---

## 📋 修复优先级

| 优先级 | 问题 | 修复时机 |
|:------:|------|---------|
| **P0** | SD-02: PENDING_VERIFICATION 状态职责边界不清 | Forge 前 |
| **P0** | RS-02: PENDING_VERIFICATION 缺少超时处理 | Forge 前 |
| **P1** | RS-01: 调度器仲裁策略不明确 | Forge 前 |
| **P1** | EI-02: LLM 相关性判断缺少降级策略 | Forge 前 |
| **P1** | EI-03: 凭据加密缺少恢复机制 | 实现阶段 |
| **P2** | SD-01: maintainPresence 接口契约模糊 | 实现阶段 |
| **P3** | EI-01: CLI Adapter 测试策略未定义 | 后续 |

---

## 🔗 关联 Challenge Report

本审查发现的 **High** 级别问题应更新至 `07_CHALLENGE_REPORT.md`：
- SD-02 对应 M3（Control Plane 与 Connector 间缺少状态机与命令契约）的细化
- RS-02 是新增发现，需补充到 challenge report
