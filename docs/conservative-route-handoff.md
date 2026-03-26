# Conservative Route Prompt Draft

> 用途：这是给后续助手使用的“提示词草案 / 恢复模板”，不是架构真相源。
> 人类可以继续编辑、裁剪、补充。

## 1. 当前执行策略

- 采用保守路线，不主动扩范围
- 已签收：Wave 14、Wave 15
- 不主动回头修 Wave 14 / Wave 15 的非阻塞问题
- 不主动处理 plugin id mismatch warning，除非人类明确下任务
- 下一步优先考虑 milestone 验证，而不是继续做零散优化

## 2. 当前已知状态

- Source of Truth：`.anws/v2`
- 当前宿主相关验证已通过到以下程度：
  - plugin install：通过
  - plugin enable：通过
  - plugin list：`second-nature` loaded
  - plugin info：tool / cli / services 可见
  - plugin doctor：`No plugin issues detected`
- 当前仍存在但不阻塞的 warning：
  - plugin id mismatch warning

## 3. 后续助手开始前必须恢复的上下文

### L0：流程锚点
- `AGENTS.md`
- `.opencode/commands/forge.md`

### L1：真相源
- `.anws/v2/02_ARCHITECTURE_OVERVIEW.md`
- `.anws/v2/05_TASKS.md`
- `.anws/v2/06_CHANGELOG.md`

### L2：关键设计文档
- `.anws/v2/04_SYSTEM_DESIGN/cli-system.md`
- `.anws/v2/04_SYSTEM_DESIGN/state-system.md`

### L3：Wave 14 关键实现（只用于恢复，不要重做）
- `src/cli/index.ts`
- `src/cli/commands/index.ts`
- `src/cli/commands/policy.ts`
- `src/cli/commands/credential.ts`
- `src/cli/action-bridge.ts`
- `src/cli/read-models/index.ts`
- `src/cli/read-models/types.ts`
- `src/cli/explain/resolve-subject.ts`
- `src/cli/explain/format-explanation.ts`
- `src/storage/state-api.ts`
- `src/storage/db/schema/policies.ts`
- `src/storage/repositories/policy-repository.ts`
- `tests/integration/cli/cli-ops-surface.test.ts`

### L4：Wave 15 关键实现（只用于恢复，不要重做）
- `plugin/index.ts`
- `plugin/package.json`
- `plugin/openclaw.plugin.json`
- `scripts/plugin-smoke-check.ts`
- `tests/integration/cli/plugin-packaging-walkthrough.test.ts`
- `docs/operator-walkthrough.md`
- `tsconfig.json`

## 4. 本机 OpenClaw / QClaw 测试信息

### QClaw 路径
- `D:\QClaw`

### 可用的 OpenClaw CLI 入口
- `D:\QClaw\resources\openclaw\node_modules\openclaw\openclaw.mjs`

### 推荐隔离 profile
- `--profile qclaw-plugin-test`

### 已验证有用的命令模板

```bash
node "D:\QClaw\resources\openclaw\node_modules\openclaw\openclaw.mjs" --profile qclaw-plugin-test plugins install file:./plugin
node "D:\QClaw\resources\openclaw\node_modules\openclaw\openclaw.mjs" --profile qclaw-plugin-test plugins enable second-nature
node "D:\QClaw\resources\openclaw\node_modules\openclaw\openclaw.mjs" --profile qclaw-plugin-test plugins list
node "D:\QClaw\resources\openclaw\node_modules\openclaw\openclaw.mjs" --profile qclaw-plugin-test plugins info second-nature
node "D:\QClaw\resources\openclaw\node_modules\openclaw\openclaw.mjs" --profile qclaw-plugin-test plugins doctor
```

### 说明
- 不要用系统里不存在的 `openclaw` 命令瞎试
- 默认优先用上面的 QClaw 内置 OpenClaw CLI 做宿主验证
- 若后续换机器或路径变化，人类应先更新本节

## 5. 不要做的事

- 不要擅自新增任务
- 不要擅自修改 `.anws/` 设计文档
- 不要把“技术债记录”写成新任务，除非人类批准
- 不要回头优化 Wave 14 / Wave 15 的非阻塞项
- 不要顺手整理 `workspace/`
- 不要把 QClaw 预检和 OpenClaw 正式设计口径混为一谈；只在宿主兼容验证场景下使用本机 CLI 信息

## 6. 推荐下一步方向

默认优先顺序：

1. `INT-S1`
2. `INT-S2`
3. `INT-S3`
4. `INT-S4`

如人类另有指示，以人类为准。

## 7. 可直接复用的提示词骨架

下面这段是可复制给后续助手的起始提示词骨架，人类可继续修改：

```text
先不要直接编码，先恢复上下文。

必须读取：
- AGENTS.md
- .opencode/commands/forge.md
- .anws/v2/02_ARCHITECTURE_OVERVIEW.md
- .anws/v2/05_TASKS.md
- .anws/v2/06_CHANGELOG.md
- docs/conservative-route-handoff.md

然后按 handoff 文件中的 L2/L3/L4 清单继续读取相关设计文档与代码。

执行原则：
- 严格按 /forge
- 不扩范围
- 不处理 handoff 中明确标记为“不要做”的事项
- 如遇文档冲突、前置产物不符或需要新依赖，立即停下报告
```

## 8. 人类调优备注区

> 在这里补充未来的路径变化、宿主环境差异、额外检查命令或新的保守策略。
