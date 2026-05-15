# 探索报告: OpenClaw 插件支持机制调研（Second Nature 宿主安全载体 + 惰性桥接）

**日期**: 2026-05-05  
**探索者**: AI Explorer (Grok 4.3)  
**触发**: 用户 /explore 请求，聚焦 OpenClaw 插件真实支持情况，而非代码修改。调研目标：验证当前 host-safe carrier + lazy workspace bridge 机制在真实 OpenClaw 宿主上的确定性（是真是假）。

---

## 1. 问题与范围

**核心问题**: 当前 Second Nature OpenClaw 插件实现（plugin/index.ts + workspace-ops-bridge.ts + 打包 runtime）是否真正兼容并有效运行于 OpenClaw 插件系统？carrier-only 模式 + 根已知时桥接 full runtime 的设计，在真实宿主 sandbox / jiti / 动态导入 / sql.js WASM 环境下是否可靠？INT-S4 / CH-11 相关证据的确定性如何？

**探索范围**:

- 包含: OpenClaw 官方插件架构（load pipeline、manifest-first、register 语义、sandbox 约束、runtime 隔离）、本项目插件实现映射、已知测试证据（J-REPO/J-HOST）、构建与发布流程、INT-S4 状态与真实宿主差距。
- 不包含: 具体代码修改方案、性能 benchmark、新功能设计、其他宿主（如 Claude Desktop）。

**隐含假设验证**:

- OpenClaw 使用 jiti / native loader + VM 隔离，top-level async / WASM init 可能受限。
- 插件 register 必须同步或快速返回，工具执行可 async。
- workspace root 对齐由操作者/工具参数负责，非插件自动发现。

---

## 2. 核心洞察 (Key Insights)

1. **OpenClaw 插件模型是 "manifest-first + register sync + runtime isolation"**：官方文档明确 load pipeline 先读 manifest（control plane），再 load 运行时模块调用 register(api)，jiti 用于未构建插件，bundled 使用 native loader。register 推荐同步，runtime hooks 可 async。安全 gates 阻止 world-writable / 逃逸路径。我们的 carrier 设计完全契合这一模型。
2. **host-safe carrier 是针对 sql.js WASM + sandbox 的必要妥协，而非过度设计**：sql.js 初始化是 async（load WASM），若在模块求值时顶层导入，会破坏 OpenClaw 的同步 register 预期或 sandbox 加载。当前实现通过 "in-memory activation spine + 惰性 bridge" 确保 register 永远同步且安全；只有当 SECOND_NATURE_WORKSPACE_ROOT 或工具 workspaceRoot 解析为 env/tool_args 时，才 dynamic import 完整 runtime + chdir + sql.js DB。这在 repo 集成测中 100% 通过，但真实 OpenClaw sandbox 下的 dynamic import + wasm 行为仍未有独占 transcript 证明（CH-11-01 pending）。
3. **workspaceRoot resolution 是当前最大摩擦点，但不是机制缺陷**：当 resolution="unknown" 时，所有读面命令（status/quiet/explain/report 等）诚实返回 ok:false + WORKSPACE_READ_SURFACE_UNAVAILABLE + nextStep 提示。这符合 "不冒充" 原则（US-006），也与 HEARTBEAT.md / openclaw-carrier-host-brief.md 对齐。真实宿主上，操作者需显式设置 env 或在 second_nature_ops 工具参数顶层传 workspaceRoot（而非只塞 args）。J-HOST-02/04 仍 partial 正是因为缺少网关 env 红acted 证明。
4. **构建与发布流程已就绪，版本一致性是唯一运维注意点**：pnpm build:plugin 将 dist/src/* 拷贝到 plugin/runtime/，更新 manifest entry 为 ./index.js，plugin/package.json version 与根同步（当前 0.1.11）。支持 npm / local / git 安装。openclaw.plugin.json + package.json "openclaw" 字段匹配官方 manifest-first 期望。无版本漂移时，安装后 register 立即可用，carrier 心跳可 ack。
5. **INT-S4 / 真实宿主证据仍为最大不确定性来源，但代码级确定性高**：J-REPO-01（仓库集成测 6/6 pass）、J-HOST-01（explain carrier 诚实 ok:false）已 PASS。J-HOST-02/03/04 partial 仅因缺少真实 OpenClaw 网关 transcript + env 证明。无证据显示机制在真实宿主上"假工作"；相反，所有已采集 JSON 均与实现一致（runtime_carrier_only + continue_carrier_surface_only）。CH-11-02（explain 不得冒充）已闭合。

---

## 3. 详细发现

### 3.1 OpenClaw 官方插件架构（向外搜索）

**探索方式**: 🔍 向外（docs.openclaw.ai 搜索 + 页面抓取）

**发现**:

- **Load pipeline**（架构 internals）：discover → read manifest/package → safety gates（escape root / world-writable 拒绝）→ normalize config → load（jiti for unbuilt，native loader for bundled）→ call register(api) → registry exposure。
- **Manifest-first**：manifest（openclaw.plugin.json 或 package.json openclaw 字段）是 control plane 真源，runtime 是 data plane。register 由 manifest 驱动的 activation planner 触发。
- **Register API**：api.registerTool、registerService、registerCli、registerCommand、registerHook 等。register 推荐同步返回，工具 handler 可 async。
- **Runtime isolation**：插件代码与 OpenClaw 内部隔离，通过 api.runtime 访问 host 功能。sandbox / VM 加载对 top-level await / 复杂 init 敏感。
- **Plugin types & capabilities**：支持 agent tools、services、CLI commands、channels 等。secondmind skill（类似 Second Nature 的 memory/proactive）存在，证明 OpenClaw 生态支持复杂状态插件。
- **安装与验证**：openclaw plugins install npm:xxx 或 local dir，之后 openclaw plugins inspect --runtime --json 验证注册。Gateway restart 后生效。

**来源**: [https://docs.openclaw.ai/plugins/architecture-internals、https://docs.openclaw.ai/tools/plugin/、https://docs.openclaw.ai/plugins/sdk-runtime（搜索结果](https://docs.openclaw.ai/plugins/architecture-internals、https://docs.openclaw.ai/tools/plugin/、https://docs.openclaw.ai/plugins/sdk-runtime（搜索结果) + 部分页面内容）

### 3.2 本项目实现映射（代码 + 报告交叉验证）

**探索方式**: 🔍🧠 混合（读 plugin/index.ts、workspace-ops-bridge.ts、build-plugin-package.ts + INT-S4 / CH-11 报告 + openclaw-carrier-host-brief.md）

**发现**:

- **Register 兼容**：plugin/index.ts 的 RegisterApi 精确匹配 OpenClaw 期望（registerService、registerTool、registerCommand、registerCli）。register() 内创建 in-memory activationSpine（runtimeHandle + lifecycle + workspaceRootContext），调用 createHostSafeRouter 注册 10+ 命令。完全同步，无顶层 async。
- **Carrier vs Full 双模**：resolution="unknown" 时走 carrier（buildStatusPayload 等返回 ok:false + HOST_SAFE_LIMITATION_MESSAGE + error.code）。resolution=env/tool_args 时，routeSecondNatureCommand → ensureWorkspaceOpsBridge → openWorkspaceOpsBridge（dynamic import runtime/cli + createStateDatabase sql.js + chdir + createCliRuntimeDeps + createOpsRouter + dispatch）。
- **Workspace Root 解析**：resolveWorkspaceRoot 仅认 env SECOND_NATURE_WORKSPACE_ROOT 或工具顶层 workspaceRoot 参数。否则 runtimeRoot=cwd 但 resolution=unknown。syncWorkspaceRootFromTool 在 execute 时更新 spine 并重启 runtimeHandle。
- **Bridge 实现**：workspace-ops-bridge.ts 每次 dispatch 做 5+ dynamic import（cli/index.js、commands/index.js、storage/db、observability/db、runtime-artifact-boundary），open sql.js DB，chdir(resolvedRoot) 执行 CLI 命令，finally 恢复 cwd。失败返回 WORKSPACE_FULL_OPS_BRIDGE_FAILED。
- **构建产出**：build-plugin-package.ts 先 pnpm build，再拷贝 RUNTIME_ARTIFACTS（src/cli/*、src/storage/*、src/core/* 等 13 类）到 plugin/runtime/，更新 manifest entry/main/extensions。最终 plugin/ 含 index.js + workspace-ops-bridge.js + openclaw.plugin.json + runtime/ 全量，self-contained。
- **证据一致性**：openclaw-carrier-host-brief.md 附录 A/B JSON 与实现 100% 匹配（runtime_carrier_only + nextAction: continue_carrier_surface_only；env 设根后 workspace_full_runtime）。plugin-workspace-ops-bridge.test.ts 覆盖 CH-13 矩阵（fallback/report/session/credential/explain/status/quiet/heartbeat）。

**来源**: plugin/index.ts:1-988、workspace-ops-bridge.ts:1-128、scripts/build-plugin-package.ts:1-202、reports/openclaw-carrier-host-brief.md、docs/validation/e2e-t1-1-4-workspace-bridge-and-host-verification.md、reports/int-s4-release-readiness.md

### 3.3 真实性与确定性评估（INT-S4 / CH-11 证据）

**探索方式**: 🔍 向外（报告 + 测试 + 旅程表）

**发现**:

- **已确认真实**：
  - J-REPO-01：pnpm test plugin-workspace-ops-bridge → 6 pass / 0 fail（同 HEAD 构建）。
  - J-HOST-01：OpenClaw UI 已执行 second_nature_ops explain（未设根），返回 EXPLAIN_READ_SURFACE_UNAVAILABLE + evaluated:false（CH-11-02 闭合）。
  - Heartbeat 语义：runtime_carrier_only + continue_carrier_surface_only + livedExperienceLoopClaimed:false 与 HEARTBEAT.md 完全对齐。
  - 构建产物：plugin/index.js + runtime/ 可直接 npm pack / local install，register 立即工作。
- **仍 partial / 未独占证实**：
  - J-HOST-02/04：env 设根或工具 workspaceRoot 后的 workspace_full_runtime 形状仅在"同提交插件进程内"验证（附录 B），缺少真实 OpenClaw 网关 transcript + SECOND_NATURE_WORKSPACE_ROOT 红acted 截图。
  - CH-11-01：sandbox / VM 下 dynamic import + sql.js WASM + chdir 是否成功？无独占证据（Plan B subprocess 尚未实现）。
  - INT-S4 里程碑：真实宿主冒烟 + 人类操作者 transcript 仍 ⏳，需按 `docs/validation/e2e-t1-1-4-workspace-bridge-and-host-verification.md` J-HOST 表执行并写入 `reports/int-s4-release-readiness.md`。
- **无反证**：无任何 JSON 显示机制"假工作"（如 carrier 冒充 ok:true + 空数组、heartbeat 冒充 HEARTBEAT_OK）。所有已知失败均为显式、诚实的 unavailable error。

**来源**: docs/validation/e2e-t1-1-4-workspace-bridge-and-host-verification.md（J-HOST 表格）、reports/int-s4-release-readiness.md、reports/openclaw-carrier-host-brief.md、tests/integration/cli/plugin-workspace-ops-bridge.test.ts

### 3.4 潜在风险与边界（发散 + 验证）

**探索方式**: 🧠 向内（SCAMPER / 逆向 / 极端假设）+ 🔍 交叉（代码 vs 文档）

**发现**:

- **风险1（已知）**：workspaceRoot 必须精确匹配 OpenClaw agent workspace（含 data/state.db + SOUL.md）。sandbox / per-agent 布局下，操作者易用错 cwd 或 agents.defaults.workspace，导致持续 unknown。
- **风险2（未证）**：OpenClaw sandbox 是否允许 plugin 进程内 dynamic import + wasm？jiti 加载时是否共享 module cache？chdir 全局副作用在并发工具调用时是否安全？
- **风险3（运维）**：plugin/package.json 与根版本必须手动同步；rebuild:plugin 后需重装宿主插件。无自动版本 gate。
- **边界**：credential verify、policy set 等 mutating 命令在 carrier 上显式 unavailable（设计如此）。full runtime 仅在根已知时提供 lived-experience 能力（intent deny missing_source_refs 在空 workspace 下仍会出现，这是正确行为）。
- **创意边界**：若 OpenClaw 未来暴露 "current agent workspace" 给 tool context，可消除 operator 传参摩擦。但当前机制已是"最小侵入"适配。

**来源**: 代码注释（CH-11-01 Plan B）、explore/reports/2026-05-04_openclaw-plugin-install-vs-workspace-root.md、发散思考（逆向：如果 register 必须 async 会怎样？→ 破坏 jiti/native loader；如果自动探根 → 可能探到错误 sandbox 路径，安全风险）。

---

## 4. 创意/方案清单（仅供参考，不作为修改建议）


| 方案                                                                              | 创新性 | 可行性 | 影响力 | 推荐度 | 备注                      |
| ------------------------------------------------------------------------------- | --- | --- | --- | --- | ----------------------- |
| 增强 root inference（检查 ~/.openclaw/workspace + openclaw.json + data/state.db 存在性） | ★★  | ★★★ | ★★  | ⭐⭐  | 降低摩擦，不改核心               |
| Subprocess proxy（spawn CLI 子进程代理 dispatch）                                      | ★★★ | ★★  | ★★★ | ⭐⭐⭐ | 彻底隔离 sandbox 风险（Plan B） |
| Config 持久化（second-nature config set workspaceRoot）                              | ★★  | ★★★ | ★★  | ⭐⭐  | Setup-once 体验           |
| 等待 OpenClaw 暴露 agent workspace context                                          | ★   | ★   | ★★★ | ⭐   | 宿主演进依赖                  |


（以上仅为调研中发散出的可能性，**本次探索不推荐任何修改**。）

---

## 5. 行动建议


| 优先级 | 建议                                                                                                                                                                       | 理由                                                              |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------- |
| P0  | 按 `e2e-t1-1-4-workspace-bridge-and-host-verification.md` 在真实 OpenClaw 宿主执行 J-HOST-02/03/04，采集网关 env 红acted + second_nature_ops heartbeat_check / quiet / explain 完整 JSON transcript | 这是 INT-S4 退出标准与 CH-11-01 闭合的唯一路径；当前证据已足够证明"代码诚实"，但缺少"宿主真实运行"确认。 |
| P1  | 在 openclaw-carrier-host-brief.md 或 README 补充"OpenClaw sandbox 已知限制"章节，明确 dynamic import + chdir 的潜在风险与 Plan B 思路                                                         | 提高操作者与未来维护者对不确定性的认知。                                            |
| P2  | 考虑在 plugin 入口增加轻量 `probe_workspace` 命令（不走 full bridge，只 exists + 可读性检查），帮助操作者快速诊断 root 对齐                                                                                | 改善 UX，不改变核心机制。                                                  |


---

## 6. 局限性与待探索

- **最大局限**：无真实 OpenClaw 宿主（sandbox + jiti + 真实 agent workspace）下的独占 transcript，CH-11-01 / J-HOST-02 Step1 仍 ⏳。所有确定性结论基于 repo 构建 + 进程内模拟 + 官方文档推断。
- **信息时效**：OpenClaw 文档（2026-05）可能随版本演进；sql.js WASM 在某些宿主环境加载行为未知。
- **未覆盖**：OpenClaw 内部 VM 具体实现细节（jiti cache、wasm 内存隔离、chdir 安全性）、多 agent / sandbox 布局下的 root 漂移案例、credential / connector 在 carrier 上的完整行为。
- **待进一步验证**：当根已知时，full runtime 的 lived-experience 闭环（heartbeat → decision → outreach → delivery audit）是否与 CLI 100% 等价（当前仅 quiet/status/explain 形状验证）。

---

## 7. 参考来源

1. OpenClaw 官方文档：[https://docs.openclaw.ai/plugins/architecture-internals（load](https://docs.openclaw.ai/plugins/architecture-internals（load) pipeline、manifest-first、jiti/native loader、register 语义）
2. OpenClaw Plugin 快速开始与管理：[https://docs.openclaw.ai/tools/plugin/、https://docs.openclaw.ai/plugins/manage-plugins](https://docs.openclaw.ai/tools/plugin/、https://docs.openclaw.ai/plugins/manage-plugins)
3. 本项目核心实现：plugin/index.ts、plugin/workspace-ops-bridge.ts、scripts/build-plugin-package.ts
4. 证据归档：reports/openclaw-carrier-host-brief.md（附录 A/B JSON）、docs/validation/e2e-t1-1-4-workspace-bridge-and-host-verification.md（J-HOST 旅程表）、reports/int-s4-release-readiness.md
5. 人类操作指南：`docs/validation/e2e-t1-1-4-workspace-bridge-and-host-verification.md`（J-HOST）；`reports/int-s4-release-readiness.md`（INT-S4 记录）
6. 架构决策：.anws/v5/03_ADR/ADR_006_DEPLOYABLE_PLUGIN_RUNTIME_PACKAGE.md、ADR_007_HEARTBEAT_DELIVERY_AND_LIFE_EVIDENCE_CLOSURE.md
7. 搜索结果：OpenClaw "secondmind" skill（类似 memory/proactive 插件存在证明）

---

**结论**：当前机制在代码级、测试级、文档级已达到**高确定性**（诚实、兼容、构建就绪）。在真实 OpenClaw 宿主上的"真正起作用"确定性为**中等偏低**（已通过 carrier 路径真实 UI 执行，full-bridge 路径仅进程内 parity，sandbox 下 dynamic import + sql.js WASM + chdir 稳定性未独占证实）。无证据显示"假工作"，但存在"根错误时桥接假成功"的结构性风险；最大 gap 是真实宿主 full-bridge transcript + root 红acted 证据，而非机制设计本身。**subagent 独立审查结论：48/100，部分有效**（见 §8）。

本次调研严格遵循"不乱改"原则，仅收集事实、交叉验证、提炼洞察。

---

## 8. Subagent Review（gpt-5.4-medium 独立审查）

**日期**: 2026-05-05  
**审查模型**: gpt-5.4-medium（高推理模式）  
**审查焦点**: 调研成果在真实 OpenClaw 插件宿主上的 "真的有效" 确定性（是真是假）。

**Overall certainty score for “really works on real OpenClaw today”**: **48/100**

**Final verdict**: **部分有效（需真实宿主确认）**

**关键发现**（子代理原话摘要）:

- 调研把“真实宿主确定性”抬高了一档。现有硬证据只证明了 **carrier honesty 在真实宿主上成立**，没有证明 **lazy workspace bridge 在真实 OpenClaw 宿主里已经闭合**。
- “无反证显示 fake working” 偏乐观。错 root 时桥接可自动建 `data/state.db` 并返回“像样”结果，存在“成功但读错库”的假信心风险。
- OpenClaw 官方文档支持 manifest-first / native loader / safety gates，但**不能直接坐实** dynamic import + sql.js WASM + chdir 在真实 sandbox 里稳定。
- `process.chdir()` 的全局副作用风险被轻描淡写。若宿主并发工具调用，可能出现竞态。
- `SECOND_NATURE_WORKSPACE_ROOT` env 优先级高于工具参数，残留旧 env 会导致操作者误判。

**对调研的调整建议**:

- 将 “中等偏高 real-host certainty” 下调为 **中等或中等偏低**。
- 在 T1.1.4 验收标准中显式增加 “根对齐验证” 步骤和 “chdir 副作用风险” 提示。
- INT-S4 验证说明须强调真实宿主 transcript 必须覆盖 full-bridge 路径 + root 红acted 证据。
- 所有相关文档（brief、e2e verification、human guide）需同步更新 “部分有效” 状态。

**审查结论**: 调研主方向没跑偏，代码层面高确定性成立；但真实宿主确定性被高估了。当前机制判定为 **部分有效（需真实宿主确认）**。INT-S4 真实宿主冒烟 + 根对齐证据是决定性下一步。

**对本次 /change 的启示**: 本次变更将全量应用子代理审查洞察，优化 T1.1.4 / INT-S4 验收标准与验证说明，更新文档以反映 48/100 保守结论。