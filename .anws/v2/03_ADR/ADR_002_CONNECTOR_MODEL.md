# ADR-002: 平台连接器模型与执行边界

## 状态
Accepted

## 日期
2026-03-23

## 背景
Second Nature 首版需要在其高层行为连续性协议下，先完成对几类能力不同平台的初始适配，当前首批目标包括：
- Moltbook：社交社区型平台
- InStreet：社交社区型平台，带验证挑战、心跳和互动规则
- EvoMap：协议/市场型平台，带节点注册、保活和任务发现能力

本项目同时面临一个关键边界问题：我们究竟应当替代这些平台的客户端和 CLI，还是把平台 API、CLI、skill 视为下层执行能力，并在其之上做生活编排。

## 决策驱动因素
- 因素 1: 产品本体是 `Second Nature` 的高层行为编排，不是平台客户端
- 因素 2: 平台能力差异显著，不能强行塞进单一同构抽象
- 因素 3: 黑客松时间有限，必须避免重造平台客户端
- 因素 4: 上层节律、Quiet、Narrative Reflection 不应被底层执行细节污染
- 因素 5: 需要区分“可借鉴的通用模式”和“必须自己掌握的产品主权”

## 候选方案

### 方案 A: 直接取代各平台 CLI / 客户端
- **描述**: 自己重写平台操作能力，统一替代所有下层工具。
- **优点**:
  - 控制感最强
  - 理论上外部抽象最统一
- **缺点**:
  - 明显重造轮子
  - 平台演进成本极高
  - 直接挤压节律与 Quiet 设计的创新预算

### 方案 B: 仅做 CLI 包装层
- **描述**: 控制层主要通过调用各平台 CLI 或脚本完成所有动作。
- **优点**:
  - 前期接入快
  - 复用已有 skill / script 能力
- **缺点**:
  - 过度依赖 CLI 输出格式
  - 产品容易沦为 shell wrapper
  - 不适合作为长期稳定的连续性层

### 方案 C: Control Plane + Connector Contract + Execution Adapter
- **描述**: Second Nature 位于平台 API / CLI / skill 之上，通过统一 connector contract 对接下层执行能力；connector 内部可选择 API、CLI 或 skill/script 作为 execution adapter。
- **优点**:
  - 明确产品边界，避免取代平台客户端
  - 支持 API-first、CLI-fallback 的渐进接入策略
  - 上层节律、Quiet 和用户关系逻辑不受平台实现细节污染
  - 支持社交社区型与协议/市场型平台并存
- **缺点**:
  - 需要额外设计 connector contract、错误模型与执行审计结构
  - 首版必须接受平台能力并不完全同构

## 决策
选择 **方案 C: Control Plane + Connector Contract + Execution Adapter**。

并明确以下原则：
- 产品定位为 **OpenClaw 之上的高层连续性层**，不是平台 CLI 或客户端替代品
- `connector-system` 是唯一允许直接接触平台 API/CLI/skill 的层
- 对于存在稳定 API 的平台，遵循 **API-first**
- CLI 或 skill/script 仅作为 **fallback、bootstrap 或 demo acceleration**
- 首批 connector 分为两类：
  - `social-community connector`: Moltbook、InStreet
  - `agent-network connector`: EvoMap
- 可借鉴外部项目的 retry/backoff、job lifecycle、durable execution 思想，但不把这些框架当成产品主体

## 候选方案对比

| 候选 | 总体判断 | 优势 | 劣势 |
|------|------|------|------|
| 重写平台客户端 | 不可取 | 控制最强 | 重造轮子，风险最高 |
| 纯 CLI 包装 | 过渡可用 | 接入快 | 容易退化为 shell wrapper |
| Connector Contract + Execution Adapter | 最优 | 边界清晰，支持 API-first / fallback，保护上层设计 | 需要额外定义 contract 与错误模型 |

## 后果

### 正面
- 产品核心继续聚焦在 agent 的生活编排、节律与 Quiet，而非平台细节
- 平台变化主要局部影响 connector，可维护性更好
- 未来可在不污染上层的前提下继续接入更多平台

### 负面
- 需要定义更严格的 connector contract、错误归一化、验证态恢复和执行通道审计模型
- 对仅有 CLI 的平台，自动化稳定性仍低于 API-first 平台

### 需要的后续行动
- 在 `04_SYSTEM_DESIGN/connector-system.md` 中定义统一接口、能力矩阵、错误模型与 execution adapter 类型
- 在实现阶段记录每个平台的 execution channel（API / CLI / skill）
- 在 `connector-system` 中将以下能力设为 contract 必选:
  - 验证态恢复（从持久化状态重建 pending verification）
  - 端点模式路由（A2A envelope required vs REST JSON required）
  - 至少一条真实可运行的 CLI/skill fallback 路径（避免 REQ-007 退化为占位性承诺）

## 参考资料
- `https://www.moltbook.com/skill.md`
- `https://instreet.coze.site/skill.md`
- `https://evomap.ai/skill.md`
- `https://github.com/openclaw/openclaw`
- `https://github.com/mem0ai/mem0`
- `https://github.com/langchain-ai/langgraph`
- `https://github.com/temporalio/sdk-typescript`
- `https://github.com/agenda/agenda`

## 影响范围

本 ADR 被以下系统引用:
- `control-plane-system` - 平台选择、行为调度与执行边界
- `connector-system` - connector family、execution adapter、错误归一化与 fallback 路径
- `observability-system` - 审计日志中记录底层执行通道与失败来源
- `cli-system` - 向用户展示平台能力、状态与 fallback 信息
