# INT-S3 — S3 Body Tool + Heartbeat 集成验证报告

**项目**: Second Nature v7
**日期**: 2026-05-23
**验证者**: /forge Wave 58
**状态**: ✅ PASS

---

## 1. 范围与目标

验证 S3 退出标准（Body Tool + Heartbeat）：
- C1: affordance map 正确过滤 5 类状态（safe, exploratory, unavailable, needs_auth, blocked/pending_trust）
- C2: heartbeat 组装 EmbodiedContext 含 5 类 state-memory slice（identity, goals, recentInteractions, toolExperience, acceptedDream）
- C3: CircuitBreaker cooldown / halfopen / closed 三态可验证，且影响 heartbeat guard 评估
- C4: IdleCuriosityPolicy 只选择 read-only 意图，无副作用执行

---

## 2. 测试材料

| 测试文件 | 类型 | 用例数 | 关键覆盖 |
|---|---|---|---|
| `tests/integration/s3-exit/int-s3-body-heartbeat.test.ts` | 集成/冒烟 | 10 | C1~C4 端到端 |
| `tests/unit/body/affordance-assembler.test.ts` | 单元 | 11 | probe→status 映射、cache、scope |
| `tests/unit/body/affordance-context-scope.test.ts` | 单元 | 5 | 5 状态过滤、platform whitelist、goalKind |
| `tests/unit/body/circuit-breaker-manager.test.ts` | 单元 | 11 | closed→open→halfopen→closed 状态机 |
| `tests/unit/control-plane/embodied-context-assembler.test.ts` | 单元 | 7 | 5-slice 组装、trim、degraded 降级 |
| `tests/unit/control-plane/goal-lifecycle-policy.test.ts` | 单元 | 5 | replace/expire 检测 |
| `tests/unit/control-plane/idle-curiosity-policy.test.ts` | 单元 | 6 | read-only 选择、cooldown、无副作用 |
| `tests/unit/control-plane/run-heartbeat-cycle-v7.test.ts` | 单元 | 8 | heartbeat 主循环、P95、payload 校验 |
| `tests/integration/control-plane/heartbeat-loop.test.ts` | 集成 | 7 | rhythm/user_task/user_reply、intent 选择 |

**总计**: 70 测试（10 集成 + 60 单元），**0 失败**

---

## 3. 退出标准验证结果

### C1 — Affordance 5 状态过滤 ✅

| 状态类 | 来源 | 验证方式 | 结果 |
|---|---|---|---|
| `safe` | probe available → safe | 集成测试 + 单元测试 | ✅ 通过 |
| `exploratory` | probe degraded → exploratory | 集成测试 + 单元测试 | ✅ 通过 |
| `unavailable` | probe unavailable → unavailable | 手动 raw-status 映射验证 | ✅ 通过 |
| `needs_auth` | no probe + cred required → needs_auth | 集成测试 + 单元测试 | ✅ 通过 |
| `blocked` | unavailable 被 `BLOCKED_STATUSES` 排除 | 集成测试 + 单元测试 | ✅ 通过 |

**关键发现**:
- `DEFAULT_ALLOWED_STATUSES = ["safe", "exploratory"]` 默认排除 `unavailable` 和 `needs_auth`
- 显式 scope 可包含 `needs_auth`，但 `unavailable` 永远被 `BLOCKED_STATUSES` 排除（设计行为）
- `goalKind: "passive_sensing"` 时只暴露 read-only intents（`feed.read`, `notification.list`, `work.discover`）

### C2 — EmbodiedContext 5-slice 组装 ✅

| Slice | 来源 | 验证方式 | 结果 |
|---|---|---|---|
| `identity` | `identity_profile` store | 集成测试 seed + 加载 | ✅ loaded / degraded |
| `goals` | `agent_goal` store | 集成测试 seed + 加载 | ✅ loaded |
| `recentInteractions` | `session_chronicle` store | 集成测试 raw INSERT + 加载 | ✅ loaded |
| `toolExperience` | `tool_experience` store | 集成测试 append + 加载 | ✅ loaded |
| `acceptedDream` | `dream_output_index` store | 集成测试空表查询 | ✅ loaded (空数组) |

**关键发现**:
- `identity` 在缺少 `agent_world` / `instreet` 平台 handle 时标记 `degraded`（ADR-007）
- `acceptedDream` 空表时返回 `loaded`（空数组），非 `degraded`
- 部分 slice 降级不影响其他 slice 加载（设计行为）

### C3 — CircuitBreaker 三态可验证 ✅

| 状态转换 | 验证方式 | 结果 |
|---|---|---|
| `closed` → `open` (3 failures) | 单元测试 | ✅ 通过 |
| `open` → `halfopen` (cooldown elapsed) | 单元测试 + 集成测试 | ✅ 通过 |
| `halfopen` → `closed` (probe success) | 单元测试 + 集成测试 | ✅ 通过 |
| `halfopen` → `open` (probe failure) | 单元测试 | ✅ 通过 |
| breaker open 时 `canExecute = false` | 集成测试 | ✅ 通过 |
| breaker open 时 heartbeat guard 返回 defer | 集成测试 | ✅ 通过 |

**关键发现**:
- `evaluateHardGuards` 检查 affordanceMap 中 match 的 status，`painful` → defer，`unavailable` → defer
- breaker 状态通过 affordanceMap 间接影响 heartbeat（DR-002: breaker posture flows through affordance）
- `attemptReset` 在 `cooldownMs = 0` 时立即触发 wet probe 并可能恢复 closed

### C4 — IdleCuriosity 无副作用 ✅

| 检查项 | 验证方式 | 结果 |
|---|---|---|
| 只选择 read-only intents (`.read`/`.discover`/`.inspect`/`.search`) | 集成测试 | ✅ 通过 |
| write intents (`post.publish`, `message.send`) 被排除 | 集成测试 | ✅ 通过 |
| 1-hour cooldown per platform | 集成测试 | ✅ 通过 |
| 无 eligible connector → `idle_policy_no_eligible_connector` | 集成测试 | ✅ 通过 |
| 纯选择，不执行任何 connector | 集成测试 | ✅ 通过 |

**关键发现**:
- `IdleCuriosityPolicy.select()` 返回 `{ candidate?, reason }`，无外部调用
- 返回结构为 plain descriptor（`platformId`, `capabilityId`, `intent`, `reason`），非执行授权

---

## 4. 回归验证

| 指标 | 结果 |
|---|---|
| S3 相关测试总数 | 70 |
| 通过 | 70 |
| 失败 | 0 |
| 预先存在失败 | `T2.2.3 bridge full-runtime heartbeat wires connectorExecutor`（Wave 56 引入，非 S3） |

---

## 5. 结论

S3 退出标准全部满足。affordance 5 状态过滤正确、heartbeat 5-slice 组装完整、CircuitBreaker 三态可验证、idle curiosity 无副作用。无新增回归失败。

**签名**: Wave 58 INT-S3 ✅
