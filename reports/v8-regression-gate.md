# v8 Regression Gate — T-REG.C.1

> **版本**: v8
> **日期**: 2026-06-01
> **验证范围**: Build, lint, targeted regression, plugin packaging smoke
> **触发条件**: INT-V8 完成后执行

---

## 1. 退出标准检查清单

| # | 退出标准 | 状态 | 证据 |
| --- | --- | :---: | --- |
| REG-E1 | `pnpm build` 通过 | ✅ | `tsc -p tsconfig.json` 0 errors |
| REG-E2 | `pnpm lint` / `pnpm typecheck` 通过 | ✅ | `tsc --noEmit` 0 errors |
| REG-E3 | v8 新增测试全部通过 | ✅ | 36/36 PASS (loop-status 2 + diagnostic-redaction 8 + guidance-proposal-consumer 8 + loop-status-integration 2 + living-perception-loop 12 + prior v8 tests) |
| REG-E4 | 全量回归测试无新增失败 | ✅ | 1447/1456 pass, 0 fail, 9 skipped (skipped 为历史遗留 justified skips) |
| REG-E5 | Plugin 打包无错误 | ✅ | `pnpm build:plugin` 通过 |

---

## 2. 回归测试汇总

| 类别 | 测试数 | 通过 | 失败 | 跳过 |
| --- | :---: | :---: | :---: | :---: |
| v8 新增单元测试 | 36 | 36 | 0 | 0 |
| v7 历史回归测试 | 1420 | 1411 | 0 | 9 |
| **全量合计** | **1456** | **1447** | **0** | **9** |

**跳过说明**: 9 个 skipped 测试为 v7 历史遗留（Wave 56/68/69 已标记为 justified skips，与 v8 无关）。

---

## 3. Build / Lint 证据

```
$ pnpm typecheck
> tsc --noEmit
(success, 0 errors)

$ pnpm build
> tsc -p tsconfig.json
(success, 0 errors)
```

---

## 4. 发现与备注

- **零回归**: v8 S1-S5 全部实现未引入任何新的测试失败。
- **编译清洁**: TypeScript 编译零错误，零警告。
- **测试覆盖**: v8 新增 36 个测试全部通过；历史回归测试无退化。
- **结论**: v8 Living Perception Loop 达到可交付状态。

---

**签名**: AUTO
**验证人**: /forge AUTO RUN MODE
