# ADR-002: Connector Ecosystem 动态注册模型

## 状态
Accepted

## 日期
2026-05-15

## 背景
v5 的 connector 模型（ADR-002 v5）采用"手动 Contract + Execution Adapter"，添加新 connector 需要修改核心代码（connector-executor-adapter.js 中注册）。v6 需要支持 15+ 联盟站点，手动注册不可扩展。

## 决策驱动因素
- 因素 1: 15+ 联盟站点需要接入，手动注册产能不足
- 因素 2: 社区/开发者需要能独立贡献 connector，不修改 SN 核心
- 因素 3: v5 的硬编码 9 个 capability 值无法满足新增平台（如 agent-world:feed.read）
- 因素 4: 动态注册不能破坏已有 connector 的行为和安全性

## 候选方案

### 方案 A: 约定目录自动扫描 + manifest.yaml
- **描述**: connector 文件放在 `.second-nature/connectors/{platformId}/manifest.yaml`，SN 启动时自动扫描并注册。manifest 声明 platformId、baseUrl、authHeader、capabilities 映射。P0 只自动启用声明式 HTTP/A2A/MCP/CLI descriptor 与内置受控 runner；自定义本地代码不自动执行。
- **优点**: 零核心代码改动、社区可贡献、热重载支持
- **缺点**: 需要文件监控或手动触发重载、manifest 格式需严格验证

### 方案 B: Connector SDK / CLI 生成
- **描述**: 提供 `second-nature connector init` CLI 命令，根据平台 API 文档生成 connector 骨架（manifest + adapter）。
- **优点**: 开发者体验好、标准化格式
- **缺点**: 只是生成工具，不解决注册问题；需要配合方案 A 使用

### 方案 C: 保留 v5 硬编码注册
- **描述**: 继续手动在核心代码中注册每个 connector
- **优点**: 简单、无运行时风险
- **缺点**: 不可扩展、社区无法贡献、15+ 站点不可能手动完成

## 决策
选择 **方案 A 为主 + 方案 B 为辅**：
1. **动态注册**是默认机制：`.second-nature/connectors/` 约定目录自动扫描
2. **CLI 生成器**是开发者工具：`second-nature connector init` 生成骨架
3. **CapabilityContractRegistry 开放**：支持 `platformId:capability` 命名空间前缀
4. **执行信任分层**：declarative manifest 可自动注册；custom adapter / skill / browser runner 必须 owner allowlist、签名或显式确认
5. **冲突 fail-closed**：同名 `platformId` 默认跳过后加载项并记录 conflict；只有 owner 显式配置 override 时才覆盖

## 后果

### 正面
- 社区可独立贡献 connector，不修改 SN 核心
- 15+ 联盟站点可并行接入
- 运行时自动发现；P0 支持启动扫描和显式 reload，热重载为 P1

### 负面
- manifest 格式验证需要严格 schema（zod 或 YAML schema）
- custom adapter 无法在 P0 自动执行，开发者体验会比“放文件即运行”保守，但这是必要的安全边界
- 恶意 manifest 风险仍需验证来源、权限范围、敏感字段脱敏；未来可考虑签名

### 需要的后续行动
- 定义 manifest.yaml 规范 schema
- 定义 trust policy：`declarative`、`custom_adapter_pending_trust`、`trusted_custom_adapter`
- 实现 `DynamicConnectorRegistry` 扫描和验证逻辑
- 实现 `CapabilityContractRegistry` 命名空间前缀路由
- 实现 `second-nature connector init` CLI 命令
- 在 `04_SYSTEM_DESIGN/connector-system.md` 中详细定义 manifest 格式、验证规则、冲突策略

## 参考资料
- `.anws/v5/03_ADR/ADR_002_CONNECTOR_MODEL.md`
- `https://github.com/nodeca/js-yaml`

## 影响范围
- `connector-system` - 核心注册逻辑重写
- `cli-system` - 新增 `connector init` 命令
- `control-plane-system` - route planner 须识别动态注册的 platformId
