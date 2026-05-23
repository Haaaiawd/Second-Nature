# Wave 61 Code Review — T-DQS.C.3 Dream Pipeline + ModelAssistPort RedactedEvidenceBundle (DR-027)

**审查日期**: 2026-05-22
**分支**: `feature/v7-wave61-dqs-c3`
**审查类型**: 子代理代码审查
**初始状态**: Partial Pass → 修复后 Pass

---

## 严重度汇总

| 严重度 | 初始数量 | 修复后数量 |
|---|---|---|
| Critical | 3 | 0 |
| High | 2 | 0 |
| Medium | 2 | 0 |
| Low | 1 | 0 |
| **总计** | **8** | **0** |

---

## 发现详情与修复

### 1. Critical — 双重 Redaction ✅ FIXED

**位置**: `src/dream/dream-engine.ts`
**问题**: `redactBundle` 内部调用 `redactDreamInput`，对已 redacted 数据再次 redact。
**修复**: `modelAssistPort` 路径直接构造 `RedactedEvidenceBundle`，跳过第二次 redaction。

### 2. Critical — Redaction 失败未调用 lifecycle transition ✅ FIXED

**位置**: `src/dream/dream-engine.ts:125-168`
**问题**: redaction.allowed === false 时直接返回，output 停留在 "candidate"，未进入 "archived"。
**修复**: redaction 失败时设置 `output.status = "archived"`，并调用 `markDreamOutputLifecycle(..., "archived")`。

### 3. Critical — RedactedEvidenceBundle 可变数组 ✅ FIXED

**位置**: `src/dream/redaction-gate.ts:60-67`
**问题**: 返回的 `evidence`/`chronicle`/`memory` 为 `string[]`（可变）。
**修复**: 使用 `Object.freeze(...)` 并 `as readonly string[]`，运行时 enforce 不可变性。

### 4. High — ToolExperience source grounding 缺失 ✅ FIXED

**位置**: `src/dream/output-validator.ts:52-73`
**问题**: `isSourceGrounded` 未验证 toolExperience 来源 ID。
**修复**: `ValidationInput` 增加 `inputToolExperienceIds?: string[]`；`isSourceGrounded` 将其纳入 validSourceIds。

### 5. High — lifecycle transition 异常处理缺失 ✅ FIXED

**位置**: `src/dream/dream-engine.ts:298-313`
**问题**: `markDreamOutputLifecycle` 失败时 output.status 与 DB 不一致。
**修复**: 用 `try/catch` 包裹 lifecycle 调用；失败时保持 `output.status = "candidate"`。

### 6. Medium — redactBundle null 路径未测试 ✅ FIXED (文档化)

**位置**: `tests/unit/dream/t-dqs-c3-redacted-evidence.test.ts`
**问题**: `redactBundle` 返回 `null` 的路径在当前 `runDream` 中不可达（无 sensitivityFlags 传递）。
**修复**: 测试注释明确说明设计意图；`redactBundle` 本身在独立测试中被验证。

### 7. Medium — toolExperience kind 字段兼容性 ✅ PASS (无修复必要)

**位置**: `src/dream/memory-consolidator.ts:88-91`
**结论**: `CanonicalMemoryEntry.kind` 定义为 `string`，"tool_experience" 是合法值。

### 8. Low — modelAssistPort 优先级未文档化 ✅ FIXED

**位置**: `src/dream/types.ts:216-220`
**修复**: JSDoc 注释明确说明 "If both modelAssistPort and modelPort are provided, modelAssistPort takes precedence."

---

## 验证结果

| 指标 | 数值 |
|---|---|
| 新增单元测试 | 10 |
| 通过 | 10 |
| 失败 | 0 |
| 集成测试 | 11/11 pass |
| 全量回归 (unit) | ~560 pass |
| 预先存在失败 | `resolveCapability unknown capability throws`（旧 CapabilityContractRegistry 行为） |

---

## 变更文件清单

- `src/dream/types.ts` — RedactedEvidenceBundle + ModelAssistPort + DreamEngineInput 扩展
- `src/dream/redaction-gate.ts` — `redactBundle()` + `Object.freeze`
- `src/dream/dream-engine.ts` — ModelAssistPort 接入 + lifecycle transition + ToolExperience evidence
- `src/dream/memory-consolidator.ts` — `toolExperienceSummaries?` 字段
- `src/dream/output-validator.ts` — `inputToolExperienceIds` 支持
- `src/dream/index.ts` — 导出 `redactBundle`
- `tests/integration/dream/t7-1-1-dream-pipeline.test.ts` — output.status = "accepted"
- `tests/unit/dream/t-dqs-c3-redacted-evidence.test.ts` — 10 个单元测试
- `AGENTS.md` — 添加 Wave 61 块
- `.anws/v7/05A_TASKS.md` — 标记 T-DQS.C.3 `[x]`

---

## 最终结论

**状态**: ✅ **Pass**

所有 Critical/High/Medium/Low 发现均已修复或澄清。核心逻辑（DR-027 brand type + DR-023 lifecycle transition）正确，测试覆盖充分，类型安全，backward compat 保留，无回归破坏。
