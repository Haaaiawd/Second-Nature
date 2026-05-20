# Connector System — 实现细节 (L1)

> **文件性质**: L1 实现层
> **对应 L0**: [connector-system.md](./connector-system.md)
> 本文件仅在 `/forge` 任务明确引用时加载。日常设计与任务规划优先读取 L0。

---

## 版本历史

| 版本 | 日期 | Changelog |
| --- | --- | --- |
| v1.0 | 2026-05-15 | 初始实现层补充；R5 行数触发 |
| v1.1 | 2026-05-20 | 追加 Behavior Evolution / `connector_behavior_add` 实现细节 |

---

## 本文件章节索引

| § | 章节 | 对应 L0 入口 |
| :---: | --- | :---: |
| §1 | [配置常量](#1-配置常量-config-constants) | L0 §7 / §10 |
| §2 | [完整数据结构补充](#2-核心数据结构完整定义-full-data-structures) | L0 §6 |
| §3 | [核心算法伪代码](#3-核心算法伪代码-non-trivial-algorithm-pseudocode) | L0 §5 |
| §4 | [决策树详细逻辑](#4-决策树详细逻辑-decision-tree-details) | L0 §4 |
| §5 | [边缘情况与注意事项](#5-边缘情况与注意事项-edge-cases--gotchas) | L0 §9 / §11 |
| §6 | [测试辅助](#6-测试辅助-test-helpers) | L0 §11 |

---

## §1 配置常量 (Config Constants)

| Key | Default | Owner | Notes |
| --- | --- | --- | --- |
| `connectors.root` | `.second-nature/connectors` | cli-system / connector-system | workspace 相对路径 |
| `connectors.startupScanLimit` | `50` | connector-system | P0 性能目标基线 |
| `connectors.hotReloadEnabled` | `false` | connector-system | P1，P0 用 manual reload |
| `connectors.allowCustomAdapters` | `false` | owner policy | 默认不执行 workspace code |
| `connectors.defaultConflictPolicy` | `fail_closed` | connector-system | 冲突保留已注册项 |
| `connectors.defaultDryRun` | `true` | cli-system | `connector:test` 默认不副作用 |
| `connectors.behaviorEvolutionEnabled` | `true` | connector-system / cli-system | 允许 Agent 追加 capability 声明，不授予执行代码 |
| `SECOND_NATURE_AGENT_WORLD_BASE_URL` | unset | operator env | Agent World REST origin |
| `SECOND_NATURE_AGENT_WORLD_USERNAME` | `nyx_ha` | operator env / connector-system | `feed.read` 默认 profile username |
| `SECOND_NATURE_AGENT_WORLD_PROFILE_PATH_TEMPLATE` | `/api/agents/profile/{username}` | operator env / connector-system | profile endpoint template；payload `profilePathTemplate` 可覆盖 |

---

## §2 核心数据结构完整定义 (Full Data Structures)

L0 §6 已声明公共字段。实现时应把 v5 的 `ConnectorManifestLike` 作为兼容 view，并在 v6 manifest parser 之后映射到 route planner 消费的最小字段。

---

## §3 核心算法伪代码 (Non-Trivial Algorithm Pseudocode)

### §3.1 `reloadConnectors()`

**对应契约**: L0 §5.1 — `reloadConnectors()`
**准入理由**: 多步骤校验、冲突和 trust 副作用链。

```text
load built-in manifests
scan workspace connector root for manifest.yaml
build new immutable registry snapshot in memory
for each manifest file:
  safe parse yaml
  validate schema
  classify trust status
  if platformId conflict:
    apply fail-closed conflict policy
  else:
    register inventory entry into new snapshot
if snapshot validation complete:
  atomic swap new snapshot as active
else:
  keep previous active snapshot
record inventory audit with errors and conflicts
return reload result
```

Execution paths must never read a half-built registry. `executeCapability()` receives the active immutable snapshot at request start and keeps it for that request.

### §3.2 `executeCapability(request)`

**对应契约**: L0 §5.1 — `executeCapability(request)`
**准入理由**: execution policy 与 evidence mapping 顺序不可颠倒。

```text
resolve platform and capability namespace
load manifest view and trust status
deny if runner not executable
plan route with credential, cooldown, health and policy
enforce idempotency for side-effecting requests
run selected declarative or trusted runner
normalize raw outcome
map source-backed evidence if source refs pass
record connector attempt audit
return ConnectorResult
```

### §3.3 `connectorBehaviorAdd(input)`

**对应契约**: L0 §5.1 — `connectorBehaviorAdd(input)`
**准入理由**: 这是 Agent 写回 connector 行为的入口，必须限制成声明式追加。

```text
normalize platformId and behaviorId
reject empty or ids outside [a-zA-Z0-9_.:-]
resolve workspaceRoot/.second-nature/connectors/{platformId}/manifest.yaml
if manifest missing:
  return ok=false with nextStep=connector_init
safe parse yaml into plain object
read manifest.capabilities as array
if capability id already exists:
  return ok=true, added=false
append { id, optional description, optional channel }
write manifest.yaml back with stable yaml serialization
return ok=true, added=true, nextStep=reload/status
```

The command must not:

- create connector directories by itself
- write credentials or secrets
- change runner kind, trust policy, base URL, allowlist, or executable code
- infer that a capability is safe to execute

Heartbeat / Quiet can call this when they notice a repeated useful action such as `github:issue.search` or `agent-world:profile.inspect`. Execution only becomes possible after the existing registry, route planner, credential, and trust checks accept the manifest.

---

## §4 决策树详细逻辑 (Decision Tree Details)

### §4.1 Trust Classification

Declarative HTTP/A2A/MCP runners can be executable after schema validation. `custom_adapter`, `skill`, and `browser` runners are `custom_adapter_pending_trust` unless owner allowlist or future signature verification marks them trusted.

### §4.2 Conflict Policy

Default conflict policy is fail-closed:

1. Built-in entry wins over workspace entry.
2. First registered trusted entry wins over later duplicate.
3. Owner override requires explicit config and trusted source.
4. Every skipped conflict is visible in inventory and observability.

### §4.3 Behavior Evolution Promotion

Behavior Evolution is a local memory move, not an execution grant:

1. Agent notices a repeated action that is not present in the active connector manifest.
2. Agent records the behavior via `connector_behavior_add`.
3. The manifest gains a new `capabilities[]` item.
4. Registry reload/status makes the capability visible.
5. Actual execution still depends on runner support, credentials, idempotency and trust.

If the platform lacks a manifest, the right next step is `connector_init`, because a behavior without a platform boundary is too vague to route safely.

---

## §5 边缘情况与注意事项 (Edge Cases & Gotchas)

| 场景 | 风险 | 处理方式 |
| --- | --- | --- |
| YAML parser accepts executable tags | Code execution | Use safe parse and schema-only output |
| Duplicate `platformId` | Connector hijack | Fail-closed and record conflict |
| Custom adapter registered | Workspace code execution | Pending trust, not executable |
| Unscoped capability ambiguous | Wrong platform call | Reject unless platformId explicit |
| Reload during execution | Half-registered route | Atomic immutable snapshot per request |
| Side effect retry without idempotency | Duplicate external action | Terminal policy failure |
| `connector:test` hits write path | Accidental platform mutation | Dry-run/read-only default |
| Unknown behavior is executed immediately after registration | Unsafe side effect | Registration does not bypass route planner or trust policy |
| Agent invents too many one-off capability ids | Manifest noise | Heartbeat prompt should prefer repeated, reusable actions with short rationale |
| Behavior id contains free text | YAML/route ambiguity | Strict id regex; prose belongs in `description` |

---

## §6 测试辅助 (Test Helpers)

Recommended fixtures:

- `makeManifest({ platformId, runnerKind, capabilities })`
- `makeInvalidManifest({ missingField })`
- `makeRegistryWithBuiltIns()`
- `makeWorkspaceConnectorTree()`
- `makeCredentialContext({ status })`
- `makeConnectorRunner({ result, latencyMs })`
- `makeBehaviorEvolutionManifest({ platformId, capabilities })`
