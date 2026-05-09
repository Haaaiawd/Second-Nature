---
name: openclaw-plugin-authoring
description: 设计、打包、发布与排查 OpenClaw 2026.5.x 原生插件，覆盖 manifest activation gate、tool/command/service 注册、runtime 打包、gateway daemon 加载路径与 plugin classification（Shape / capabilityCount / startup-plan）。当用户在创建新的 OpenClaw 插件、调试为何插件的工具进不了 agent 会话、审查 `openclaw plugins info` 输出，或需要把工具/命令/服务暴露给 OpenClaw 心跳与会话时使用。
---

# OpenClaw Plugin 作者手册

> "Plugin 装上去 ≠ 工具能用。Daemon 决定要不要加载你；Plugin classification 决定 register() 跑了之后能贡献什么。两道门都得过。"

本 skill 把 Second Nature 团队 2026-05-06 把 `second_nature_ops` 推进 agent 会话过程中踩到的每一个坑、每一段证据、每一条修复路径，固化成下一次写 plugin 直接照抄的清单。

---

## 🎯 何时调用

- 在写一个新的 OpenClaw 原生插件（`openclaw.plugin.json` + `package.json` + 入口 `register(api)`）。
- `openclaw plugins enable` 成功，但 chat 会话里 `tools` 数组里**没有**你声明的工具。
- `openclaw plugins info <id>` 显示 `Shape: non-capability` / `capability count: 0`，需要判断这是不是问题。
- `openclaw plugins update` 后 daemon 不再自动加载某个插件。
- 在打包/发布 plugin 到 npm（`@haaaiawd/second-nature` 这类作用域包）。

## 🚫 何时不调用

- 用户问的是 OpenClaw **使用**问题（怎么写 prompt、怎么配 channel）——交给一般文档。
- 用户在写**纯 npm 库**，不挂 OpenClaw 钩子——这是普通 Node 包发布。
- 用户的 plugin 已经在 daemon 里完整加载（`Shape: plain-capability` 或 channel/provider）且工具可用——没有诊断需求。

---

## ⚠️ CRITICAL：写 OpenClaw plugin 之前必须知道的 8 条

> [!IMPORTANT]
> 这 8 条是真金白银的两小时换来的。**每一条都解释了"为什么"**——没有解释的禁令会被绕过。

### 1. CLI 加载 ≠ Daemon 加载（两个进程的真相）

`openclaw plugins enable` 是 **CLI 进程**直接 `import` 你的入口、跑一次 `register(api)` 做校验；
`openclaw gateway run`（含 systemd `openclaw-gateway`）是 **Daemon 进程**，走另一套更严的 `loadGatewayStartupPluginPlan` 决定要不要加载你。

**CLI 跑通 register() 不代表 daemon 会加载你**。坑就坑在 stderr 哨兵在 enable 时能打出来，但聊天会话里依然没工具。

→ **调试守则**：永远用 `openclaw gateway run 2>&1 | tee /tmp/gateway.log` 抓真实 daemon stderr，systemd 模式下 stderr 落 journal、看不全。

### 2. `contracts.tools` 不是 daemon 启动的入场券

Daemon 的 `loadGatewayStartupPluginPlan` 只认 5 类入场券：
- `channels[]` 非空（IM/会话通道）
- `providers[]` 非空（speech / web search 等）
- 显式 hook 字段（`hooks.before_agent_start` 等）
- `activation.onStartup: true`
- 在用户 `plugins.enableHookExtensions` 名单里

**只有 `contracts.tools` / `contracts.commands` / `contracts.services` 的 plugin，daemon 会跳过你**。这就是为什么 Second Nature 0.1.13 → 0.1.15 全程被忽略——manifest 里只有 tools，没有任何入场券。

→ **修复路径**：tool-only / command-only plugin **必须**在 manifest 里加 `"activation": { "onStartup": true }`。

### 3. `Shape: non-capability` 不是缺陷

`openclaw plugins info` 报 `Shape: non-capability` / `capability count: 0` 只意味着你没声明 channel / provider / context-engine 等**带能力名册**的高级 capability。这**不影响** `registerTool` / `registerCommand` / `registerService` 工作。

**不要为了让 Shape 好看去伪装成 context-engine**——那会要求实现 `ingest` / `assemble` / `compact`，假实现一定在某个 host code path 上炸。

### 4. VM sandbox 拒绝 top-level await

OpenClaw daemon 用 Node.js VM 执行插件代码，**top-level `await` 会直接 SyntaxError**：
```
SyntaxError: Unexpected identifier 'Promise'
```

→ **永远使用静态 `import`**：`import { definePluginEntry } from "openclaw/plugin-sdk/plugin-entry";`
→ 任何"延迟加载 SDK"的 `const { x } = await import(...)` 写法都不能放在 module top level。

### 5. `register(api)` 必须同步注册所有 surface

`registerTool` / `registerCommand` / `registerService` / `registerHook` **必须**在 `register(api)` 同步调用栈里完成。把它们丢进 `setTimeout` / Promise 链里 = 注册不上。

→ 异步初始化（DB 连接、配置加载）放进 `registerService` 的服务实例里，让 host 在合适时机调用，不要拖延注册时机。

### 6. 入口模块求值不能抛

OpenClaw 在 `register()` 之前会 evaluate 你的入口 module。如果 top-level 代码（`import.meta.url` 解析、路径计算、文件读取）抛错，整包都不会被加载，且**不会有 register 回调**——你看不到任何错误。

→ **把可能失败的 top-level 计算挪到 register 内部**。Second Nature 0.1.13 → 0.1.14 的 `workspace-ops-bridge` 就是这么修的（参见 Wave 17）。
→ **加 stderr 哨兵**：`process.stderr.write("[my-plugin] module evaluated\n")` 三行（module / register entry / register exit），daemon journal 里如果只看到前两行没第三行，问题就在 register 内部抛了。

### 7. `plugins.allow` 用 plugin id，不是 npm 包名

`plugins.allow` / `plugins.enableHookExtensions` 这些配置匹配的是 manifest 里的 `id` 字段（如 `second-nature`），**不是** npm 包名（如 `@haaaiawd/second-nature`）。配错了会被 OpenClaw 当成 stale entry 静默忽略。

### 8. 版本字符串四处对齐

发布 plugin 涉及 4 个版本号，必须全部一致，否则 host capability probe / smoke check 会报 mismatch：

| 位置 | 字段 | 例 |
|------|------|------|
| `package.json` (root + plugin/) | `version` | `0.1.16` |
| `plugin/openclaw.plugin.json` | `version` | `0.1.16` |
| runtime hardcoded | `service-entry.ts` 里的 `const version` | `0.1.16` |
| build script 校验 | `scripts/build-plugin-package.ts` 比对 | 严格相等 |

→ 改版本号就把这 4 处一起改，写到 PR checklist 里。

---

## 🧠 心智模型：OpenClaw 的两层门

```
┌─────────────────────────────────────────────────────────┐
│  门 1：daemon 启动加载（loadGatewayStartupPluginPlan）  │
│  → 必须持有入场券（5 张之一）才会被 import              │
└─────────────────────────────────────────────────────────┘
                          ↓
                  (持票才能进)
                          ↓
┌─────────────────────────────────────────────────────────┐
│  门 2：register(api) 执行                              │
│  → 同步注册所有 surface (tool/command/service/hook)    │
│  → 任何抛错 = surface 全失效                           │
└─────────────────────────────────────────────────────────┘
                          ↓
                  (注册成功)
                          ↓
       agent session 的 tools 数组里看到你的工具
```

**Plugin classification 的本质**：classification 描述的是"你贡献了哪些类型的高级 capability"（channel/provider/context-engine 等），它**不是**门 1 或门 2 的判定依据。tool-only plugin classification 永远是 `non-capability`，但只要拿到了入场券、register() 跑通，工具就能用。

---

## 📋 Authoring 清单（按这个顺序写新插件）

### A. Manifest (`plugin/openclaw.plugin.json`)

详细模板见 [references/manifest-template.md](references/manifest-template.md)。最小必填：

```jsonc
{
  "id": "your-plugin",                  // ← plugins.allow 用的就是这个
  "name": "Your Plugin",
  "version": "0.1.0",
  "description": "...",
  "activation": {
    "onStartup": true,                  // ← tool-only plugin 必须有这个
    "onCapabilities": ["tool"]          // ← 可选，仅作 metadata
  },
  "contracts": {
    "tools":    ["your_tool_name"],
    "commands": ["your-command"],
    "services": ["your-runtime"]
  },
  "configSchema": { "type": "object", "additionalProperties": false, "properties": {} }
}
```

### B. 入口 (`plugin/index.ts`)

```typescript
import { definePluginEntry } from "openclaw/plugin-sdk/plugin-entry";
// ⚠️ 静态 import；不要 `const { definePluginEntry } = await import(...)`

process.stderr.write("[your-plugin] module evaluated\n");

export default definePluginEntry({
  id: "your-plugin",
  name: "Your Plugin",
  register(api) {
    process.stderr.write(`[your-plugin] register() entered, api keys=${Object.keys(api).join(",")}\n`);

    api.registerTool({
      name: "your_tool_name",
      // ...
    });

    process.stderr.write("[your-plugin] register() completed\n");
  },
});
```

→ **三行 stderr 哨兵**是诊断资产，不要在生产版里删掉，落 daemon log 几乎不要钱。

### C. `plugin/package.json`

```jsonc
{
  "name": "@scope/your-plugin",
  "version": "0.1.0",
  "type": "module",
  "main": "./dist/index.js",
  "openclaw": {
    "runtimeExtensions": ["./dist/index.js"],   // ← daemon 真正加载的产物
    "compat": { "pluginApi": ">=2026.5.4" }
  },
  "peerDependencies": { "openclaw": ">=2026.5.4" },
  "peerDependenciesMeta": { "openclaw": { "optional": true } }
}
```

### D. Build 校验脚本

`scripts/build-plugin-package.ts` 必须校验：
- manifest 和 package 里的 `version` 完全一致
- runtime 入口里 hardcoded 的 version 字符串一致
- `manifest.activation.onStartup === true`（如果是 tool-only plugin）
- `manifest.contracts.tools` 不为空（或对应的 commands/services）
- 不再使用废弃的 `manifest.entry` 字段

### E. 集成测试

- `tests/integration/cli/plugin-packaging-walkthrough.test.ts`：断言打出来的包能被 `loadPluginManifest` / `loadPluginPackage` 正确解析。
- `scripts/plugin-smoke-check.ts`：在 CI 里跑一遍打包流程 + 基本 smoke。

---

## 🔍 Verification 仪式（部署到目标 host 后）

按顺序跑这些命令。详细诊断手册见 [references/debugging-toolkit.md](references/debugging-toolkit.md)。

```bash
# 1. 安装/更新
openclaw plugins update @scope/your-plugin

# 2. 重启 daemon（systemd）
sudo systemctl restart openclaw-gateway

# 3. 抓 daemon 真实 stderr（关键步）
sudo systemctl stop openclaw-gateway
openclaw gateway run 2>&1 | tee /tmp/gateway.log &
sleep 15

# 4. 三行哨兵都在？
grep '\[your-plugin\]' /tmp/gateway.log
# 期望看到：
#   [your-plugin] module evaluated
#   [your-plugin] register() entered, api keys=...
#   [your-plugin] register() completed

# 5. daemon 加载列表里有你？
grep 'plugins listening' /tmp/gateway.log
# 例：[gateway] http server listening (2 plugins: feishu, your-plugin; 13.3s)

# 6. classification 自查
openclaw plugins info your-plugin
# 关注：Shape, capability count, Capabilities

# 7. agent 会话工具枚举（真实终极验证）
# 在 chat 里让 agent 列 tools 数组，确认你的 tool name 出现
```

---

## 🐞 失败模式查找表

| 症状 | 第一证据 | 根因 | 修复 |
|------|---------|------|------|
| `enable` 成功，chat 里没工具 | gateway.log 里**没有** `[your-plugin]` 任何哨兵 | 没拿到 daemon 入场券 | 加 `activation.onStartup: true` |
| daemon 启动崩 `Unexpected identifier 'Promise'` | gateway.log 有 SyntaxError | top-level await | 改成静态 import |
| 哨兵打出 `module evaluated` 但没 `register() entered` | daemon 加载列表里没你 | manifest 不被识别（path / format 错） | 检查 `runtimeExtensions` 路径是否真存在 |
| 哨兵打出 `register() entered` 但没 `register() completed` | register 内部抛 | 在 register 里 throw 了 | 看 stderr 紧跟的 stack trace |
| `plugins.allow: plugin not found: @scope/...` 警告 | config warning | 匹配用的是 plugin id 不是 npm 名 | 改 `plugins.allow` 为 plugin id 或删除该 entry |
| `Shape: non-capability` | `openclaw plugins info` | 这是预期行为，不是 bug | 别管，工具能用就行 |
| 版本不匹配报错 | smoke check / capability probe | 4 处 version 不一致 | 4 处一起改 |
| Tool 在 JSON 出现但 chat 工具表没有 | 会话级缓存 | session 是 plugin 加载之前建的 | 起新 chat 会话 |

---

## 🛡️ 老师傅守则

1. **Stderr 哨兵不要省**：三行成本几乎为零，但每一次 daemon-side 故障它都救命。
2. **永远跑 foreground gateway 调试**：systemd 把 stderr 切碎，foreground 一目了然。
3. **改 manifest 必跑 build 校验脚本**：人手对齐 4 处版本号一定会漏。
4. **不要为了 Shape 好看伪造 capability**：假 context-engine / 假 provider 早晚在某个 code path 上炸。
5. **plugin id 与 npm 包名分清**：`plugins.allow` / `enableHookExtensions` 用 id，install/update 用 npm name。
6. **新增 plugin 上 host 后立刻让 agent 列 tools 数组**——这是唯一可信的终极验证，比 `openclaw plugins info` 更接近真实使用面。

---

## 📚 References

- [references/manifest-template.md](references/manifest-template.md) — 完整带注释的 manifest + package.json 模板，含 channel/provider/context-engine 变体
- [references/debugging-toolkit.md](references/debugging-toolkit.md) — grep 命令决策树、foreground gateway 配方、session probe 提示词
- 项目内深度文档：`docs/validation/openclaw-plugin-classification.md`（这次调试的一手证据与 OpenClaw host 源码索引）
- 相关报告：`reports/second-nature-ops-tool-visibility-issue-2026-05-06.md`、`explore/reports/2026-05-05_openclaw-plugin-support-survey.md`

---

## 🧰 真实案例：Second Nature 0.1.13 → 0.1.16 的修复弧

| 版本 | 改了什么 | 想解决什么 | 实际效果 |
|------|---------|-----------|---------|
| 0.1.13 | tool-only manifest，`capabilities` 字段 | 让 daemon 加载 | ❌ daemon 完全跳过，sentinel 没打 |
| 0.1.14 | top-level `await import("openclaw/plugin-sdk/...")` | 适配 SDK 新接口 | ❌ VM sandbox SyntaxError |
| 0.1.15 | 静态 import + `definePluginEntry` 包装 | 修 TLA | ❌ daemon 还是不加载，仍缺入场券 |
| 0.1.16 | 加 `activation.onStartup: true` + `onCapabilities: ["tool"]` | 拿到 daemon 入场券 | ✅ 三行哨兵全打、`http server listening (2 plugins)` 含 `second-nature`、agent 会话见到 `second_nature_ops` |

**教训浓缩**：每次以为修了一层，下一层立刻抬头。**门 1（daemon 入场券）和门 2（register 同步成功）必须分开诊断**——混在一起看证据，每次都会归因到错误的层。
