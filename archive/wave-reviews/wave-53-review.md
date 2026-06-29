# Wave 53 Review — T-BTS.C.1 + T-BTS.C.2

## 最高严重度

none

## 变更清单

| 文件 | 变更 |
|------|------|
| `src/shared/types/v7-entities.ts` | 新增 Affordance 类型段（AffordanceStatus、AffordanceItem、AffordanceMap、AffordanceContextScope）；更新 EmbodiedContext.affordanceMap 类型 |
| `src/core/second-nature/body/tool-affordance/affordance-context-scope.ts` | 新增：过滤逻辑（platformIds 白名单、goalKind 意图过滤、allowedStatuses 默认 safe+exploratory、unavailable 始终排除） |
| `src/core/second-nature/body/tool-affordance/affordance-assembler.ts` | 新增：assembleAffordanceMap（probe→affordance 状态映射 + TTL 缓存 + invalidateCache） |
| `tests/unit/body/affordance-context-scope.test.ts` | 新增：7 个单元测试 |
| `tests/unit/body/affordance-assembler.test.ts` | 新增：10 个单元测试 |

## 回归检查

- `node --test dist/tests/unit/body/*.test.js` — 17/17 pass
- 无预先存在失败

## 测试矩阵

| 测试文件 | 通过 | 失败 |
|---------|:----:|:----:|
| `tests/unit/body/affordance-context-scope.test.ts` | 7 | 0 |
| `tests/unit/body/affordance-assembler.test.ts` | 10 | 0 |
| **合计** | **17** | **0** |

## 设计一致性

- T-BTS.C.2: `applyAffordanceContextScope` 纯函数，无副作用
  - `DEFAULT_ALLOWED_STATUSES = ['safe', 'exploratory']`
  - `unavailable` 始终被排除（BLOCKED_STATUSES）
  - `passive_sensing` 仅保留 read-only intents（feed.read/notification.list/work.discover）
  - `task_completion` 不过滤意图（上层 assembler 可排序）
  - 空 `platformIds` = 全部平台
- T-BTS.C.1: `createAffordanceAssembler` 依赖注入 registry + probeReader
  - 映射规则：available→safe, degraded→exploratory, unavailable→unavailable
  - 无 probe + credential 需要 → needs_auth
  - 无 probe + 不需要 credential → unavailable
  - TTL 缓存（默认 30s），key 由序列化 scope 生成
  - `invalidateCache()` 清除缓存
  - P95 < 1s for 50 manifests 测试通过（实际 ~1.5ms）

## 安全与治理

- credentialRequired 由调用方注入，assembler 不直接读取 credential store
- needs_auth 状态项默认被过滤，避免未认证 capability 暴露给消费端

## 下一步

- Wave 54: T-BTS.C.4 (ExperienceWriter + ProbeSignalAdapter + getPainSignal) + T-BTS.C.5 (CircuitBreakerManager)
