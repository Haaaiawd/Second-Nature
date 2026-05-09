# T2.0.1 Heartbeat Host Bridge POC Report

**Task**: T2.0.1 — 确认 OpenClaw heartbeat 宿主桥接策略  
**Date**: 2026-03-31  
**Status**: Complete  

---

## Executive Summary

**选定主桥接方案**: `HEARTBEAT.md + tool use`  
**备选方案**: `service-assisted bridge`

---

## 宿主机制分析

### OpenClaw Heartbeat 实际工作方式

通过调研 OpenClaw 文档确认：

| 特性 | 值 |
|------|-----|
| 运行位置 | 主会话 |
| 触发方式 | 固定间隔（默认 30 分钟） |
| 执行机制 | LLM 轮次，读取 HEARTBEAT.md 检查清单 |
| 静默行为 | 无事时回复 `HEARTBEAT_OK` |
| Plugin 回调 | ❌ 不存在直接的 plugin heartbeat callback |

**关键约束**: heartbeat 不是 plugin 事件，而是主会话中的 LLM 轮次。这意味着 Second Nature 不能通过注册 plugin callback 来接收 heartbeat 信号。

---

## 候选桥接方案评估

### 方案 A: HEARTBEAT.md + tool use（主选）

**工作机制**:
1. 在 `HEARTBEAT.md` 中加入 Second Nature 的检查项
2. OpenClaw 心跳触发 LLM 轮次，LLM 读取 HEARTBEAT.md
3. LLM 调用 `second_nature_ops` tool 触发 Second Nature 节律链
4. Second Nature runtime 返回决策结果（HEARTBEAT_OK / intent_selected / denied）
5. LLM 根据结果决定是否执行后续动作

**Signal 路径**:
```
OpenClaw Heartbeat → LLM reads HEARTBEAT.md → LLM calls second_nature_ops tool
→ Second Nature runtime processes → Returns HeartbeatCycleResult
→ LLM interprets result → Takes action or returns HEARTBEAT_OK
```

**Metadata 合同**:
```ts
interface HeartbeatBridgeSignal {
  trigger: 'heartbeat';
  scopeHint: 'rhythm';
  payload: {
    heartbeatChecklist: string;      // HEARTBEAT.md 内容
    sessionContext?: string;         // 主会话上下文摘要
    timestamp: string;               // 心跳触发时间
  };
}
```

**优点**:
- 与 OpenClaw 原生机制完全对齐
- 不需要 plugin 有直接的 heartbeat callback
- LLM 作为桥接层，天然具备上下文感知能力
- 已有 `second_nature_ops` tool 可作为入口

**缺点**:
- 依赖 LLM 正确读取 HEARTBEAT.md 并调用 tool
- 增加一次 LLM 轮次的 token 开销
- 需要精心设计 HEARTBEAT.md 内容以确保正确调用

**风险**:
- LLM 可能忽略或跳过 tool 调用（需要通过 guidance 强化）
- HEARTBEAT.md 内容膨胀会增加 token 成本

---

### 方案 B: service-assisted bridge（备选）

**工作机制**:
1. `second-nature-runtime` service 在 plugin 加载时启动
2. Service 维护稳定的 runtime 状态
3. 通过 cron 或外部触发器调用 service 的 bridge helper
4. Bridge helper 生成 signal 并送入 control-plane

**Signal 路径**:
```
Cron / External Trigger → second-nature-runtime service
→ Bridge helper generates signal → control-plane processes
→ Result returned to caller
```

**优点**:
- 不依赖 LLM 行为
- 更确定性的触发路径
- 适合精确定时场景

**缺点**:
- 不是真正的 heartbeat 语义（失去主会话上下文）
- 需要额外的触发机制
- 与"自由心跳"的产品目标不够贴合

---

## 决策

### 主桥接方案: HEARTBEAT.md + tool use

**理由**:
1. 与 ADR-005 的决策一致：heartbeat 是自由心跳主生命线
2. 保留主会话上下文，这是 heartbeat 的核心价值
3. 已有 `second_nature_ops` tool 可作为入口，不需要新增 surface
4. LLM 的上下文感知能力正好匹配"感知-判断-决策"的节律链

### 实施要点

1. **HEARTBEAT.md 设计**:
   ```md
   # Second Nature Heartbeat
   
   - Call the `second_nature_ops` tool with command "heartbeat_check"
   - If the tool returns HEARTBEAT_OK, continue normally
   - If the tool returns an intent, execute the recommended action
   ```

2. **Tool 扩展**:
   - 在 `second_nature_ops` tool 中新增 `heartbeat_check` 命令
   - 该命令触发完整的节律链：snapshot → scope → decision → result

3. **Signal Contract**:
   - `trigger: 'heartbeat'`
   - `scopeHint: 'rhythm'`
   - `payload` 包含心跳上下文

4. **消费者**:
   - `control-plane-system` 的 `ingestRhythmSignal()` 接收 signal
   - 构建 `ContinuitySnapshot`
   - 执行节律决策
   - 返回 `HeartbeatCycleResult`

---

## 后续任务映射

| 后续任务 | 与本 POC 的关系 |
|---------|---------------|
| T2.1.1 | 实现 `ingestRhythmSignal()` 和 `ContinuitySnapshot` 构建 |
| T2.1.2 | 实现 scope router，区分 rhythm/user_task/user_reply |
| T2.2.1 | 实现 heartbeat decision loop 和 HEARTBEAT_OK 路径 |
| T2.2.2 | 接通 guidance bridge 和 effect dispatch |

---

## 风险登记

| 风险 | 严重度 | 缓解措施 |
|------|--------|---------|
| LLM 跳过 tool 调用 | Medium | 通过 guidance 强化，在 HEARTBEAT.md 中明确指令 |
| better-sqlite3 在 --ignore-scripts 下失效 | High | T1.0.1 已识别，后续宿主验证时重点检查 |
| HEARTBEAT.md token 膨胀 | Low | 保持检查清单精简，只包含必要调用指令 |
