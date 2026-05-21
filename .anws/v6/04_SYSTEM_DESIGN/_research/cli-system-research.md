# 探索报告: cli-system v6 Agent-facing Ops Surface

**日期**: 2026-05-15  
**探索者**: GPT-5.5 / Nyx  
**系统**: `cli-system`

---

## 1. 问题与范围

**核心问题**: `cli-system` 如何把 v6 的 NarrativeState、Dream、Connector Ecosystem、goal 与 observability explain 以 JSON-first、host-safe、operator-readable 的方式暴露给 owner/agent，同时不把 command surface 变成新的业务控制面。

**范围内**: `sn narrative`、`goal`、`dream:recent`、`connector:status`、`connector:test`、`connector init`、`cycle:recent`、`second_nature_ops` JSON 契约、host-safe carrier 降级语义、read model 映射。  
**范围外**: goal priority 决策、connector 执行实现、Dream pipeline、audit ledger schema。

---

## 2. 核心洞察

1. **cli-system 是可见性与受控入口，不是 agent brain**: CLI/tool 可以展示状态、设置 owner goal、触发 dry-run 或 reload，但不决定 heartbeat 意图。
2. **JSON-first 契约必须延续**: `second_nature_ops` 是 agent-facing tool，输出需要稳定 machine-readable 字段；人类文本只是 formatter。
3. **status 需要聚合三类真相**: state 的当前状态、observability 的解释链、connector registry 的 inventory，而不是单一 DB 表。
4. **host-safe carrier 不能声称 full runtime**: plugin host 中能返回命令结果，不等于 Dream、connector、state 都真实可用。
5. **connector:test 必须默认 dry-run**: 动态 connector 生态扩大后，ops 命令不能偷偷触发外部副作用。

---

## 3. 详细发现

### 3.1 v5 ops surface 可以演进，不需要重写

v5 已有 `second_nature_ops`、workspace bridge、status/explain/audit/fallback/capability_probe。v6 应扩展 command set 和 read models，保持同构 CLI/tool 路由。

**来源**: `.anws/v5/04_SYSTEM_DESIGN/cli-system.md`

### 3.2 narrative 和 dream 命令必须读 accepted/read-model

`sn narrative` 应读取 current NarrativeState 和 NarrativeTrace summary。`dream:recent` 应读取 DreamTrace 与 accepted/candidate lifecycle summary。二者都不能把 raw prompt/model output 展示出来。

**来源**: `state-system.md`, `observability-system.md`

### 3.3 connector:status 依赖 inventory，不依赖 attempt

DR3-01 已指出 ConnectorInventoryAudit 缺任务承接。CLI 的 `connector:status` 必须展示扫描数量、registered/skipped/conflict、trust/executable，而 `connector:test` 才展示 dry-run attempt。

**来源**: `observability-system.md` §4.4, `connector-system.md`

### 3.4 goal 命令是 owner intent 输入，不是自动授权绕道

`goal set` 可以写 owner-set goal；`goal propose` 或 agent proposal 只能展示/确认。CLI 必须把 proposal/accepted/rejected 状态说清楚，避免用户以为 agent 自己已经获得授权。

---

## 4. 方案清单

| 方案 | 可行性 | 风险 | 推荐度 |
| --- | :---: | --- | :---: |
| A. 扩展现有 OpsRouter，所有新命令复用 read model / command result envelope | 高 | 路由表更大 | 推荐 |
| B. 为 Dream/Connector/Narrative 分别做独立 CLI | 中 | surface 分裂，OpenClaw tool 不一致 | 不推荐 |
| C. status 直接读底层 artifacts | 中 | 脱敏和 truth source 容易漂移 | 不推荐 |
| D. connector:test 默认真实执行 | 低 | 外部副作用风险高 | 不推荐 |

---

## 5. 行动建议

| 优先级 | 建议 | 理由 |
| :---: | --- | --- |
| P0 | 定义 v6 `OpsCommandEnvelope`，每个命令带 `runtimeMode`、`data`、`warnings`、`sourceRefs` | 防 host-safe/full runtime 混淆 |
| P0 | `sn narrative` 同时展示 state + trace summary | 支撑 REQ-006 和 DR3-01 |
| P0 | `connector:status` 读取 ConnectorInventoryAudit/read model | 避免只看 attempt telemetry |
| P0 | `connector:test` 默认 dry-run，并要求显式 allow 才有副作用 | 动态 connector 安全底线 |
| P1 | `cycle:recent` 聚合 heartbeat decision、narrative change、Dream trigger | 提升人类可感知存在感 |

---

## 6. 局限性与待探索

- 本报告不定义终端 UI 版式；实现阶段应先稳住 JSON schema，再做 formatter。
- OpenClaw 当前工具枚举与 host bridge 可见性仍需真实宿主验证。
- Connector SDK 生成模板细节由 connector-system/forge 承接。

---

## 7. 参考来源

1. `.anws/v6/01_PRD.md`
2. `.anws/v6/02_ARCHITECTURE_OVERVIEW.md`
3. `.anws/v6/03_ADR/ADR_001_TECH_STACK.md`
4. `.anws/v6/03_ADR/ADR_002_CONNECTOR_ECOSYSTEM.md`
5. `.anws/v6/03_ADR/ADR_003_AGENT_SELF_LAYER.md`
6. `.anws/v6/04_SYSTEM_DESIGN/state-system.md`
7. `.anws/v6/04_SYSTEM_DESIGN/observability-system.md`
8. `.anws/v5/04_SYSTEM_DESIGN/cli-system.md`

