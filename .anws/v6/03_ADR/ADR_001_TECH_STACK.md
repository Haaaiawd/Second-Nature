# ADR-001: v6 技术栈继承与增量决策

## 状态
Accepted

## 日期
2026-05-15

## 背景
v5 已验证 TypeScript + Node.js + OpenClaw native plugin + SQLite/sql.js 的技术栈可满足 lived-experience closure。v6 在此基础上新增 Agent Self Layer、Dream、Connector Ecosystem，需要判断是否需要引入新语言/框架。

## 决策驱动因素
- 因素 1: v5 代码库和团队技能已建立在 TS/Node 上，切换成本极高
- 因素 2: v6 新增能力（Dream LLM 调用、Connector 动态注册、Session Chronicle）均可在 TS 生态内实现
- 因素 3: 月度 LLM 预算 $20 限制，不需要高性能计算栈
- 因素 4: v5 schema 兼容性要求，新增表/字段即可，不需要迁移到新数据库

## 候选方案

### 方案 A: 继承 v5 栈，增量引入 YAML parser + 可选文件监控
- **描述**: TypeScript + Node.js + OpenClaw + SQLite/sql.js，新增 YAML parser（例如 `js-yaml` 或等价受维护包）用于 manifest 解析，文件监控（例如 `chokidar`）仅作为 P1 可选能力。Dream LLM 调用通过新建 `ModelAssistPort` / `DreamModelPort` 抽象接入，不硬编码供应商 SDK。
- **优点**: 零切换成本、团队熟悉、v5 兼容、开发速度快
- **缺点**: 无（v6 需求不需要更高级的性能或生态）

### 方案 B: 引入 Python FastAPI + SQLAlchemy
- **描述**: 用 Python 重写部分模块，利用其 AI/ML 生态
- **优点**: Python 在 LLM prompt engineering 方面工具更多
- **缺点**: 引入第二语言、跨语言调用复杂、OpenClaw plugin 不支持 Python runtime、破坏 v5 兼容

### 方案 C: 引入 Rust (Tokio + SQLite)
- **描述**: 用 Rust 重写性能敏感模块
- **优点**: 性能更好、内存安全
- **缺点**: 学习曲线陡峭、OpenClaw plugin 不支持 Rust、过度工程化（v6 无性能瓶颈）

## 决策
选择 **方案 A: 继承 v5 栈，增量引入 js-yaml + 可选 chokidar**。

## 后果

### 正面
- 团队零切换成本，可立即开始 v6 开发
- v5 全部测试和 CI 可复用
- OpenClaw plugin 兼容性保持
- Connector SDK/CLI 生成器可用 TS 模板实现

### 负面
- Dream 的异步任务、成本预算、partial output 管理需要比 v5 更严格的 runtime 边界。
- 动态 connector 若允许任意代码执行，会扩大安全面；因此技术栈继承不等于自动信任 workspace 代码。

### 需要的后续行动
- 在 `package.json` 中新增 YAML parser 依赖；除非实现选择有明确版本限制，否则不固定版本。
- 文件监控列为 P1 可选依赖；P0 使用显式 `connector reload` 即可。
- 新增 `DreamModelPort` / `ModelAssistPort`，统一预算、脱敏、超时、mock 测试；不得直接在 Dream pipeline 内调用供应商 SDK。

## 参考资料
- `.anws/v5/03_ADR/ADR_001_TECH_STACK.md`
- `https://github.com/nodeca/js-yaml`
- `https://github.com/paulmillr/chokidar`

## 影响范围
- `cli-system` - 新 debug 命令实现
- `connector-system` - manifest 解析
- `dream-system` - LLM 调用复用 guidance adapter
