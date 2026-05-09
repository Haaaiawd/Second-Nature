# OpenClaw Plugin Debugging Toolkit

> 当 plugin 装上去了但工具没出现在 agent 会话时，按这份决策树走。每一步都给出"看到这个结果意味着什么"。

---

## 0. 前置：永远跑 foreground gateway

systemd 模式下 daemon stderr 落 journal、容易被截断。**调试一律切 foreground**：

```bash
sudo systemctl stop openclaw-gateway
openclaw gateway run 2>&1 | tee /tmp/gateway.log &
GATEWAY_PID=$!
sleep 15

# 调试结束后恢复：
kill $GATEWAY_PID
sudo systemctl start openclaw-gateway
```

---

## 1. 决策树：从症状到根因

```
症状：chat 会话工具表里没有 your_tool_name
  │
  ├─ Step 1：grep '\[your-plugin\]' /tmp/gateway.log
  │   │
  │   ├─ ❌ 完全没有任何匹配
  │   │     → daemon 连你的 module 都没 evaluate
  │   │     → 跳到【场景 A：daemon 没拿到入场券】
  │   │
  │   ├─ ⚠️ 只有 "module evaluated"
  │   │     → manifest 被识别但 register 没被调
  │   │     → 跳到【场景 B：runtimeExtensions 路径错】
  │   │
  │   ├─ ⚠️ 有 "module evaluated" + "register() entered"，没 "register() completed"
  │   │     → register 函数内部抛了
  │   │     → 跳到【场景 C：register 内部异常】
  │   │
  │   └─ ✅ 三行都在
  │         → register 跑通了，问题在更上层
  │         → 跳到【场景 D：注册成功但工具不进会话】
  │
  └─ ...
```

---

## 2. 场景 A：daemon 没拿到入场券

**最常见**。Second Nature 0.1.13 → 0.1.15 全程卡在这里。

### 验证

```bash
# daemon 启动日志里列出了哪些 plugin？
grep 'http server listening' /tmp/gateway.log
# 例：[gateway] http server listening (1 plugins: feishu; 13.3s)
#     ↑ 你的 plugin 不在列表里，证实没拿到入场券

# 配置里你确实是 enabled 的吗？
openclaw plugins list | grep your-plugin
# 应该看到 Status: enabled
```

### 修复

按 5 类入场券检查 manifest：

| 入场券 | 字段 | 适用 |
|--------|------|------|
| 1 | `channels[]` 非空 | IM/会话 channel plugin |
| 2 | `providers[]` 非空 | speech / web-search / image-gen 等 provider |
| 3 | 显式 hook（`hooks.before_agent_start` 等） | 想插入 agent 生命周期的 plugin |
| 4 | `activation.onStartup: true` | tool-only / command-only / service-only plugin |
| 5 | 用户配置 `plugins.enableHookExtensions` 含你的 id | 用户主动 opt-in |

**对 tool-only plugin，第 4 张是最直接的**。改 manifest：
```json
"activation": { "onStartup": true, "onCapabilities": ["tool"] }
```
重新 `pnpm run build:plugin` → `openclaw plugins update <pkg>` → `systemctl restart openclaw-gateway` → 重跑 verification。

---

## 3. 场景 B：runtimeExtensions 路径错

**症状**：哨兵 1 行打了，但没 register。说明 manifest 被识别（module 被 evaluate），但 `runtimeExtensions` 指向的真正的 dist 文件加载失败或文件不存在。

### 验证

```bash
# 安装后的实际路径
ls ~/.openclaw/npm/node_modules/@scope/your-plugin/dist/

# package.json 里声明的 runtimeExtensions 指向的文件存在吗？
cat ~/.openclaw/npm/node_modules/@scope/your-plugin/package.json | jq .openclaw.runtimeExtensions
```

### 修复

- 确认 `openclaw.runtimeExtensions` 指向**编译后的 .js**，不是 `.ts`。
- `package.json` 的 `files` 字段里有 `dist/**`，否则 npm publish 时 dist 不会被打进去。
- `pnpm pack` 验证打出来的 tarball 内容。

---

## 4. 场景 C：register 内部异常

**症状**：`register() entered` 打了，没看到 `register() completed`。

### 验证

```bash
# register entered 之后紧跟着的 stderr 通常就是 stack trace
grep -A 30 '\[your-plugin\] register() entered' /tmp/gateway.log
```

### 常见根因

| stack trace 关键词 | 根因 | 修复 |
|------------------|------|------|
| `SyntaxError: Unexpected identifier 'Promise'` | top-level await | 改静态 import |
| `Cannot find package 'xxx'` | peer dep 没在目标 host 上 | 改成 `dependencies`，或在 plugin install 时 link |
| `import.meta.url` / `URL is not defined` | 模块顶层用了 ESM-only API 但被 CJS 加载 | 把 `import.meta.url` 计算挪到 register() 内部 |
| `TypeError: api.registerXxx is not a function` | host SDK 版本不匹配 | 检查 `compat.pluginApi` |

---

## 5. 场景 D：注册成功但工具不进会话

哨兵三行都打了，`http server listening (N plugins: ..., your-plugin; ...)` 也包含你了，但 chat 会话工具表里依然没有。

### 检查清单

1. **会话是 plugin 加载之前建的**？
   - chat session 的工具表在 session 创建时确定，重启 daemon 后**已存在的 session 不会自动刷新**。
   - 修复：起新 chat session。

2. **工具名拼写不一致**？
   - manifest `contracts.tools` 里的名字必须**完全等于** `api.registerTool({ name: ... })` 里的名字。
   - 检查：`grep -E 'name.*your_tool_name' plugin/dist/index.js`

3. **agent model 主动屏蔽**？
   - 某些 host config 的 `tools.allow` / `tools.deny` 会过滤工具。
   - 检查：`cat ~/.openclaw/openclaw.json | jq .tools`

4. **工具被认为需要配置但用户没配**？
   - 如果 manifest 里写了 `toolMetadata[tool].configSignals` 且必填项缺失，host 可能会隐藏它。
   - 检查：`openclaw plugins info your-plugin` 看 capability/config 报告。

---

## 6. 可信度光谱

调试时各种证据**不是等价的**，按可信度从高到低：

| 等级 | 证据 | 可信度 |
|------|------|------|
| ⭐⭐⭐⭐⭐ | agent 在 chat 会话里**实际调用** your_tool_name 并返回正常结果 | 100%（终极验证） |
| ⭐⭐⭐⭐ | agent 列 tools 数组（JSON）含 your_tool_name | 高（接近真实使用面） |
| ⭐⭐⭐ | foreground gateway log 三行哨兵齐全 + listening 列表含你 | 高（daemon 加载成功） |
| ⭐⭐ | `openclaw plugins info` 显示 enabled / loaded | 中（CLI 视角，不代表 daemon） |
| ⭐ | `openclaw plugins enable` 没报错 | 低（只证明 manifest 合法） |

→ **不要用低等级证据替代高等级证据**。CLI enable 跑通就以为搞定了，是这次踩坑的核心起源。

---

## 7. 一键诊断脚本（建议放进 plugin repo）

```bash
#!/usr/bin/env bash
# scripts/diagnose-plugin.sh
set -e
PLUGIN_ID="${1:-your-plugin}"
LOG=/tmp/gateway.log

echo "=== 1. plugin info ==="
openclaw plugins info "$PLUGIN_ID" || true

echo "=== 2. installed dist ==="
ls ~/.openclaw/npm/node_modules/*/$(basename $PLUGIN_ID)/dist/ 2>/dev/null || \
  echo "(no install found)"

echo "=== 3. recent gateway log entries ==="
grep -E "\[$PLUGIN_ID\]|plugins listening|$PLUGIN_ID" "$LOG" 2>/dev/null | tail -30

echo "=== 4. config allowlist ==="
cat ~/.openclaw/openclaw.json | jq ".plugins // {}"

echo "=== verdict ==="
if grep -q "\[$PLUGIN_ID\] register() completed" "$LOG"; then
  echo "✅ register completed"
elif grep -q "\[$PLUGIN_ID\] register() entered" "$LOG"; then
  echo "⚠️  register threw — 看上面 log 里 stack trace"
elif grep -q "\[$PLUGIN_ID\] module evaluated" "$LOG"; then
  echo "⚠️  module evaluated 但 register 没被调 — runtimeExtensions 路径或 module shape 问题"
else
  echo "❌ daemon 完全没加载你 — 缺 daemon 入场券（活化 activation.onStartup）"
fi
```
