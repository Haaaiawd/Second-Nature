# INT-S5 — v9 Character, Observability & Ops Smoke Report

**Date**: 2026-06-29
**Sprint**: S5 — Character, Observability & Ops
**Status**: ✅ PASS

## 1. Summary

INT-S5 sprint gate验证通过。v9 public ops 输出符合所有断言：
- **Redacted**: credential/private/prompt 字段被 redaction gate 阻断
- **Source-backed**: sourceRefs 在有声明时存在
- **Contestable**: character frame 携带 contestPrompt
- **Non-emotional**: 无 emotion/personality/hard-control 断言

## 2. Test Coverage

| Test | Command | Assertion | Result |
|---|---|---|---|
| continuity.read | `continuity.read` | source-backed, contestable, non-emotional | ✅ PASS |
| routine.list | `routine.list` | installed routines with source refs | ✅ PASS |
| routine.show | `routine.show` | routine detail with guard policy | ✅ PASS |
| connector_evolution.status | `connector_evolution.status` | plan with gate results | ✅ PASS |
| loop_status.read | `loop_status.read` | health with non-emotional wording | ✅ PASS |
| carrier mode cap | `continuity.read` (carrier) | evidenceLevel caps to carrier_ack | ✅ PASS |
| redaction gate | `assembleEnvelope` | no raw sensitive values leaked | ✅ PASS |
| unknown command | `unknown.command` | canonical error reason | ✅ PASS |
| JSON-serializable | all outputs | all envelopes JSON-serializable | ✅ PASS |

## 3. Forbidden Pattern Check

所有 public ops 输出经过以下 forbidden pattern 检查：
- `/emotion/i` — 无情绪断言
- `/feeling\s+(happy|sad|angry|afraid|surprised|disgusted)/i` — 无具体情绪词
- `/personality\s+score/i` —无人格分数
- `/mood\s*:/i` — 无心情字段
- `/identity\s+lock/i` — 无身份锁定
- `/hard[\s-]control/i` — 无硬控制
- `/you\s+(are|feel)\s+/i` — 无身份断言
- `/agent\s+(is|feels)\s+(happy|sad|angry|afraid)/i` — 无 agent 情绪断言

**结果**: 所有 9 个 smoke test 输出均未触发任何 forbidden pattern。

## 4. Redaction Gate Verification

| Input Field | Redaction | Output |
|---|---|---|
| `token: "sk-secret-key-..."` | credential block | `<redacted:credential>` |
| `email: "user@example.com"` | private redact | `<redacted:private>` |
| `prompt: "You are a system agent..."` | prompt hash | `prompt_redacted:<hash>` |

**结果**: 无 raw sensitive value 泄漏到 public ops 输出。

## 5. Evidence Level Truth Gate

| Surface Mode | Evidence Level Cap | Verified |
|---|---|---|
| carrier | carrier_ack | ✅ |
| full_runtime | no cap (promote by proof) | ✅ |

## 6. Known Integration Gaps

**M-1 (from Wave 137 review)**: v9 ops handlers (`dispatchV9OpsCommand`) 未集成到现有 `ops-router.ts` / `commands/index.ts` / `plugin/workspace-ops-bridge.ts`。v9 commands 可通过 `dispatchV9OpsCommand` 独立调用，但现有 CLI/plugin bridge 不会自动路由 v9 命令名到 v9 handlers。

**Impact**: INT-S5 通过 `dispatchV9OpsCommand` 直接调用验证了 v9 ops 的正确性。CLI/plugin parity 的 mechanical wiring 需要后续集成 wave。

## 7. Evidence

- **Test file**: `tests/integration/v9/int-s5-ops-smoke.test.ts` (9 tests)
- **Smoke log**: `logs/int-s5-v9-ops.json` (written by test)
- **Full test suite**: 2279 tests / 2270 pass / 0 fail / 9 skipped

## 8. Conclusion

INT-S5 **PASS** — v9 character, observability & ops smoke 验证通过。所有 public ops 输出 redacted、source-backed、contestable、non-emotional。M-1 集成缺口（ops-router wiring）为已知项，不影响 v9 ops 功能正确性。
