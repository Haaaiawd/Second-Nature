# OpenClaw Plugin 分类协议（与 Second Nature 的契合点）

**研究日期**: 2026-05-06  
**对应 OpenClaw 版本**: 2026.5.4  
**触发**: INT-S4 / T1.1.4 真实宿主验证发现 `second_nature_ops` 工具不进 agent 会话；逐层下钻 host 源码后定位到 plugin 模型的 startup-plan 边界。

---

## 1. 这份文档解决什么问题

下一个看到 `openclaw plugins info second-nature` 输出 `Shape: non-capability` 的人，**不要再重复我们 2026-05-06 的两小时调试**。这一切都是预期，原因写在这里。

如果未来 OpenClaw 升级让我们的分类标签变了，请用本文档的 grep 命令重新校准（grep 路径写在每段证据后）。

---

## 2. OpenClaw plugin 加载的两个独立进程

很容易踩到的第一个坑：

| 进程 | 触发命令 | 行为 |
|------|---------|------|
| **CLI 进程** | `openclaw plugins enable <id>` | 直接 `import` 插件入口校验，调一次 `register(api)`，stderr 输出在调用终端 |
| **Gateway 守护进程** | `openclaw gateway run` / systemd `openclaw-gateway` | 走 `loadGatewayStartupPluginPlan` 决定加载列表，stderr 落 systemd journal |

**CLI 跑通 `register()` 不代表 daemon 也会跑**。Daemon 走的是另一条更严的过滤逻辑。这就是为什么 `enable` 时三行 stderr 哨兵能打出来，但聊天会话里依然没工具——daemon 根本没碰过我们的入口。

**调试时务必跑 foreground gateway 抓真实 stderr**：

```bash
sudo systemctl stop openclaw-gateway
openclaw gateway run 2>&1 | tee /tmp/gateway.log
grep '\[second-nature\]' /tmp/gateway.log
```

---

## 3. Gateway startup-plan 的五张入场券

`dist/channel-plugin-ids--6tcYD3B.js` 内 `shouldConsiderForGatewayStartup` 与 `loadGatewayStartupPluginPlan` 决定哪些插件在 daemon 启动时被加载。匹配任一条件即可：

1. `manifest.activation.onStartup === true` ← **Second Nature 走这条**
2. 占据 `plugins.slots.contextEngine` 配置位（origin 必须 bundled）
3. `canStartConfiguredSpeechProviderPlugin`（speech provider）
4. `canStartConfiguredGenerationProviderPlugin`（image-generation provider）
5. `canStartExplicitHookPlugin`（manifest 内 `activation.onCapabilities` 含 `"hook"`，或 host config `entries[id]` 有显式 hook policy）

> **不在这五张入场券任意一张里 → daemon 永远不加载，即便 registry 里 enabled。** 这是 OpenClaw 的设计（避免无关插件被自动拉起），不是 bug。

`activation.onCapabilities` 允许的值（`dist/discovery-B9FIOZR8.js`）：

```js
capability === "provider" || capability === "channel" ||
capability === "tool"     || capability === "hook"
```

---

## 4. `Shape:` 标签是怎么算的

`dist/status-Cuttpn0Y.js` 第 25-77 行：

```js
function buildPluginCapabilityEntries(plugin) {
  return [
    { kind: "cli-backend",            ids: plugin.cliBackendIds ?? [] },
    { kind: "text-inference",         ids: plugin.providerIds },
    { kind: "speech",                 ids: plugin.speechProviderIds },
    { kind: "realtime-transcription", ids: ... },
    { kind: "realtime-voice",         ids: ... },
    { kind: "media-understanding",    ids: ... },
    { kind: "image-generation",       ids: ... },
    { kind: "web-search",             ids: ... },
    { kind: "agent-harness",          ids: ... },
    { kind: "context-engine",         ids: ... },
    { kind: "channel",                ids: plugin.channelIds },
  ].filter(entry => entry.ids.length > 0);
}

function derivePluginInspectShape(params) {
  if (params.capabilityCount > 1) return "hybrid-capability";
  if (params.capabilityCount === 1) return "plain-capability";
  return "non-capability";
}
```

**关键**：`tool` / `command` / `service` **不在 capability kind 列表里**。一个纯 tool/service plugin 的 capabilityCount 永远是 0，Shape 永远是 `non-capability`。

> Second Nature 暴露 `second_nature_ops` 工具 + `second-nature-runtime` / `second-nature-lifecycle` 服务 + `second-nature` 命令 → capabilityCount = 0 → Shape = `non-capability`。**这是 OpenClaw 当前 plugin 分类法对"agent-facing tool plugin"这一类的语义空白**，不是我们漏写字段。

---

## 5. 为什么不假装自己是 context-engine

诱惑：`registerContextEngine(id, factory)` 会让 `contextEngineIds.length === 1`，capabilityCount 立刻变 1，Shape 翻成 `plain-capability`，标签好看。

为什么我们**拒绝**这条：

1. `ContextEngine` 接口要求实现 `ingest / assemble / compact` **三个核心语义方法**（`dist/.../context-engine/types.d.ts`），OpenClaw **真的会在每次 agent message 时调用**。空 factory 等于把 noop 挂在 host 的 context 装配链上，干扰 host 对 context 流的预期。
2. `openclaw plugins info` 会显示 `Capabilities: context-engine: second-nature`——**这是假信息**，未来运维或下游审计读到会困惑。
3. Second Nature 的本质（heartbeat-driven lived experience + agent-facing ops 工具）**不是** OpenClaw context-engine 概念定义的"agent message → context"装配器。强行套是为标签牺牲诚实。

> **当 Second Nature 真的实现了 context-engine 业务（compaction / summarization / context assembly）时，Shape 自然会变 `plain-capability`，那时是真，现在硬贴是假。**

---

## 6. 我们这次的实际修复（0.1.16）

`plugin/openclaw.plugin.json` 的 `activation` 字段（v0.2.10 修订）：

```json
"activation": {
  "onStartup": true
}
```

- **`onStartup: true`** — 第 3 节入场券 1，无条件让 daemon startup-load
- **不再声明 `onCapabilities:["tool"]`** — Feishu/OpenClaw 云端会话可以报告 `capabilities=none`。实机 v0.2.9 证明此字段会把工具注入绑定到 session capability，导致插件已加载、`register(api)` 已执行、`contracts.tools` 正常，但 `second_nature_ops` 仍不进入会话工具列表。
- 工具本质由 `contracts.tools:["second_nature_ops"]` 表达；daemon 加载由 `activation.onStartup:true` 保证。不要为了“语义诚实”把 host-session capability gate 再塞回来。

**Shape 仍然是 `non-capability`**——我们接受这个事实，不为了标签做架构妥协。

---

## 7. 验证清单（发布后真宿主必跑）

```bash
# 0. 装 0.2.10+
openclaw plugins uninstall second-nature
openclaw plugins install npm:@haaaiawd/second-nature@0.2.10

# 1. foreground 跑 daemon，抓真 stderr
sudo systemctl stop openclaw-gateway
openclaw gateway run 2>&1 | tee /tmp/gateway.log
# (等启动稳定，另开终端)

# 2. discovery 名单应包含 second-nature
grep -E 'may auto-load|loaded plugin' /tmp/gateway.log
# 期望: 列表含 second-nature

# 3. 三行 stderr 哨兵（daemon 真的调了 register）
grep '\[second-nature\]' /tmp/gateway.log
# 期望:
#   [second-nature] module evaluated
#   [second-nature] register() entered, api keys=...registerTool,registerCommand,registerService...
#   [second-nature] register() completed

# 4. 标签检查（仅参考，non-capability 是预期）
openclaw plugins info second-nature | grep -E 'Shape|Version'
# 期望: Version: 0.2.10  /  Shape: non-capability

# 5. 浏览器开新会话发探测 prompt
# 期望: tools 列表含 "second_nature_ops", second_nature_ops_present: true
```

第 5 步是真正的验收。前 4 步是定位环节，告诉你"如果第 5 步失败，问题在哪一层"。

---

## 8. 调试时怎么自检（写给未来的我们）

如果将来 OpenClaw 升级、`Shape:` / `auto-load` 行为改了，重新校准的 grep 命令：

```bash
cd ~/.openclaw/npm/node_modules/openclaw

# 入场券逻辑
grep -rn 'shouldConsiderForGatewayStartup\|loadGatewayStartupPluginPlan\|canStart' \
  dist/ 2>/dev/null

# Shape 计算
grep -rn 'plain-capability\|non-capability\|hybrid-capability\|capabilityCount' \
  dist/ 2>/dev/null

# onCapabilities 允许值
grep -rn 'onCapabilities' dist/ 2>/dev/null
```

把这次 README 一遍：本文件**就是**用这三段 grep 反推出来的。下一次遇到分类异常，先用同样路径取证再下结论。

---

## 9. 参考

- `dist/channel-plugin-ids--6tcYD3B.js` — startup-plan 与 hook 入场券
- `dist/status-Cuttpn0Y.js` — Shape / capabilityCount
- `dist/discovery-B9FIOZR8.js` — onCapabilities 允许值
- `dist/plugin-sdk/src/plugin-sdk/plugin-entry.d.ts` — `definePluginEntry` 签名
- `dist/plugin-sdk/src/plugin-sdk/core.d.ts` — channel/setup entry 工厂
- `dist/plugin-sdk/src/plugins/inspect-shape.d.ts` — Shape 类型定义
- `dist/plugin-entry-DfNhOc9j.js` — `definePluginEntry` 实际实现（**确认无 brand symbol，shape 全靠 manifest 推**）
- 仓库内：`plugin/index.ts` 文件头、`reports/second-nature-ops-tool-visibility-issue-2026-05-06.md`
