# Wave 116C Code Review — 2026-06-20

## 1. 总结结论

**Partial Pass（静态语义下）。**

Wave 116C 实现了 T-ROS.R.5（插件 tool 注册 + 宿主发现契约 + 显式不可用诊断）、T-CS.R.9（内容承载证据最小契约，ID-only 不伪造摘要）、T-DQ.R.9（Quiet 占位符拒绝 + Dream 精确阻塞原因）的核心路径，并有集成测试覆盖。但存在以下未闭合点：

1. T-ROS.R.5 未提供真正的宿主工具列表探测实现，仅依赖 fail-closed 默认适配器返回 `host_probe_unsupported`。
2. T-DQ.R.9 的 Dream `dream_blocked_validation_failed` 精确原因在类型中声明但未实际产生。
3. 116A/B 遗留的契约漂移（`SourceRefFamily.projection`、CLI setup envelope 非 `RuntimeOpsEnvelope`、closure proof/trace 塞进 `payloadJson`、v8 spine degraded 路径伪造空 cycleId 等）仍未修复，影响 116C 理想循环止血语义。

## 2. 审查范围与静态边界

### 已读

- `.anws/v8/05A_TASKS.md` Wave 116 段落（T-ROS.R.5, T-CS.R.9, T-DQ.R.9, INT-R11）。
- `.anws/v8/05B_VERIFICATION_PLAN.md` §T-ROS.R.5 / T-CS.R.9 / T-DQ.R.9 / INT-R11。
- `.anws/v8/04_SYSTEM_DESIGN/runtime-ops-system.md` §3.1。
- `.anws/v8/04_SYSTEM_DESIGN/connector-system.md`。
- `.anws/v8/04_SYSTEM_DESIGN/dream-quiet-memory-system.md`。
- `.anws/v8/04_SYSTEM_DESIGN/shared-v8-contracts.md`。
- 变更实现：`src/cli/host-capability/host-discovery-port.ts`, `src/cli/commands/index.ts`, `src/connectors/base/normalized-evidence-content.ts`, `src/connectors/evidence-normalizer.ts`, `src/core/second-nature/perception/perception-builder.ts`, `src/core/second-nature/quiet-dream/quiet-daily-review-builder.ts`, `src/core/second-nature/quiet-dream/dream-consolidation-runner.ts`, `src/shared/types/v8-contracts.ts`, `src/shared/degraded-status-classifier.ts`, `plugin/index.ts`。
- 测试：`tests/unit/connectors/normalized-evidence-content.test.ts`, `tests/integration/v8/content-bearing-living-loop.test.ts`, `tests/integration/cli/plugin-workspace-ops-bridge.test.ts`。
- 为验证 provenance/closure/finalizer 接线，额外抽样读取了 `heartbeat-orchestrator.ts`, `policy-bound-dispatch.ts`, `guidance-proposal-consumer.ts`, `loop-stage-event-sink.ts`, `v8-state-stores.ts`, `heartbeat-surface.ts`, `cycle-finalizer.ts`, `daily-rhythm-scheduler.ts`。

### 未执行

- 未运行测试、未执行 `pnpm build`/`typecheck`（用户要求纯静态审查）。
- 未审计所有生产代码中 `proofRefs`/`traceRefs` 使用点，仅抽样验证 116B H-1 是否修复。

## 3. 契约 → 代码映射摘要

| 契约 / 任务承诺 | 静态实现证据 | 状态 |
| --- | --- | --- |
| T-ROS.R.5 — 宿主可见 `second_nature_ops` 或显式不可用诊断 | `plugin/index.ts:1875-1890` 注册 `second_nature_ops` tool；`src/cli/host-capability/host-discovery-port.ts:53-58` 定义 `HostCapabilityDiscoveryPort`；`:84-103` 默认适配器返回 `host_probe_unsupported`；`src/cli/commands/index.ts:113-117` setup_hint 探测并记录 `host-tool-visibility.json` | ⚠️ 契约与 fallback 路径已实现，但无真正宿主 tool list 探测 |
| T-CS.R.9 — 内容承载证据最小契约 | `src/connectors/base/normalized-evidence-content.ts:39-48` 定义 contentStatus/contentMissingReason；`:314-321` ID-only/empty 标记为 `content_missing`；`src/connectors/evidence-normalizer.ts:172-184` 使用新提取器；`src/core/second-nature/perception/perception-builder.ts:174-194` 读取 contentStatus 并标记 contentMissing；`:255` 降低 confidence | ✅ 核心路径已实现 |
| T-DQ.R.9 — Quiet 占位符拒绝 + Dream 精确阻塞原因 | `src/core/second-nature/quiet-dream/quiet-daily-review-builder.ts:184-203` `isPlaceholderReview`；`:386-391` contentStatus 区分 `placeholder_rejected`/`content_missing`/`content_present`；`src/core/second-nature/quiet-dream/dream-consolidation-runner.ts:95-105` 区分 credential/private；`:220-226` 阻塞 placeholder/empty | ⚠️ `dream_blocked_validation_failed` 未实际产生 |
| 116B H-1 修复 — proofRefs 不再混入 sourceRefs | `heartbeat-orchestrator.ts:489-491` / `:501-503` / `:629-631` 分开传 sourceRefs/proofRefs；`policy-bound-dispatch.ts:129-130` / `:146-147` / `:166-167` 分开；`guidance-proposal-consumer.ts:118-119` 分开；`loop-stage-event-sink.ts:153-166` 持久化 proofRefs/traceRefs | ✅ 已修复 |
| EvidenceLevel 封顶 | `host-discovery-port.ts:105-113` setup 证据封顶 `carrier_ack`/`state_present`；`plugin/index.ts:690` setup_hint 为 `contract_smoke`，`:757` setup_ack 为 `carrier_ack` | ✅ 未伪造 `real_runtime` |

## 4. Lens 结果摘要

- **Lens 1 — 契约忠实度：Partial Pass。** T-CS.R.9 与 T-DQ.R.9 核心契约对齐；T-ROS.R.5 仅实现 fallback，真正宿主探测缺失；`SourceRefFamily.projection`、CLI setup envelope 形状、`DegradedOperationResult` 精确状态等 116A/B 遗留漂移仍存在。
- **Lens 2 — 任务兑现与交付闭合：Partial Pass。** 三个任务主路径有代码和测试承接，但 T-ROS.R.5 的“宿主可见”正向路径未实现，T-DQ.R.9 的 validation_failed 原因未产生，INT-R11 报告尚未存在。
- **Lens 3 — 架构适配与复杂度健康：Pass for 116C scope。** Host discovery port、content extractor、Quiet/Dream content gate 边界清晰。116A/B 残留：plugin 重复 setup-ack 校验、closure proof/trace 塞进 `payloadJson`。
- **Lens 4 — 静态运行风险与安全边界：Pass for 116C scope。** ID-only 不生成记忆候选；Dream redaction 拦截 credential/private；host discovery fail-closed。116B 残留：`heartbeat-surface.ts:264-269` v8 spine degraded 路径伪造空 cycleId/cycleSequence。
- **Lens 5 — 验证证据与可观测性：Partial Pass。** `content-bearing-living-loop.test.ts` 覆盖内容承载/ID-only 全流程；`plugin-workspace-ops-bridge.test.ts` T-ROS.R.5 覆盖 fallback 诊断；单元测试覆盖 content extractor。缺：真正宿主 tool list 探测测试、validation_failed Dream 原因测试。
- **Lens 6 — 回流一致性与交接证据：Partial Pass。** `05A_TASKS.md` 中三个任务仍为 `[ ]`（待 116C 闭合后勾选）。116A 残留：setup_hint/setup_ack 未返回 `RuntimeOpsEnvelope`；plugin 与 CLI setup-ack 校验重复。

## 5. Issues

### Critical

无。

### High

#### H-1 | Host Reality Gap — T-ROS.R.5 未实现真正宿主 tool list 探测，仅依赖 fail-closed 默认适配器
- **Severity**: High
- **Lens**: L1 + L2
- **Evidence**: `src/cli/host-capability/host-discovery-port.ts:84-103` 默认适配器直接返回 `status: "unsupported"` / `reason: "host_probe_unsupported"`；`plugin/index.ts:478-522` `buildHostDiscoveryReport` 同样直接返回 unsupported；`src/cli/commands/index.ts:113-117` setup_hint 使用 `createDefaultHostDiscoveryPort()` 而非真实宿主探测。
- **Impact**: 虽然不会错误上报 `real_runtime`，但 `second_nature_ops` 宿主可见性永远只能在 manual host smoke 附录中证明，代码中不存在可注入的宿主探测实现。INT-R11 自动化部分无法验证“宿主工具列表确实包含 second_nature_ops”这一正向路径。
- **Minimum fix**: 提供一个基于 OpenClaw `api` 自省的 `HostCapabilityDiscoveryPort` 实现（例如检查已注册 tool 列表），或在文档中明确说明 carrier 模式下宿主探测由外部 manual smoke 承担，并在 `05B_VERIFICATION_PLAN.md` 中把该任务标记为“必须 manual host evidence”。
- **Anchor**: `04_SYSTEM_DESIGN/runtime-ops-system.md §3.1`；`05B_VERIFICATION_PLAN.md#t-ros-r-5`

### Medium

~~#### M-1 | T-DQ.R.9 未产生 `dream_blocked_validation_failed` 精确阻塞原因~~
**已修复**: `src/core/second-nature/quiet-dream/dream-consolidation-runner.ts` 新增 `validateCandidate`，对空文本、缺少 sourceRefs、confidence < 0.1 的候选标记 `dream_blocked_validation_failed`。

#### M-2 | Dream runner 直接 accept 候选，模糊 candidate → accepted projection 边界
- **Severity**: Medium
- **Lens**: L3
- **Evidence**: `src/core/second-nature/quiet-dream/dream-consolidation-runner.ts:245-266` 在 runner 内部对 `validCandidates` 循环调用 `acceptMemoryProjection`。
- **Impact**: 与设计文档 §4.2 / §8.3 的“Dream/Quiet 决定 accepted projection，state-memory 仅持久化”边界略有偏差；runner 同时承担 candidate generation 与 acceptance，导致单元测试难以独立验证“candidate created but not accepted”状态。
- **Minimum fix**: 将 `acceptMemoryProjection` 调用移出 runner，由 `daily-rhythm-scheduler.ts` 或独立 projection lifecycle 步骤调用；runner 只返回 `candidate` 状态与 `candidateIds`。
- **Anchor**: `04_SYSTEM_DESIGN/dream-quiet-memory-system.md §8.3`

#### M-3 | 116A 残留：CLI `setup_hint`/`setup_ack` 仍返回非 `RuntimeOpsEnvelope` 形状
- **Severity**: Medium
- **Lens**: L1 + L6
- **Evidence**: `src/cli/commands/index.ts:163-171` / `:222-235` 返回对象含 `surfaceMode`、`message`、`data`，缺少 `result`/`degraded`/`generatedAt`。
- **Impact**: T-ROS.R.5/R.7 依赖的宿主现实 envelope 在 CLI 路径仍不标准，host/bridge 消费者可能解析失败。
- **Minimum fix**: 对齐 `RuntimeOpsEnvelope`：payload 放 `result`，降级状态放 `degraded`，增加 `generatedAt`。
- **Anchor**: `04_SYSTEM_DESIGN/runtime-ops-system.md §2`；`wave-116-review.md M-2`

#### M-4 | 116A 残留：Plugin 重复实现 setup-ack 校验
- **Severity**: Medium
- **Lens**: L3 + L6
- **Evidence**: `plugin/index.ts:205-266` 重新定义 `VALID_PLACEMENTS`、`VALID_WRITERS`、`validateSetupAck`，与 `src/shared/setup-ack.ts` 重复。
- **Impact**: setup-ack 规则变更时 CLI 与 plugin 可能不一致。
- **Minimum fix**: 将 `src/shared/setup-ack.ts` 加入 plugin runtime artifacts 并从 plugin 导入共享校验器；若打包限制必须复制，加注释与 CI diff 检查。
- **Anchor**: `wave-116-review.md M-1`

#### M-5 | 116B 残留：closure proofRefs/traceRefs 仍塞进 `payloadJson`
- **Severity**: Medium
- **Lens**: L3
- **Evidence**: `src/storage/v8-state-stores.ts:500-504` 将 `proofRefs`/`traceRefs` 序列化进 `payloadJson`，无独立 schema 列。
- **Impact**: 无法直接查询/索引 closure 的 provenance，长期可维护性差。
- **Minimum fix**: 在 `action_closure_record` schema 增加 `proofRefsJson`/`traceRefsJson` 列，写入接口分离。
- **Anchor**: `04_SYSTEM_DESIGN/shared-v8-contracts.md §2.2`；`wave-116b-mid-review.md M-1`

### Low

#### L-1 | `SourceRefFamily` 含未在设计文档中定义的 `"projection"`
- **Severity**: Low
- **Lens**: L1
- **Evidence**: `src/shared/types/v8-contracts.ts:73` 含 `"projection"`；`04_SYSTEM_DESIGN/shared-v8-contracts.md:47-57` 未列出该 family。
- **Impact**: 消费者无法解析 `sn://projection/{id}`。
- **Minimum fix**: 从类型中移除或更新设计文档并说明语义。
- **Anchor**: `wave-116-review.md L-1`

#### L-2 | `degraded-status-classifier` 多个生产 reason 落入默认 `unavailable`
- **Severity**: Low
- **Lens**: L1 + L5
- **Evidence**: `src/shared/degraded-status-classifier.ts:69-76` 对未列出的 reason 返回 `unavailable`；`05B_VERIFICATION_PLAN.md#t-obs-r-8` 要求精确状态。
- **Impact**: `proposal_risk_blocked`、`execution_failed` 等 reason 在 stage-level 显示为 `unavailable` 而非 `blocked`/`unsafe`。
- **Minimum fix**: 扩展分类表覆盖全部 `V8ReasonCode`，或文档化“未列出默认 unavailable”并补充测试。
- **Anchor**: `wave-116b-mid-review.md M-2`

#### L-3 | 116B 残留：`heartbeat-surface.ts` v8 spine degraded 路径伪造空 cycleId
- **Severity**: Low
- **Lens**: L4
- **Evidence**: `src/cli/ops/heartbeat-surface.ts:264-269` 设置 `cycleId: ""`、`cycleSequence: 0`。
- **Impact**: 下游按空 cycleId 查询 closure 会得到无意义结果。
- **Minimum fix**: 使用 `v8Result` 中已有的 `cycleId`，或返回显式 `v8_spine_degraded` 结构而不填充空字段。
- **Anchor**: `wave-116b-mid-review.md H-3`

## 6. 安全 / 测试覆盖补充

- **无新增密钥 / 外部依赖**：116C 新增代码仅涉及内容提取、宿主发现适配器、Quiet/Dream 内容门，无新增 env var 或网络调用。
- **ID-only 证据不伪造内容**：`perception-builder.ts:255` 对 contentMissing 卡片设置低 confidence，且 `inferSummary` 返回显式“Ref-only”标记而非合成摘要；`dream-consolidation-runner.ts:220-226` 对 placeholder/content_missing Quiet 直接阻塞，不生成记忆候选。
- **Dream redaction 边界**：credential 模式与 private context 模式区分，但正则较简单；是否覆盖所有 PII/credential 变体需运行时验证。
- **宿主发现 fail-closed**：默认适配器不虚构宿主证据，setup 证据封顶 `carrier_ack`/`state_present`，不会晋升到 `real_runtime`。
- **测试缺口**：
  - 缺少真正宿主 tool list 包含 `second_nature_ops` 的自动化断言。
  - 缺少 `dream_blocked_validation_failed` 触发测试。
  - `degraded-status-classifier.test.ts` 未覆盖全部 `V8ReasonCode`。
  - 未验证 `recordLoopStageEvent` 持久化后 `proofRefs` 不进入 `sourceRefsJson`（116B H-1 回归防护）。
