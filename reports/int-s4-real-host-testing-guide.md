# E2E / Host 验证 — INT-S4（真实 OpenClaw 宿主）

**任务 / 里程碑**: `.anws/v5/05_TASKS.md` **INT-S4** — Packaging / Host Smoke / Docs  
**契约参考**: `04_SYSTEM_DESIGN/cli-system.md` §12.2；`01_PRD.md` US-007 / US-008；`reports/release-gate-v5-s4.md`  
**模式**: **Guide-only**（本文件在仓库内定稿；**未**在 Cursor 会话中连接你的 OpenClaw 实例 — 无「已点击 / 已截图」类伪造证据。）

---

## 1. 环境

| 项 | 要求 / 说明 |
|----|----------------|
| **宿主** | 你目标交付的 OpenClaw 运行时（桌面 / 网关 / 远程 workspace）；记录 **build id / 版本字符串**。 |
| **插件包** | 与本仓库一致：先在本机 `pnpm build && pnpm build:plugin`，将 **`plugin/` 目录内容** 安装到宿主扩展目录（见根 `README.md` — OpenClaw extension layout，**不要**多套一层 `plugin/`）。 |
| **Workspace** | 具备 `workspace/` 锚点（`SOUL.md`、`USER.md` 等）以便 **完整 runtime** 路径下 explain / fallback / state 可读；若仅测 **host-safe carrier**，部分步骤预期为 `unavailable`（见负面路径）。 |
| **账号 / 角色** | 能执行 `openclaw plugins …`（或宿主等价 CLI）与 **至少一次** 会触发 heartbeat 的 agent 会话（或等价「工具调用可见」的 UI）。 |
| **种子数据** | 无强制；若验证 **fallback visibility**，需已有 `fallback:` 引用（例如先跑一次会产生 `delivery_unavailable` 与 fallback 的集成场景，或从 `reports/int-s3-outreach-delivery-quiet.md` 所述路径在测试 workspace 预置）。 |
| **Feature flag** | 无；记录宿主 `openclaw.json`（或等价）里与插件 allowlist / `plugins.allow` 相关的配置。 |

---

## 2. 步骤（每步需可观察断言）

> 断言应来自：**CLI 退出码 + stdout/stderr**、**插件返回 JSON**、**宿主 UI 工具调用记录**（transcript / debug panel），而不是「感觉正常」。

### A — 包与表面注册

1. **安装 / 启用**  
   - **动作**: `openclaw plugins install …` → `enable second-nature`（按 README）。  
   - **期望**: `plugins list` 含 `second-nature`；`plugins info second-nature` 返回版本与 capabilities（commands / tools / services）。  
   - **证据**: 保存终端输出 → `evidence/int-s4-01-plugins-info.txt`（路径自定，下同）。

2. **服务启动**  
   - **动作**: 触发一次会启动 `second-nature-runtime` / lifecycle 的宿主流程（依宿主文档）。  
   - **期望**: 无插件加载栈错误；若宿主打印 `plugin id mismatch` / `plugins.allow is empty`，在报告中记为 **known warning**（与 README 一致），不自动判 fail。

### B — `second_nature_ops` 与 `heartbeat_check`

3. **工具可用**  
   - **动作**: 在宿主允许的前提下，直接调用一次 tool：`second_nature_ops`，`command: "status"`（或宿主等价参数）。  
   - **期望**: 返回 JSON，`ok: true` 且含 runtime / surface 相关字段（与 `tests/integration/cli/plugin-runtime-registration.test.ts` 语义一致即可）。  
   - **证据**: `evidence/int-s4-02-tool-status.json`（脱敏后保存）。

4. **心跳回合必须调用 `heartbeat_check`（核心 INT-S4 项）**  
   - **动作**: 配置 **真实** heartbeat 提示词 / 工作流，使模型在回合内调用 `second_nature_ops`，且参数含 **`heartbeat_check`**（或文档约定的同义 JSON，例如 `command: "heartbeat_check"`）。  
   - **期望**: 在宿主 **工具调用记录** 中出现可审计子串：`heartbeat_check` 或 `second_nature_ops` + `heartbeat_check`（对齐 `src/cli/host-smoke/run-host-smoke.ts` 中 fixture 匹配规则）。  
   - **证据**: transcript 导出或截图 `evidence/int-s4-03-heartbeat-tool-invocation.png`；并摘录匹配行到 `evidence/int-s4-03-transcript-snippet.txt`。

5. **（可选）`probeOnly` 能力探测**  
   - **动作**: 若宿主支持向 tool 传入结构化 `args`（含 `probeOnly: true`），对 `heartbeat_check` 做一次仅探测回合。  
   - **期望**: 返回中 `surfaceMode` / `livedExperienceLoopClaimed` 等字段符合 `src/cli/ops/heartbeat-surface.ts` 对 probe 的语义（`livedExperienceLoopClaimed: false`）。若宿主 **无法** 传结构化参数 → 记 **unknown**，不得标 pass。  
   - **证据**: JSON 片段保存。

### C — 投递语义与审计（需完整 workspace runtime 时才有意义）

6. **`target_none` / ack / delivery audit（ADR-007）**  
   - **动作**: 在 **完整 runtime + 可写 observability** 的前提下，触发一次会产生「未投递 / target 不可用」的路径（具体 prompt 依你环境）。  
   - **期望**: explain / audit 不出现「已联系用户」的虚假陈述；`OperatorFallbackView` 若可加载则 `status === "not_sent"`（T1.2.2）。  
   - **证据**: `explain` 返回中 `warnings` 或等价字段；保存 `evidence/int-s4-04-explain-fallback.json`。

7. **`storage_smoke`（打包路径）**  
   - **动作**: tool `command: "storage_smoke"`，`args` 可选 `{ "runRepairFixture": true }`（与集成测一致）。  
   - **期望**: 返回结构化报告：`runtimeIndexDriver`、`nativeSqliteProbe` 等字段存在；`sql.js` 路径 **不得** 假设 WAL 与 native 相同。  
   - **证据**: `evidence/int-s4-05-storage-smoke.json`。

### D — README / release gate 回填

8. **更新追踪文档**  
   - **动作**: 将 A–C 每步结果填入 `reports/int-s4-release-readiness.md` 与 `reports/release-gate-v5-s4.md` 对应行：**pass / fail / unknown** + 一句原因 + 证据文件名。  
   - **期望**: 与 `05_TASKS.md` INT-S4 **Then** 子句一一对应；**unknown 不得写成 pass**。  

---

## 3. 证据（命名建议）

| 证据 | 建议文件名 |
|------|------------|
| 插件列表 / info | `int-s4-01-plugins-info.txt` |
| tool `status` JSON（脱敏） | `int-s4-02-tool-status.json` |
| 心跳工具调用 transcript | `int-s4-03-transcript-snippet.txt` + 可选 `.png` |
| explain / fallback JSON | `int-s4-04-explain-fallback.json` |
| storage_smoke JSON | `int-s4-05-storage-smoke.json` |
| 可选 HAR | 若宿主为 Web UI 且允许导出 |

将上述文件路径写进 `reports/int-s4-release-readiness.md` 的「真实宿主」小节，便于复查。

---

## 4. 负面路径（至少 1 条）

| 场景 | 动作 | 期望信号 |
|------|------|----------|
| **B — 模型未调用工具** | 故意使用 **不** 要求 `second_nature_ops` 的极简 heartbeat 提示 | transcript **无** `heartbeat_check` / 匹配子串 → 在报告中标记 **`heartbeat_tool_not_invoked` 风险 = fail 或 unknown**（与 T1.3.1 fixture 语义一致）；**不得** 将此轮标为 `HEARTBEAT_OK` 等价成功。 |
| **C — 仅 host-safe carrier** | 在无 workspace DB / 仅 carrier 模式调用 `fallback` | 返回应明示 **不可用**（参见 `plugin/index.ts` `HOST_SAFE_FALLBACK_VIEW_UNAVAILABLE` 一类错误码）；断言「未冒充已读 persistence」。 |

---

## 5. 评分（Rubric 最小 MUST）

| 标准 | 说明 |
|------|------|
| 可从冷启动复现 | 另一人仅依赖：本指南 + README 安装节 + 固定宿主版本号可重复。 |
| 每步有可观察断言 | 每步至少一种：退出码、JSON 字段、transcript 子串、截图中的工具名。 |
| 覆盖 INT-S4 Then | package load、heartbeat_check、target none、ack drop、heartbeat_tool_not_invoked、fallback visibility、README boundary — 与 `05_TASKS.md` INT-S4 验收表对照；缺宿主能力则 **unknown**。 |
| Flake / 重试 | 模型未调工具：允许 **1 次** 提示收紧（显式写出「必须调用 second_nature_ops heartbeat_check」）；仍失败则记 fail，不要无限重试刷绿。 |

---

## 6. 未执行 / Blockers（本指南定稿时）

- **未执行**: 未连接用户 OpenClaw；无浏览器自动化步骤。  
- **常见 Blocker**: 无全局 `openclaw` CLI；宿主禁止导出 transcript；企业策略禁用外部插件 — 在 `int-s4-release-readiness.md` 记 **unknown** 并描述 blocker。

---

## 7. 与仓库 CI 的分工

- **`pnpm test`**（含 `pnpm build:plugin`）已覆盖：artifact、fixture 级 host smoke、near-real connector、INT-S1–S3 报告引用路径。  
- **本指南覆盖且 CI 不可替代**: 真实宿主上 **工具是否被调用**、**真实 delivery / ack**、**你方 workspace 与凭证**。

完成 INT-S4 后：将 `05_TASKS.md` 中 **`- [ ] INT-S4`** 改为 **`- [x]`**，并更新 `AGENTS.md` Wave / 未完成里程碑行。
