# INT-S4 — E2E / PRD 确认报告（宿主 + 仓库证据）

**日期**: 2026-05-03  
**契约来源**: `.anws/v5/01_PRD.md`（US-001 ~ US-008）、`docs/validation/int-s4-host-smoke-testing-guide.md`（J0–J7）、`.anws/v5/05_TASKS.md` INT-S4  
**目的**: 用 E2E 证据格式**诚实标注**「已确认 / 部分确认 / 未确认」，避免把 **host-safe 桥接**误读为 **PRD 全链闭环**。

---

## E2E Plan


| 字段              | 内容                                                                                                     |
| --------------- | ------------------------------------------------------------------------------------------------------ |
| Target          | OpenClaw 网关仪表盘（隧道）`http://127.0.0.1:18789/`，会话 `agent:main:main`                                       |
| Environment     | OpenClaw 2026.4.29 类宿主；插件 `second-nature` 已安装并 `gateway restart`                                       |
| Build / Commit  | 仓库 `pnpm test` 运行于含 `HEAD` 的工作区；宿主未强制记录 `git rev-parse`                                                |
| Browser         | Cursor 内置浏览器：连接、聊天、`second_nature_ops` 多轮 tool 输出                                                      |
| Repo automation | `pnpm exec tsc --noEmit`；`pnpm test`（`build` + `build:plugin` + `node --test dist/tests/**/*.test.js`） |


---

## 1. 仓库自动化（可复现命令）


| 检查项        | 状态       | 证据                                                                                    |
| ---------- | -------- | ------------------------------------------------------------------------------------- |
| TypeScript | **PASS** | `pnpm exec tsc --noEmit` → exit 0                                                     |
| 全量测试       | **PASS** | `pnpm test` → **247 / 247** pass，0 fail（与 `reports/int-s4-release-readiness.md` 口径一致） |


> 说明：上述验证 **PRD US-002 / US-006 等**在 **fixture / 集成测**路径上的大量契约；**不**等价于「在真实 Claw 用户会话里」已验证同一故事。

---

## 2. 宿主 UI / `second_nature_ops`（真实 OpenClaw 会话证据摘要）

以下来自 **Cursor 编排的浏览器会话**（连接网关 → 聊天 → 助手按指令多次调用 `second_nature_ops`）。若需审计留档，请在本机从 OpenClaw **导出 transcript** 并替换本节「摘要」为附件路径。


| 调用序 | command           | 结果摘要（与插件 host-safe 语义一致）                                                                                                         |
| --- | ----------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `status`          | `ok`；`runtime.serviceStatus` 运行中；`**rhythm.mode` 为插件占位 `active`**；`**quiet.mode` 为 `unknown`**（占位，非 PRD 完整 Quiet）                |
| 2   | `heartbeat_check` | `heartbeat_ok` / `HEARTBEAT_OK`；含 `**runtime_carrier_only`（或等价 carrier-only 语义）** 时 → 满足 PRD US-001 **异常条款**（显式边界、不冒充 full loop） |
| 3   | `storage_smoke`   | `ok`；sql.js WASM + native 探测结论（与 T4.1.4 / J6 一致）                                                                                 |
| 4   | `explain`         | `subject`=`probe:int-s4-e2e` → 结构化 explain；**不等于**完整 HostCapability 报告（J5）                                                       |
| 5   | `fallback`        | `HOST_SAFE_FALLBACK_VIEW_UNAVAILABLE`；**显式错误**，非「已投递」——与 US-004/US-007 **不可用须可解释**一致                                             |


---

## 3. `int-s4-host-smoke-testing-guide.md` — J0–J7 状态（本轮）


| ID  | Journey                      | 状态            | 证据 / 缺口                                                         |
| --- | ---------------------------- | ------------- | --------------------------------------------------------------- |
| J0  | 构建与安装                        | **PASS**      | 用户侧已完成安装 + 重启；本报告不附 `plugins list` 终端截屏                         |
| J1  | 包加载                          | **PASS**      | UI 可连；Skills 活跃；工具可调                                            |
| J2  | 显式 `heartbeat_check`         | **PARTIAL**   | 结构化 **PASS**；若仍为 **carrier-only** → PRD US-001 **主目标未闭合**（见 §4） |
| J3  | 真实 heartbeat turn transcript | **NOT RUN**   | 未从 **定时 heartbeat** 导出独立 transcript                             |
| J4  | `heartbeat_tool_not_invoked` | **NOT RUN**   | 依赖 J3                                                           |
| J5  | Capability / delivery 报告     | **PARTIAL**   | 未跑独立 `HostCapabilityReport`；仅有 explain+probe                    |
| J6  | `storage_smoke`              | **PASS**      | 见 §2 表                                                          |
| J7  | Fallback 可见性                 | **PASS（契约向）** | 显式 `HOST_SAFE_*`；非伪造已发送                                         |


---

## 4. PRD（`01_PRD.md`）— US 逐项「E2E 确认」

**图例**（按验证通道拆分）：

- **Host**：本轮 OpenClaw UI + `second_nature_ops` 可观察行为  
- **CI**：本仓库 `pnpm test` / 集成测可承接的条文  
- **—**：当前无直接证据


| US         | 标题（节选）                       | Host                                    | CI                                                | 结论一句话                                                  |
| ---------- | ---------------------------- | --------------------------------------- | ------------------------------------------------- | ------------------------------------------------------ |
| **US-001** | heartbeat → 真实 decision loop | **仅确认桥接 + 显式 carrier-only 边界**          | 有 decision/ledger 等测                              | **主验收未确认**；子条款「不得冒充 full loop」在 carrier-only 下 **可确认** |
| **US-002** | life evidence 契约             | —                                       | **可确认（测里）**                                       | PRD 故事在 **CI** 侧有支撑；**Host 聊天未证**                      |
| **US-003** | rhythm windows               | **未确认**（`status` 为占位，非真实 window policy） | 有 control-plane 相关测                               | **Host 不能写「节律已应用」**                                    |
| **US-004** | 主动联系闭环                       | **未确认**                                 | 有部分集成路径                                           | 未证「用户会话可见投递」                                           |
| **US-005** | 用户兴趣模型                       | —                                       | 有 snapshot 相关测                                    | **Host 未证**                                            |
| **US-006** | Quiet 收纳                     | —                                       | 有 Quiet 相关测                                       | **Host 未证**；`quiet.mode: unknown` **预期**于当前插件面         |
| **US-007** | OpenClaw 能力 / 兜底             | **部分**（fallback 显式不可用）                  | research 见 `.anws/v5/04_SYSTEM_DESIGN/_research/` | **未**替代正式 capability 研究报告签字                            |
| **US-008** | README 能力边界                  | —                                       | 文档任务                                              | 见 README / T1.4.1；**非 Host 行为**                        |


---

## 5. Findings（按严重度）

- **[MEDIUM] PRD 观感「基本都未确认」**  
  - **Expected**: 区分 **Host 桥接** vs **full lived experience**。  
  - **Actual**: 宿主路径上 US-001 主句、US-003~006 未闭合；易误判为「什么都没做」。  
  - **Evidence**: 本报告 §2–§4；`plugin/index.ts` 中 `buildStatusPayload` / `buildQuietPayload` 占位实现。  
  - **Suggested fix**: 对外沟通固定用语：**「INT-S4 宿主 ops 子集已验证；PRD P0 闭环仍以 CI + 待补 transcript 为准」**。
- **[LOW] `quiet.mode: unknown`**  
  - **Expected**: host-safe 不读 workspace Quiet 状态。  
  - **Actual**: 与实现一致。  
  - **Repro**: `second_nature_ops` → `status` / `quiet`。  
  - **Evidence**: `plugin/index.ts` `buildQuietPayload`。

---

## 6. Coverage Gaps（未执行 / 建议下一波）

1. **J3–J4**：导出 **非本对话** 的定时 heartbeat **tool 调用原文**，对照 `run-host-smoke.ts` 正则意图。
2. **J5**：在宿主 shell 跑 **capability probe** 并保存 `HostCapabilityReport` JSON（脱敏）。
3. **US-001 full**：在配置 **可读 workspaceRoot + full runtime** 的宿主上重跑 `heartbeat_check`，抓取 **非** `runtime_carrier_only` 的决策输出（若环境允许）。
4. 将本报告路径写入 `reports/int-s4-release-readiness.md`「真实宿主」行，再决定是否勾选 `05_TASKS.md` **INT-S4**。

---

## 7. Recommendation

- **可合并/发布叙事**：仓库 **247 tests 全绿** + 宿主 **ops 脊柱**（heartbeat / storage / explain / fallback 诚实边界）→ 适合写 **「宿主集成子集已验证」**。  
- **不可写**：「PRD v5 lived experience 已在 Claw 上全部确认」——除非补齐 §6 缺口并在 PRD 验收句下逐条挂钩证据。

---

## Appendix — 命令备忘

```bash
cd /path/to/Second-Nature
pnpm exec tsc --noEmit
pnpm test
```

宿主侧以 OpenClaw 文档为准触发 `second_nature_ops`；本报告不替代官方 `openclaw plugins …` 审计日志归档。