# observability-health-system Research

## 1. 问题与范围

| 子问题 | 方向 | 预期产出 |
| --- | --- | --- |
| loop health 应该解释哪些阶段？ | 混合 | 定义 ingestion/perception/judgment/policy/execution/closure/Quiet/Dream/projection stage model。 |
| heartbeat ok 为什么不足？ | 本地证据 | 明确 process health 与 causal progression 的差异。 |
| redaction、audit、trace 如何服务诊断？ | 混合 | 定义 stage event、stall reason 与 redacted read model。 |

不包含：runtime ops command 注册、state schema 细节、外部 dashboard。

## 2. 核心洞察

1. `loop_status` 必须回答“卡在哪一段”，而不是只返回 heartbeat 是否运行。
2. 每个关键系统都要发出最小 stage event；缺 event 本身就是 degraded health。
3. sensitivity block 需要归因到 storage validation、Dream redaction 或 policy denial，否则用户会误判故障来源。

## 3. 详细发现

### Causal Stage Model

`.anws/v8/03_ADR/ADR_005_CAUSAL_LOOP_HEALTH.md` 明确采用 causal loop health read model，阶段包括 ingestion、perception、judgment、policy、execution、closure、Quiet、Dream、projection。PRD [REQ-008] 要求构造 evidence 已入库但 perception 未生成时返回 `stalled_at: perception`。

### v7 Health Gap

`.anws/v8/00_DEEPWIKI_MECHANISM_AUDIT.md` 指出用户可看到 heartbeat ok，但 daily diary 和 dream output 仍为空。v8 health 必须从 process status 升级为 life progression status。

### Audit/Redaction 边界

Observability 统一 audit、redaction、trace、self-health、digest，但不拥有业务判断。它读取 stage facts、归纳 health 和暴露 redacted diagnostics。

## 4. 创意/方案表

| 方案 | 判定 | 理由 |
| --- | --- | --- |
| 扩展现有 self-health counters | 拒绝 | 只能看症状，不能证明因果断点。 |
| 每个系统各自暴露 health | 拒绝 | 用户仍要人工拼链路。 |
| 统一 stage event + causal read model | 采纳 | 直接满足 ADR-005 与 [REQ-008]。 |

## 5. 行动建议

- L0 文档应定义 `LoopStageEvent`、`CausalLoopHealthSnapshot` 和 stage-specific stall reason taxonomy。
- L0 文档应要求 `loop_status` 在 state 不可读时返回 degraded，而不是 healthy。

## 6. 局限与待探

无阻塞缺口；具体 freshness threshold 应在 `/blueprint` 里按 heartbeat cadence 配置化。

## 7. 参考来源

- `.anws/v8/01_PRD.md` [REQ-006], [REQ-007], [REQ-008], [REQ-009]
- `.anws/v8/02_ARCHITECTURE_OVERVIEW.md` System 10
- `.anws/v8/03_ADR/ADR_005_CAUSAL_LOOP_HEALTH.md`
- `.anws/v8/03_ADR/ADR_002_LIVING_PERCEPTION_LOOP.md`
- `.anws/v8/00_DEEPWIKI_MECHANISM_AUDIT.md` §4.8, §7

Skill harvesting 未使用；本轮依据 v8 本地 genesis 产物与机制审计收敛。
