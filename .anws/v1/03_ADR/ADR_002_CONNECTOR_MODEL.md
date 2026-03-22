# ADR-002: 平台连接器模型与执行边界

## 状态
Accepted

## 日期
2026-03-22

## 背景
Lobster Rhythm 首版需要先完成对几类能力不同平台的初始适配，当前首批目标包括：
- Moltbook：社交社区型平台
- InStreet：社交社区型平台，带更重的心跳、通知和互动规则
- EvoMap：协议/市场型平台，带节点注册、保活和任务发现能力

项目还面临一个关键边界问题：我们究竟应当替代这些平台的 CLI，还是把 CLI/API/skill 视为下层执行能力。

## 决策驱动因素
- 因素 1: 产品本体是控制层，而不是平台客户端
- 因素 2: 平台之间能力差异显著，不能强行塞进单一同构抽象
- 因素 3: 黑客松时间有限，必须避免重造平台客户端
- 因素 4: 需要保留 API、CLI、skill 三种接入通道的灵活性
- 因素 5: 上层控制逻辑必须不感知底层执行细节

## 候选方案

### 方案 A: 直接取代各平台 CLI / 客户端
- **描述**: 我们自己重写平台操作能力，作为统一客户端替代所有下层工具。
- **优点**:
  - 控制感强
  - 对外抽象最统一
- **缺点**:
  - 明显重造轮子
  - 平台演进成本过高
  - 黑客松周期内风险极高

### 方案 B: 仅做 CLI 包装层
- **描述**: 控制层主要通过调用各平台 CLI 完成所有动作。
- **优点**:
  - 前期接入快
  - 复用已有脚本能力
- **缺点**:
  - 过度依赖 CLI 输出格式
  - 不适合长期稳定的自动控制层
  - 产品容易沦为 shell wrapper

### 方案 C: 控制层 + Connector Contract + Execution Adapter
- **描述**: 产品位于平台 API / CLI / skill 之上，通过统一 connector contract 对接下层执行能力；connector 内部可选择 API、CLI 或 skill/script 作为 execution adapter。
- **优点**:
  - 明确产品边界，避免取代平台客户端
  - 支持 API-first、CLI-fallback 的渐进接入策略
  - 上层控制逻辑不受平台实现细节污染
  - 可同时容纳社交社区型与协议/市场型平台
- **缺点**:
  - 需要额外设计 connector contract 与错误归一化规范
  - 首版需要接受平台间能力并不完全同构

## 决策
选择 **方案 C: 控制层 + Connector Contract + Execution Adapter**。

并明确以下原则：
- 产品定位为 **跨平台生活/探索控制层**，不是平台 CLI 替代品
- `connector-system` 是唯一允许直接接触平台 API/CLI/skill 的层
- 对于存在稳定 API 的平台，遵循 **API-first**
- CLI 或 skill/script 仅作为 **fallback、bootstrap 或 demo acceleration**
- 首批 connector 分为两类：
  - `social-community connector`：Moltbook、InStreet
  - `agent-network connector`：EvoMap

这一定义描述的是首批适配目标，不构成未来平台边界。

## 后果

### 正面
- 产品核心聚焦在 agent 生活编排，而非平台客户端细节
- 平台变更只需局部影响 connector，实现较强的可维护性
- 支持未来继续增加更多 agent-native 社区或协议网络

### 负面
- 需要定义更严格的 connector contract、错误模型和审计日志格式
- 对一些仅有 CLI 的平台，自动化稳定性仍低于 API-first 平台

### 需要的后续行动
- 在 `02_ARCHITECTURE_OVERVIEW.md` 中将 connector-system 拆分为两类 connector family
- 在后续 `04_SYSTEM_DESIGN/connector-system.md` 中定义统一接口、能力矩阵与错误模型
- 在实现阶段记录每个平台的 execution adapter 类型（API / CLI / skill）
- 在 `connector-system` 中将以下能力设为 contract 必选:
  - 验证态恢复（从持久化状态重建 pending verification）
  - 端点模式路由（A2A envelope required vs REST JSON required）

## 参考资料
- `https://www.moltbook.com/skill.md`
- `https://instreet.coze.site/skill.md`
- `https://evomap.ai/skill.md`
- `https://github.com/openclaw/skills/blob/main/skills/lunarcmd/moltbook-interact/SKILL.md`

## 影响范围

本 ADR 被以下系统引用:
- `control-plane-system` - 平台选择、行为调度与执行边界
- `connector-system` - connector family、execution adapter 与错误归一化
- `observability-system` - 审计日志中记录底层执行通道与失败来源
- `cli-system` - 向用户展示平台能力、状态与 fallback 信息
