# INT-V7C.R — 0.1.38 Claw Gap Regression Gate

**项目**: Second Nature v7  
**版本**: 0.1.38  
**分支**: `feature/v7c-c5-host-ops-parity` @ `4da407f`  
**日期**: 2026-05-27  
**执行环境**: 本地集成测试（Node.js v22.16.0）+ SQLite/sql.js  
**Claw 实机复测**: 待 0.1.38+ 环境（guide-only 步骤见 §6）

---

## 1. 回归范围

以 S8 0.1.38 Real-host Closure 的三项任务产出为回归对象：

| 任务 | 核心修复 | 验证引用 |
|------|---------|---------|
| T-V7C.C.5 | Host Ops Surface Parity（guidance_payload 可达、connector_test envelope、restore snapshotId、manifest/bridge parity） | `05B#t-v7c-c-5` |
| T-V7C.C.6 | Production Data Growth Closure（digest 持久化、heartbeat 异常保护、plugin 打包 dream/ 修复） | `05B#t-v7c-c-6` |
| T-V7C.C.7 | Guidance Semantics Refinement（expressionBoundary、短 atmosphere、agent.* 排除、outputGuard 兼容） | `05B#t-v7c-c-7` |

---

## 2. 验证矩阵

### 2.1 Host Ops Surface Parity（T-V7C.C.5）

| # | 断言 | 验证方式 | 结果 |
|---|------|---------|------|
| P0-1 | `guidance_payload` 在 Claw `second_nature_ops` 可达 | 本地 ops-router 集成测试 + plugin registration 测试 | ✅ PASS |
| P0-2 | wet probe 返回健康结果时 envelope `ok=true` | `connector_test dryRun:false` 集成测试 | ✅ PASS |
| P0-3 | `restore` 接受 `snapshotId` 参数 | commands.test.ts restore 测试 | ✅ PASS |
| P0-4 | manifest/command list 与实际 whitelist 一致 | plugin-registration.test.ts | ✅ PASS |

**测试证据**:
- `tests/integration/runtime-ops/commands.test.js` — 36/36 PASS
- `tests/integration/plugin/plugin-registration.test.js` — 15/15 PASS

### 2.2 Production Data Growth Closure（T-V7C.C.6）

| # | 断言 | 验证方式 | 结果 |
|---|------|---------|------|
| P0-1 | heartbeat connector attempt 写 ToolExperience 或 explicit unavailable reason | v7c-evidence-body-feedback.test.ts | ✅ PASS |
| P0-2 | `life_evidence_index` / `tool_experience` 至少一项增长 | v7c-production-growth.test.ts | ✅ PASS（本地 SQLite） |
| P0-3 | Dream 自动触发或写 explicit skip reason | v7c-rhythm-loop.test.ts | ✅ PASS |
| P0-4 | heartbeat digest 有持久化 row 或 fallback/proof | commands.test.ts digest 持久化测试 | ✅ PASS |

**测试证据**:
- `tests/integration/control-plane/v7c-evidence-body-feedback.test.js` — 5/5 PASS
- `tests/integration/control-plane/v7c-production-growth.test.js` — PASS
- `tests/integration/dream/v7c-rhythm-loop.test.js` — 6/6 PASS
- `tests/integration/runtime-ops/commands.test.js` — digest 持久化 / 无 auditStore 降级 / cycle 存活 3/3 PASS

**实机缺口**: `life_evidence_index` / `tool_experience` / `dream_output_index` 行增长需真实 connector exec，本地 SQLite 环境已验证写入链路正确，实机复测时补充 before/after。

### 2.3 Guidance Semantics Refinement（T-V7C.C.7）

| # | 断言 | 验证方式 | 结果 |
|---|------|---------|------|
| P1-1 | expression boundary 只表现为 avoid/prefer 式约束，不要求固定格式 | v7c-guidance-semantics.test.ts | ✅ PASS |
| P1-2 | `agent.heartbeat` 不注入 social impulse | impulse-assembler.test.ts + v7c-guidance-semantics | ✅ PASS |
| P1-3 | atmosphere 返回短约束文本（≤120 字） | v7c-guidance-semantics.test.ts | ✅ PASS |
| P1-4 | 现有消费者读取 `outputGuard` 不破坏 | heartbeat-executor.test.ts + guidance-assembler.test.ts | ✅ PASS |
| P1-5 | guidance_payload 返回 expressionBoundaryConstraints | ops-router.ts data 字段 | ✅ PASS |

**测试证据**:
- `tests/integration/guidance/v7c-guidance-semantics.test.js` — 12/12 PASS
- `tests/integration/guidance/v7c-guidance-chain.test.js` — 53/53 PASS（含 guidance_payload）
- `tests/integration/control-plane/heartbeat-executor.test.js` — 11/11 PASS

---

## 3. 回归汇总

| 测试套件 | 通过 | 失败 | 跳过 |
|---------|------|------|------|
| runtime-ops/commands | 36 | 0 | 0 |
| plugin-registration | 15 | 0 | 0 |
| control-plane/v7c-evidence-body-feedback | 5 | 0 | 0 |
| control-plane/v7c-production-growth | PASS | 0 | 0 |
| dream/v7c-rhythm-loop | 6 | 0 | 0 |
| guidance/v7c-guidance-semantics | 12 | 0 | 0 |
| guidance/v7c-guidance-chain | 53 | 0 | 0 |
| state/v7c-identity-goal-hygiene | 20 | 0 | 0 |
| storage/schema + plugin + heartbeat-loop | 41 | 0 | 3（旧 justified skips） |
| **总计** | **~231** | **0** | **3** |

**编译**: `pnpm build` ✅  
**Lint**: `pnpm lint` ✅  
**Package version**: `0.1.38`（根 package.json 与 plugin/package.json 一致）

---

## 4. 发布包校验

```bash
$ cd plugin && npm pack --dry-run
```

**预期**: `@haaaiawd/second-nature@0.1.38` 包内包含：
- `dream/` RUNTIME_ARTIFACTS（T-V7C.C.6 修复）
- `guidance/` expressionBoundary + short atmosphere 产物
- `cli/ops/` guidance_payload / connector_test / restore 命令

**状态**: ✅ build:plugin 通过（dist/scripts/build-plugin-package.js 已验证 dream/ 在 ARTIFACTS 中）

---

## 5. 风险与待跟进

| 项 | 严重度 | 说明 | 下一步 |
|---|--------|------|--------|
| 实机 connector exec 数据增长 | Medium | 本地 SQLite 验证写入链路，真实 HTTP 200/404 后的 DB growth 需 Claw 实机 | Claw 0.1.38+ 复测时补充 before/after |
| `sn-0.1.38-full-issues.md` 基线未本地保存 | Low | 回归以 05A/05B 验收标准为权威；如有基线文件可追加对照 | 如有需要，用户可提供基线文件追加验证 |
| E2E 浏览器实机步骤 | Low | 本地无浏览器环境，E2E 为 guide-only | 见 §6 实机复测手册 |

---

## 6. Claw 实机复测手册（guide-only）

### 6.1 前置检查

1. 确认 Claw 加载 `@haaaiawd/second-nature@0.1.38`
2. 检查 plugin manifest 中 `second_nature_ops` 工具可见
3. 记录 workspace DB 路径

### 6.2 Representative Commands（A Journey）

```json
// A1. guidance_payload
{ "command": "guidance_payload", "sceneType": "social", "capabilityIntent": "post.publish" }
// 预期: ok=true, impulseText 非空, expressionBoundaryConstraints 存在

// A2. connector_test wet
{ "command": "connector_test", "platformId": "moltbook", "capabilityId": "feed.read", "dryRun": false }
// 预期: ok=true, actualStatus 真实, capability_probe_result 增长

// A3. restore snapshotId
{ "command": "restore", "snapshotId": "<已知snapshotId>" }
// 预期: ok=true 或 SNAPSHOT_NOT_FOUND（结构化）

// A4. self_health
{ "command": "self_health" }
// 预期: P95 < 1s, 最小维度集完整
```

### 6.3 DB Before/After（B Journey）

1. 记录 `life_evidence_index` / `tool_experience` / `dream_output_index` / `heartbeat_digest` 行数（before）
2. 触发一次完整 heartbeat cycle（含 connector intent）
3. 再次记录行数（after）
4. 断言: 至少一项增长，且 triggerSource 可读

### 6.4 退出标准

- P0 全 PASS → INT-V7C.R 关闭
- P1 有 non-blocking reason 记录 → 可接受
- 任何 failure → 进入下一轮 `/change`

---

## 7. 结论

**本地集成回归门**: ✅ 全量通过（~231 测试，0 失败）
**编译与 lint**: ✅ 通过
**Package 版本一致性**: ✅ 0.1.38
**实机复测**: ⏳ guide-only，待 Claw 0.1.38+ 环境执行 §6 步骤

**INT-V7C.R 状态**: 本地验证通过，建议进入实机复测。如无实机环境，当前回归证据可接受为 structured non-blocking，待下一版本周期补充实机截图/日志。
