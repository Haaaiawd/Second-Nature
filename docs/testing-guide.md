# Second Nature v8 — 测试指南

> **版本**: v8.0 (0.2.0)  
> **目标读者**: 开发者、QA、Claw Agent  
> **最后更新**: 2026-06-03  
> **验收标准**: 工具返回 JSON 为准，不凭口头推断

---

## 0. 测试哲学

**信任，但要验证。**

v8 Living Perception Loop 的测试分层遵循一个原则：**每个层级的测试都验证其层级该验证的东西，不越级，不偷懒。**

| 层级 | 验证什么 | 不验证什么 |
|------|----------|-----------|
| 单元测试 | 纯函数、状态机、reason code 选择 | 数据库持久化、跨系统调用 |
| 集成测试 | 跨系统数据流、持久化 round-trip | 真实外部平台、模型推理 |
| API 功能测试 | CLI/OpenClaw ops 请求/响应契约 | UI 渲染、浏览器行为 |
| 冒烟测试 | 关键路径可运行、不产生未处理异常 | 边界条件、异常负载 |
| E2E 测试 | 全链数据流：connector → evidence → perception → judgment → action → closure → Quiet → Dream → projection → context | 不覆盖所有组合，只验证代表性 fixture |
| 回归测试 | v7 已有能力不被破坏 | 新增功能（由上层覆盖） |

**Risk closure beats test count.** 代表性 fixture 优先于全组合矩阵。

---

## 1. 前置条件

### 1.1 开发环境

```bash
# Node.js >= 20
node --version

# pnpm >= 10
pnpm --version

# 依赖安装
pnpm install
```

### 1.2 环境变量

```bash
# 必需
export SECOND_NATURE_ENCRYPTION_KEY="your-32-char-key-here"
export SECOND_NATURE_WORKSPACE_ROOT="/path/to/workspace"

# 可选（测试时通常不配置）
# export OPENCLAW_API_KEY="..."
```

### 1.3 验证安装

```bash
pnpm typecheck   # 应为 0 errors
pnpm build       # 应为成功
pnpm build:plugin # plugin/package.json 版本应与根目录一致
```

---

## 2. 测试结构

```
tests/
├── unit/                    # 单元测试 — 隔离验证单个模块
│   ├── contracts/           # 共享契约（v8-contracts）
│   ├── connectors/          # Evidence normalization
│   ├── perception/          # Sensitivity + Perception builder
│   ├── judgment/            # Judgment engine
│   ├── action/              # Proposal + Policy + Dispatch + Closure
│   ├── body/                # Affordance side effects
│   ├── quiet/               # Quiet daily review
│   ├── dream/               # Dream scheduler + consolidation + projection
│   ├── observability/       # Loop stage event + causal health + loop status + diagnostic redaction
│   ├── guidance/            # Guidance proposal consumption
│   └── storage/             # v8 state stores
├── integration/v8/          # v8 集成测试 — 跨模块契约验证
│   ├── loop-status-integration.test.ts
│   └── living-perception-loop.test.ts
└── api/                     # API 功能测试（预留）
    └── runtime-ops/
```

---

## 3. 单元测试

### 3.1 运行命令

```bash
# 全部单元测试
node --test dist/tests/unit/**/*.test.js

# 单个模块
node --test dist/tests/unit/observability/loop-status.test.js
node --test dist/tests/unit/guidance/guidance-proposal-consumer.test.js
```

### 3.2 编写规范

**使用 Node.js 原生 test runner：**

```typescript
import { describe, it } from "node:test";
import assert from "node:assert";

describe("模块名", () => {
  describe("功能场景", () => {
    it("描述验收标准", () => {
      // Arrange
      const input = makeFixture();

      // Act
      const result = functionUnderTest(input);

      // Assert
      assert.strictEqual(result.ok, true);
      assert.ok(result.someField);
    });
  });
});
```

**Fixture 工厂模式：**

```typescript
function makeProposal(overrides?: Partial<ActionProposal>): ActionProposal {
  return {
    id: "proposal_001",
    cycleId: "cycle_001",
    actionKind: "draft_reply",
    sourceRefs: [makeSourceRef()],
    // ... 默认值
    ...overrides,
  };
}
```

**Mock DB 约定：**

```typescript
const MOCK_DB = {} as any;  // 用于验证 degraded 路径
```

**禁止：**
- 不要在单元测试中调用真实数据库（用 mock 或 undefined 验证 degraded 路径）
- 不要测试第三方库的行为
- 不要为 getter/setter 写无意义测试

### 3.3 每个模块的最小测试集

| 模块 | 必测场景 |
|------|---------|
| 共享契约 | valid/invalid shape、enum 兼容性、required 字段缺失 |
| State stores | 写入/读取 round-trip、source ref 缺失拒绝、degraded 响应形状 |
| Loop stage event sink | valid event append、malformed event degraded、redaction class |
| Causal loop health | no_data、stalled（按 cycleSequence）、degraded（state unreadable） |
| Diagnostic redaction | credential shape → blocked、public technical → preserve、private context → redacted、归因分类 |
| Guidance consumer | allow → GuidanceOutput、deny/defer → degraded、missing source refs → degraded |
| Sensitivity classifier | public_technical vs credential-shaped、context signal |
| Perception builder | 正常生成、空 batch、model timeout 降级 |
| Judgment engine | high relevance → verdict、low confidence → ignore、missing source refs → blocked |
| Policy evaluator | allow/defer/downgrade/deny 表格、side-effect class 映射 |
| Action closure | completed/denied/deferred/downgraded/failed、idempotency、guidance_unavailable 降级 |
| Quiet review | 正常聚合、empty input、redaction blocked |
| Dream scheduler | scheduled/started/completed/failed/blocked/unavailable |
| Dream consolidation | rules-only/model-assisted、redaction gate、validation |
| Memory projection | accept/supersede/reject/retire、candidate direct-write 拒绝 |

---

## 4. 集成测试

### 4.1 运行命令

```bash
node --test dist/tests/integration/v8/**/*.test.js
```

### 4.2 编写规范

集成测试验证**跨系统数据流和接口契约**，不验证内部实现细节。

**契约验证风格（推荐）：**

```typescript
describe("INT-V8: full living perception loop", () => {
  describe("contract registry completeness", () => {
    it("has action kinds for all loop stages", () => {
      const kinds = Object.keys(ACTION_KIND_REGISTRY);
      assert.ok(kinds.includes("remember"));
      assert.ok(kinds.includes("run_connector"));
    });
  });
});
```

**Ops Router 集成风格：**

```typescript
it("returns degraded envelope when state is unavailable", async () => {
  const router = createOpsRouter({ runtimeAvailable: true, state: undefined });
  const result = await router.dispatch("loop_status", {});
  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.command, "loop_status");
});
```

### 4.3 v8 集成测试清单

| 测试 | 验证内容 |
|------|---------|
| `loop-status-integration.test.ts` | ops-router 命令路由、degraded envelope 形状、RuntimeOpsEnvelope 字段 |
| `living-perception-loop.test.ts` | ACTION_KIND_REGISTRY 完整性、stage event sink 验证、归因分类、GuidanceOutput 契约、降级路径 shape |

---

## 5. API 功能测试

API 测试验证 **CLI/OpenClaw ops surface 的请求/响应契约**，通常需要真实或内存数据库。

### 5.1 预留位置

```
tests/api/runtime-ops/loop-status-command.test.ts
```

### 5.2 编写规范

```typescript
// API 测试模板（待实现）
import { createOpsRouter } from "../../../src/cli/ops/ops-router.js";
import { createInMemoryState } from "../../helpers/in-memory-state.js"; // 如需

describe("API: loop_status", () => {
  it("returns healthy with full stage chain", async () => {
    const state = await createInMemoryState();
    // 写入 fixture data
    await writeHeartbeatCycleTrace(state, makeCycleTrace());
    await writeLoopStageEvent(state, makeStageEvent("ingestion"));
    await writeLoopStageEvent(state, makeStageEvent("perception"));
    // ...

    const router = createOpsRouter({ runtimeAvailable: true, state });
    const result = await router.dispatch("loop_status", {});

    assert.strictEqual(result.ok, true);
    assert.strictEqual(result.data.overallStatus, "healthy");
    assert.ok(result.data.nextAction);
  });
});
```

**注意**：当前项目中 API 测试层尚未建立，如需添加，应遵循：
- 每个 ops command 一个 test file
- before/after 状态断言
- degraded 路径覆盖
- 不测试内部实现，只测试 envelope shape

---

## 6. E2E 测试

### 6.1 定义

v8 的 E2E 测试**不是浏览器自动化**。它是：

> 从真实 connector read fixture 出发，经过完整的 Living Perception Loop，验证 accepted projection 出现在下一个 EmbodiedContext 中。

### 6.2 运行方式

```bash
# 方法 1: 使用集成测试 + fixture 数据
node --test dist/tests/integration/v8/living-perception-loop.test.js

# 方法 2: 手动 E2E（通过 OpenClaw）
# 见 6.4

# 方法 3: 全量回归（最接近生产）
pnpm test
```

### 6.3 Fixture 驱动的 E2E

**推荐使用 fixture 驱动而非真实平台调用**：

```typescript
// E2E fixture 示例
const E2E_FIXTURE = {
  // 1. Connector read 结果
  connectorResults: [makeMoltBookFeedResult(3)],

  // 2. 期望的 EvidenceItem 数量
  expectedEvidenceCount: 3,

  // 3. 期望的 PerceptionCard 主题
  expectedTopics: ["tech_news", "community_update"],

  // 4. 期望的 JudgmentVerdict actionKind
  expectedActionKind: "remember",

  // 5. 期望的 Closure status
  expectedClosureStatus: "completed",

  // 6. 期望的 Quiet review 包含记忆候选
  expectedMemoryCandidates: 1,

  // 7. 期望的 Dream projection 状态
  expectedProjectionStatus: "active",
};
```

**为什么用 fixture 而不是真实调用？**
- 外部平台（MoltBook、Agent World）可能不稳定或需要凭证
- E2E 验证的是**数据流正确性**，不是**平台可用性**
- 真实平台测试交给 connector smoke test（`near_real_smoke`）

### 6.4 手动 E2E（通过 OpenClaw）

当集成测试全部通过后，通过 OpenClaw 进行手动 E2E 验证：

**Step 1 — 检查基础健康**

```json
{
  "command": "loop_status"
}
```

预期：`ok: true`，`overallStatus` 为 `healthy` 或 `no_data`。

**Step 2 — 触发 heartbeat（非 probeOnly）**

```json
{
  "command": "heartbeat_check"
}
```

预期：`status` 不为 `runtime_carrier_only`，`reasons` 包含 `"heartbeat_completed"` 或具体 action reason。

**Step 3 — 验证 loop_status 更新**

再次 `loop_status`，检查 `lastCycleSequence` 递增。

**Step 4 — 检查 Quiet/Dream 状态**

```json
{
  "command": "quiet",
  "args": { "scope": "recent" }
}
```

```json
{
  "command": "dream:recent",
  "args": { "limit": 3 }
}
```

**Step 5 — 验证 closure 记录**

```json
{
  "command": "audit"
}
```

检查最近 cycle 有 closure event。

**Step 6 — 长期观察（可选）**

运行 2-3 个完整 cycle，验证：
- Evidence → Perception 在 2 个 heartbeat 内完成
- `loop_status` 不出现 `stalledAt=perception`（除非故意构造 empty input）
- Quiet review 在 36h 窗口后触发

### 6.5 E2E 验收检查清单

| # | 检查项 | 验收方式 |
|---|--------|----------|
| E2E-1 | connector read 产生 EvidenceItem | state DB 有 `evidence_item` 行 |
| E2E-2 | EvidenceItem 进入 PerceptionCard | `perception_card` 表有对应行 |
| E2E-3 | PerceptionCard 进入 JudgmentVerdict | `judgment_verdict` 表有对应行 |
| E2E-4 | Judgment 进入 ActionProposal + Policy | `action_closure_record` 有 closure 行 |
| E2E-5 | `remember` verdict 进入 Quiet review | `quiet_daily_review` 有对应 day 的行 |
| E2E-6 | Quiet 触发 Dream | `dream_consolidation_run` 有 scheduled/started/completed |
| E2E-7 | Dream 产生 candidate projection | `long_term_memory_projection` 有 candidate 行 |
| E2E-8 | Accepted projection 可被加载 | `loop_status` 或 `status` 显示 projection loaded |
| E2E-9 | `loop_status` 不谎报 healthy | stalled 时返回 `overallStatus=stalled` + `stalledAt` |
| E2E-10 | 降级路径不阻塞 closure | guidance unavailable 时仍有 `closure_downgraded_without_draft` |

---

## 7. 冒烟测试

### 7.1 Sprint 里程碑冒烟

每个 Sprint 结束时运行：

```bash
# S1
node --test dist/tests/unit/contracts/v8-shared-contracts.test.js
node --test dist/tests/unit/storage/v8-state-stores.test.js

# S2
node --test dist/tests/unit/connectors/evidence-normalizer.test.js
node --test dist/tests/unit/perception/*.test.js
node --test dist/tests/unit/judgment/judgment-engine.test.js

# S3
node --test dist/tests/unit/action/*.test.js
node --test dist/tests/unit/body/affordance-side-effect.test.js

# S4
node --test dist/tests/unit/quiet/*.test.js
node --test dist/tests/unit/dream/*.test.js

# S5
node --test dist/tests/unit/observability/*.test.js
node --test dist/tests/unit/guidance/*.test.js
node --test dist/tests/integration/v8/*.test.js
```

### 7.2 快速冒烟（开发时）

```bash
pnpm typecheck && node --test dist/tests/unit/observability/loop-status.test.js
```

---

## 8. 回归测试

### 8.1 全量回归

```bash
pnpm test
```

这会执行：
1. `pnpm build` — TypeScript 编译
2. `pnpm build:plugin` — 插件包构建
3. `node --test dist/tests/**/*.test.js` — 全部测试

### 8.2 增量回归

只运行与变更相关的测试：

```bash
# 改了 observability
node --test dist/tests/unit/observability/*.test.js
node --test dist/tests/integration/v8/loop-status-integration.test.js

# 改了 guidance
node --test dist/tests/unit/guidance/*.test.js
```

### 8.3 回归门标准

| 指标 | 通过标准 |
|------|---------|
| 编译 | 0 errors |
| 单元测试 | 全部 pass |
| 集成测试 | 全部 pass |
| 历史回归 | 无新增失败 |
| 插件构建 | 成功，版本一致 |

---

## 9. CI/CD 建议

```yaml
# .github/workflows/test.yml 示例
name: Test
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'
      - run: pnpm install
      - run: pnpm typecheck
      - run: pnpm test
      - run: pnpm build:plugin
```

---

## 10. 常见问题

**Q: 测试报 `Cannot find module`？**
A: 先运行 `pnpm build`。测试运行的是 `dist/` 下的编译产物，不是 `src/`。

**Q: 集成测试需要真实数据库吗？**
A: 不需要。集成测试验证的是接口契约和数据流方向，使用 mock DB `{} as any` 或内存数据库即可。

**Q: API 测试在哪里？**
A: 当前项目中 `tests/api/` 目录为空。如需添加，参考 5.2 模板，使用内存 SQLite 或真实 SQLite 文件。

**Q: E2E 测试需要浏览器吗？**
A: 不需要。v8 E2E 是 fixture 驱动的全链数据流验证，不依赖浏览器。如需 UI 测试，属于另一个层级的 concern。

**Q: `pnpm test` 太慢？**
A: 开发时只运行相关模块的测试：`node --test dist/tests/unit/目标模块/*.test.js`。全量回归只在发版前运行。

---

## 11. 参考文档

- `05B_VERIFICATION_PLAN.md` — 详细验证计划
- `05A_TASKS.md` — 任务清单和验收标准
- `docs/claw-v7-ops-testing-guide.md` — v7 Claw 测试指南（OpenClaw 手动测试）
- `docs/validation/e2e-t1-1-4-workspace-bridge-and-host-verification.md` — Workspace Bridge E2E
