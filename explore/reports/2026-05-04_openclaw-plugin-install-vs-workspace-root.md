# 探索报告: OpenClaw 插件安装位置、官方 workspace 与 Second Nature 根目录

**日期**: 2026-05-04  
**探索者**: AI Explorer  
**问题**: 插件安装目录与工作根能否用**相对关系**自动确定？`SOUL.md` 等是否总在「官方位置」？若不是，为何需要 `SECOND_NATURE_WORKSPACE_ROOT` / `workspaceRoot`？

---

## 1. 问题与范围

**核心问题**: 三者关系 — **(A) 插件代码装在哪**、**(B) OpenClaw 官方说的 agent workspace 在哪**、**(C) Second Nature 读 state/artifacts 的根** — 能否默认对齐？

**包含**: OpenClaw 上游 `agent-workspace` 概念；本仓库 `plugin/index.ts` 的 `resolveWorkspaceRoot`；`README` / `SKILL.md` 对 `workspace/SOUL.md` 的叙述。  
**不包含**: 未在本机验证的 OpenClaw 具体版本行为；多 agent 路由的逐条配置矩阵。

---

## 2. 核心洞察

1. **插件安装目录 ≠ agent workspace**：插件是 **被加载的一段代码包**（npm / `file:./plugin`），通常在 **gateway 管理的 agents/plugins 路径**下；**不是**放 `SOUL.md` 的那张「书桌」。
2. **OpenClaw 官方「书桌」是 agent workspace**：默认 `**~/.openclaw/workspace`**（可配置 `agents.defaults.workspace`）；`SOUL.md`、`USER.md`、`HEARTBEAT.md` 等 **列在该 workspace 目录内**，与 `**~/.openclaw/`**（配置、会话、credentials）**刻意分离**。
3. **Second Nature 当前实现**：根只认 `**SECOND_NATURE_WORKSPACE_ROOT`** 或工具 `**workspaceRoot**`；**未**在代码里绑定「OpenClaw 默认 workspace 路径」或「相对插件 `__dirname` 推导 SOUL」——因此 **不能**单靠「插件装好了」自动推出 DB/artifact 根。
4. **「相对关系」何时成立**：若你**人为约定**「Second Nature 的 state / `data/` 就放在 agent workspace 根（或其一固定子目录）」，则 **一次**把 `SECOND_NATURE_WORKSPACE_ROOT`（或每次 `workspaceRoot`）设成 **与 OpenClaw `agents.defaults.workspace` 相同路径** 即可 —— 这是 **运维约定**，不是 **文件相对路径从插件包内算出来**。
5. **增强可能性（未实现）**: 若 OpenClaw 将来向插件进程 **注入**规范化的 workspace 路径（或已有稳定 env 名），Second Nature 可再加 **fallback 解析顺序**；需单独 ADR/任务，避免与 sandbox、多 agent 工作区漂移冲突。

---

## 3. 详细发现

### 3.1 OpenClaw 官方（向外）

**来源**: [OpenClaw — Agent workspace](https://github.com/openclaw/openclaw/blob/main/docs/concepts/agent-workspace.md)（raw 抓取 2026-05-04）

- Workspace 是 **file tools 与 workspace context 的 home**；默认 `**~/.openclaw/workspace`**；可用 `**openclaw.json` → `agents.defaults.workspace**` 覆盖。
- **标准 bootstrap 文件**列在 workspace 内（含 `SOUL.md`、`USER.md`、`IDENTITY.md`、`MEMORY.md`、`HEARTBEAT.md` 等）。
- **不在 workspace 里**: `~/.openclaw/openclaw.json`、sessions、credentials、managed skills 等。
- **Sandbox**: 若启用 sandbox 且非完全 rw，工具可能在 `**~/.openclaw/sandboxes`** 下操作 **沙箱 workspace**，与 host workspace 再分离一层 —— 更削弱「插件旁相对路径猜 host 笔记本」的可靠性。

### 3.2 本仓库（向内）

- `resolveWorkspaceRoot`：**env → tool 参数 → unknown**（`unknown` 时 `runtimeRoot` 退 `process.cwd()`，**不**等于 OpenClaw agent workspace）。见 `plugin/index.ts` 中 `resolveWorkspaceRoot` / `syncWorkspaceRootFromTool`。
- `README.md` / `SKILL.md`: 叙述 `**workspace/SOUL.md`** 等 —— 这是 **Second Nature 产品语义下的 workspace 目录树**（含 `data/`、memory artifacts），与 OpenClaw 文档里 **「agent workspace 根」在路径上应对齐**，但 **代码不会自动探测** OpenClaw 配置。

### 3.3 「相对插件安装目录」为何不可靠

- 插件包路径与 agent workspace **无稳定相对几何关系**（不同安装方式、profile、多 agent、沙箱都会变）。
- `SOUL.md` **不在**「插件 `node_modules` 旁边」；它在 **用户/网关配置的 workspace 根**。

---

## 4. 行动建议


| 优先级 | 建议                                                                                                                                 | 理由                           |
| --- | ---------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| P0  | 运维上把 `**SECOND_NATURE_WORKSPACE_ROOT`** 或每次 `**workspaceRoot**` 指到 **与 OpenClaw `agents.defaults.workspace` 一致** 的目录（若 state 就放那儿） | 零改代码即可对齐「官方 SOUL 在哪」与「SN 读哪」 |
| P1  | 在 README / 人类指南加一句：**「SN workspace 根应等于（或显式包含）OpenClaw agent workspace」** 的推荐布局                                                    | 减少「以为会自动 relative」的误解        |
| P2  | 若上游提供稳定 **「当前 agent workspace」** API/env，再开任务做 **fallback**                                                                        | 需防沙箱与多 agent 分叉              |


---

## 5. 参考来源

1. [OpenClaw docs — Agent workspace](https://github.com/openclaw/openclaw/blob/main/docs/concepts/agent-workspace.md)（2026-05-04 抓取）
2. `plugin/index.ts` — `resolveWorkspaceRoot`
3. `README.md`、`SKILL.md` — `workspace/SOUL.md` 叙述

**未使用** find-skills；**未使用** sequential-thinking CLI（问题已收敛为文档对照 + 代码路径核对）。