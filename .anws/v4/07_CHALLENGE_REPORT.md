# Second Nature v4 架构质疑报告 (第三轮)

> **审查日期**: 2026-04-27  
> **审查范围**: `.anws/v4` 设计文档 + 当前实现 + 静态测试  
> **累计轮次**: 3

---

## 📋 问题总览

> 已解决或已失效的轮次只保留摘要。当前活跃轮只保留仍然影响云端 OpenClaw 上线判断的高信号问题。

### 第一轮（已归档）

| 严重度 | 数量 | 摘要 | 状态 |
|--------|------|------|------|
| Critical | 3 | 同步注册、包内 runtime、surface 生命周期真实性 | ✅ 已被后续实现吸收 |
| High | 4 | packaging fallback / 宿主 surface / 版本治理问题 | ✅ 已吸收或转入后续轮次 |
| Medium | 1 | 跳过任务拆解但声称版本就绪 | ✅ 已由 v4 任务清单补齐 |

### 第二轮（已归档）

| 严重度 | 数量 | 摘要 | 状态 |
|--------|------|------|------|
| Critical | 4 | 多数旧结论已因任务范围收口与实现推进而失效或降级 | 🗃️ 已重分类 |
| High | 4 | 旧的主风险已收敛为“宿主桥接未闭合 / 宿主验证未完成” | 🗃️ 已重分类 |
| Medium | 2 | HEARTBEAT.md / guidance 数据流问题并入当前轮次 | 🗃️ 已重分类 |

### 第三轮（当前活跃，已回写 T1.2.3）

| 严重度 | 数量 | 摘要 | 状态 |
|--------|------|------|------|
| Critical | 0 | `heartbeat_check + HEARTBEAT.md` shipping bridge 已进入 plugin surface | ✅ 已修复 |
| High | 1 | 宿主闭环与最小平台出口只有 synthetic/mock 证明，未完成真实宿主验证 | ⏳ 待处理 |
| Medium | 1 | packaging/storage 文档叙事与当前 sql.js 运行时漂移 | ⏳ 待处理 |

---

## 📊 审查摘要

**审查模式**: `FULL`  
**整体判断**: 🟡 可继续，但上云前仍需完成宿主/平台验证  
**高信号结论**: 当前项目最危险的“契约未闭合”问题已经从 shipping surface 上移除：`HEARTBEAT.md + second_nature_ops("heartbeat_check")` 已经真实进入 plugin command/tool surface，并保留了同步注册与 host-safe 边界。剩余差距不再是“入口不存在”，而是“证据还不够硬”——heartbeat 主链仍主要停留在 synthetic signal 证明，Moltbook 最小出口仍主要停留在 mock `fetch` 证明，因此距离“可上云端 OpenClaw”还差最后一段宿主/平台验证闭环。

| 指标 | 数值 |
|------|------|
| Critical | 0 |
| High | 1 |
| Medium | 1 |
| Low | 0 |
| Total Findings | 2 |

| 证据来源 | 结论 |
|----------|------|
| 设计/契约静态交叉审查 | 执行 |
| 任务清单静态交叉审查 | 执行 |
| 代码/测试静态交叉审查 | 执行 |
| 本轮修复验证 | `pnpm build`、`pnpm build:plugin`、`node --test dist/tests/integration/cli/plugin-runtime-registration.test.js` 通过 |
| Pre-Mortem | 已选定 bridge 已落到 shipping surface；剩余风险转为宿主/平台实证不足 |
| 承诺闭合检查 | Partial |

---

## 🧭 承诺模型摘要

| 承诺类型 | 承诺摘要 | 契约来源 | 失真风险 |
|---------|---------|---------|---------|
| 运行承诺 | heartbeat host bridge 需要通过 service / tool / prompt bridge 中至少一条稳定路径暴露给宿主 | `cli-system.md` G4；`05_TASKS.md` INT-S3 | shipping surface 已补齐，但若无宿主实证，仍会把“可消费”误写成“已被真实消费” |
| 结果承诺 | heartbeat 轮在宿主内要么静默 (`HEARTBEAT_OK`)，要么选出动作并可解释 | `control-plane-system.md`；T2.2.1；INT-S2 | 当前 command/tool surface 可返回可消费结果，但宿主主链仍未完成真实验证 |
| 平台承诺 | 至少一个最小平台动作应能落到可验证真实出口 | T3.1.1；INT-S3 | 外部闭环停留在 mock/static |
| 文档承诺 | packaging feasibility 叙事应反映当前 shipping runtime 的真实边界 | `packaging-feasibility-report.md`；`plugin/runtime/storage/db/index.js` | 团队会围绕过时风险优化错误目标 |

---

## ✅ 本轮已修复问题

| ID | 原严重度 | 当前状态 | 证据 | 说明 |
|----|----------|----------|------|------|
| CH-01 | Critical | ✅ 已修复 | `plugin/index.ts`；`HEARTBEAT.md`；`tests/integration/cli/plugin-runtime-registration.test.ts`；commit `57c51ee` | `heartbeat_check` 已进入 shipping plugin command/tool surface，仓库已补 `HEARTBEAT.md`，并通过集成测试证明 command/tool parity、结果可消费、`register(api)` 仍保持同步，且 `service-entry` 继续只表述为 runtime carrier。 |

---

## ♻️ 已失效或降级的旧问题

| 旧问题 | 当前状态 | 原因 |
|------|---------|------|
| “选定的 heartbeat host bridge 没有进入 shipping plugin surface” | 已修复 | `plugin/index.ts` 已暴露 `heartbeat_check`，仓库已补 `HEARTBEAT.md`，并有定向集成测试验证 surface parity 与成功语义 |
| “REQ 覆盖率虚假声明” | 已失效 | `05_TASKS.md` 已明确收口到 `REQ-014 ~ REQ-018`，并主动声明 S2/S3 不能仅凭当前 plugin surface 视为坐实 |
| “平台 API 客户端零实现” | 已失效 | Moltbook client 已提供真实 `fetch` 路径，不再是空接口 |
| “better-sqlite3 是当前 packaging 主阻塞” | 已降级 | 当前 packaged runtime 已转到 `sql.js` 路径；旧文档风险叙事滞后于实现 |
| “Scope Router 设计前提不成立” | 已重述 | 当前代码/任务已改为显式 signal metadata 路由；剩余问题不是路由概念不存在，而是宿主真实桥接证据未完成 |

---

## 🔍 核心发现清单

| ID | 类别 | 严重度 | 契约/Pass | 位置 | 发现 | 影响 | 建议 |
|----|------|--------|-----------|------|------|------|------|
| CH-02 | 证据未完成 | High | INT-S2 / T3.1.1 / INT-S3 | `tests/integration/control-plane/heartbeat-spine.test.ts`；`tests/integration/connectors/moltbook-client.test.ts`；`05_TASKS.md` INT-S3 | heartbeat 内核、scope router、decision record、light continuity 与 Moltbook client 均已有代码，但 heartbeat 测试依赖 synthetic signal，Moltbook 测试依赖 mock `fetch`，INT-S3 仍未完成。 | 不能诚实宣称“云端 OpenClaw 已闭环”或“最小平台出口已验证”；一旦宿主注入语义或真实平台认证/返回结构不同，当前静态结论可能立刻失真。 | 上云前至少补一条真实宿主驱动的 heartbeat 主链验证，以及一条可验证真实平台出口（或 near-real 集成桩）验证；INT-S3 不应继续留空。 |
| CH-03 | 文档漂移 | Medium | T1.0.1 / ADR-006 narrative | `packaging-feasibility-report.md`；`plugin/runtime/storage/db/index.js` | feasibility 报告仍把 `better-sqlite3` 原生编译风险当成中心矛盾，但当前 packaged runtime 已使用 `sql.js` + top-level await。 | 会把后续排障和收口注意力错误地导向原生模块，而低估模块求值期 async bootstrap 与 host-safe boundary 的真实约束。 | 刷新 packaging / ADR-006 相关叙事，明确当前真实风险是 `sql.js` 的模块求值边界与宿主安全加载策略，而不是继续拿已退场路径当主风险。 |

> 本轮只保留仍会影响“是否可以上云端 OpenClaw”的问题；已修复或已失效问题不再占用活跃审查面。

---

## 建议行动清单

### P0 - 立即处理 (阻塞)
1. 无。当前已不存在“bridge 入口根本不存在”这类 Critical 阻塞。

### P1 - 上云前完成 (重要)
1. **[CH-02]** 在真实或 near-real OpenClaw 宿主里完成一次 heartbeat 主链验证，证明宿主真的能消费 `HEARTBEAT.md + heartbeat_check`，而不是只在 synthetic signal 下成立。
2. **[CH-02]** 为 Moltbook 最小 capability 增加一条真实或可验证 near-real 出口验证，避免继续停留在 mock `fetch` 证明。

### P2 - 持续改进 (优化)
1. **[CH-03]** 刷新 packaging feasibility 与相关 ADR/设计叙事，让风险排序与当前 `sql.js` runtime 一致。
2. 把“宿主桥接已证明”和“内核逻辑已存在”在后续报告中严格分离，避免再次把静态内核完整度误写成宿主闭环完整度。

---

## 🚦 最终判断

- [ ] 🟢 项目可继续，风险可控
- [x] 🟡 项目可继续，但需先完成上线前验证
- [ ] 🔴 项目需要重新评估

**判断依据**: 当前代码已经具备 heartbeat shipping bridge surface、heartbeat 内核、scope 路由、light continuity、decision record 以及最小 Moltbook client，说明“入口不存在”与“内部积木缺失”都已不成立；但真实宿主 heartbeat 主链与真实/near-real 平台出口仍未补齐，所以现在距离“可上云端 OpenClaw”差的不是大面积重写，而是最后一段最关键的验证闭环。

一句话结论：**上云前至少还必须完成一次真实宿主 heartbeat 主链验证，并补一条真实或 near-real 平台出口验证；shipping bridge surface 本身已经补齐。**

---

## 📚 附录

### A. 承诺闭合与假设验证摘要

| 项目 | 结论 | 证据 | 对应问题 |
|------|------|------|----------|
| 重复态 | Partial | connector policy / telemetry 内部已有重试与记录语义，但重复 heartbeat 的宿主触发行为尚未被真实验证 | CH-02 |
| 失败态 | Partial | host-safe plugin 会明确拒绝未开放的 mutating flow，heartbeat bridge surface 已存在，但真实宿主失败语义仍未完成验证 | CH-02 |
| 默认态 | Pass | shipping plugin surface 已存在 `heartbeat_check`，仓库已补 `HEARTBEAT.md`，并有定向集成测试证明成功语义 | - |
| 运行态 | Partial | `INT-S3` 仍未完成，`service-entry` 仍只是最小 runtime handle，但已不再冒充 bridge | CH-02 |
| 观测态 | Partial | heartbeat decision record 已存在，但只在 synthetic event 级别得到证明 | CH-02 |

### B. ADR / 设计影响追踪

| 文件 | 影响说明 |
|------|---------|
| `ADR_005_HEARTBEAT_RUNTIME_BOUNDARY.md` | 主桥接思路已与 shipping surface 初步对齐；剩余差距是宿主真实验证，而不是 bridge 入口缺失。 |
| `ADR_006_DEPLOYABLE_PLUGIN_RUNTIME_PACKAGE.md` | 需同步当前 `sql.js` runtime 与 host-safe boundary 现实，避免继续围绕 `better-sqlite3` 旧风险组织决策。 |
| `cli-system.md` | G4 的“稳定 bridge 路径”承诺已被当前 surface 满足；下一步重点转到 INT-S3 验证。 |
| `05_TASKS.md` | `T1.2.3` 已完成；下一步重点不是继续扩范围，而是把 `INT-S3` 和宿主/平台验证做实。 |
