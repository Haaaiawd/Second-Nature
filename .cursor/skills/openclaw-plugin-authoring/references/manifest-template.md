# OpenClaw Plugin Manifest & Package 模板（带注释）

> 与 OpenClaw 2026.5.x 对齐。所有"为什么这样写"的解释都在注释里——如果将来 OpenClaw 升级让某个字段变了语义，请用 SKILL.md 里指向的 `docs/validation/openclaw-plugin-classification.md` 重新校准 host 源码位置。

---

## 1. `plugin/openclaw.plugin.json` 完整模板

```jsonc
{
  // === 身份 ===
  "id": "your-plugin",
  // ↑ 唯一标识。plugins.allow / plugins.enableHookExtensions / plugins.disable
  // 这些配置都用这个字段匹配，**不是** npm 包名。
  // 命名建议：kebab-case，避免 scope 前缀（npm 包名才用 @scope/）。

  "name": "Your Plugin",
  "version": "0.1.0",
  "description": "一句话讲清楚你这个 plugin 给 OpenClaw 添加了什么 surface。",

  // === 入场券（决定 daemon 启动是否加载你）===
  "activation": {
    "onStartup": true,
    // ↑ tool-only / command-only / service-only plugin **必须**为 true，
    //   否则 daemon 的 loadGatewayStartupPluginPlan 会跳过你。
    //   如果你声明了 channel / provider，可以为 false（host 会按需启动）。

    "onCapabilities": ["tool"]
    // ↑ 仅作 metadata，host 不强校验。声明你打算贡献的 surface 类型，
    //   方便其他工具（如 dashboard）筛选。
  },

  // === Surface 声明（contracts，不是 capabilities）===
  // 注意：旧版 OpenClaw 用 `capabilities`，2026.5.x 已经改为 `contracts`。
  // 写错字段名会让 plugin info 显示为 plain plugin 但 surface 不工作。
  "contracts": {
    "tools":    ["your_tool_name"],         // 在 agent 会话里出现的 tool 名
    "commands": ["your-command"],            // 在 OpenClaw CLI 注册的子命令
    "services": ["your-runtime"]             // host 内部服务，供其他 plugin 引用
  },

  // === Channel plugin 才需要（IM/会话通道）===
  // "channels": ["feishu"],
  // "channelEnvVars": {
  //   "feishu": ["FEISHU_APP_ID", "FEISHU_APP_SECRET"]
  // },

  // === Provider plugin 才需要 ===
  // "providers": ["speech", "web-search"],

  // === Tool metadata（可选）===
  // 声明工具的配置依赖，控制 dashboard 是否引导用户填配置。
  // "toolMetadata": {
  //   "your_tool_name": {
  //     "configSignals": [
  //       { "rootPath": "tools.your-plugin", "required": ["apiKey"] }
  //     ]
  //   }
  // },

  // === 配置 schema（用户在 openclaw.json 里填的部分）===
  "configSchema": {
    "type": "object",
    "additionalProperties": false,
    "properties": {
      // 例：
      // "enabled": { "type": "boolean", "default": true },
      // "apiBase": { "type": "string", "format": "uri" }
    }
  }
}
```

---

## 2. `plugin/package.json` 模板

```jsonc
{
  "name": "@scope/your-plugin",
  "version": "0.1.0",
  "type": "module",
  "main": "./dist/index.js",
  "files": [
    "dist/**",
    "openclaw.plugin.json",
    "skills/**"
  ],

  "openclaw": {
    "runtimeExtensions": ["./dist/index.js"],
    // ↑ daemon 真正 import 的产物路径（编译后）。
    //   openclaw plugins update 安装后，host 会从这里加载。
    //   ./index.ts 不行，必须是已编译的 .js。

    "compat": {
      "pluginApi": ">=2026.5.4"
      // ↑ 与 host 版本兼容性约束。host 版本不达标会拒绝加载并给出明确错误。
    },

    "build": {
      "openclawVersion": "2026.5.4"
      // ↑ 你打这个 dist 时用的 host 版本，作为构建溯源。
    }
  },

  "peerDependencies": {
    "openclaw": ">=2026.5.4"
  },
  "peerDependenciesMeta": {
    "openclaw": { "optional": true }
    // ↑ optional 让 npm install 时不会强求装 openclaw 主包；
    //   实际由 openclaw plugins update 在目标 host 上 link 现有 host 实例。
  },

  "devDependencies": {
    "openclaw": "2026.5.4"
    // ↑ 本地开发时用，让 TypeScript 能解析 `openclaw/plugin-sdk/...` import。
  }
}
```

---

## 3. Channel plugin 变体（用 Feishu 做参考）

如果你的 plugin 是 IM/会话 channel，**不需要** `activation.onStartup`——host 会因为 `channels: ["feishu"]` 自动给你入场券。

```jsonc
{
  "id": "feishu",
  "activation": { "onStartup": false },   // ← channel plugin 这里写 false 也能加载
  "channels": ["feishu"],
  "contracts": {
    "tools": ["feishu_chat", "feishu_doc", "..."]
  },
  "channelEnvVars": {
    "feishu": ["FEISHU_APP_ID", "FEISHU_APP_SECRET"]
  }
}
```

完整示例参见目标 host 上的 `~/.openclaw/npm/node_modules/@openclaw/feishu/openclaw.plugin.json`。

---

## 4. Context-engine plugin 变体（**只有真正实现时才用**）

> ⚠️ 不要为了让 `Shape` 好看伪造 context-engine。host 会调用 `ingest` / `assemble` / `compact`，假实现一定在某个 code path 上炸。

```jsonc
{
  "id": "your-context-engine",
  "activation": { "onStartup": true },
  "contextEngine": {
    "name": "your-engine",
    "supportedFormats": ["markdown", "code"]
  }
}
```

入口里必须真正实现：
```typescript
api.registerContextEngine({
  name: "your-engine",
  async ingest(input) { /* 真实存储逻辑 */ },
  async assemble(query) { /* 真实检索逻辑 */ },
  async compact(state) { /* 真实压缩逻辑 */ },
});
```

---

## 5. 入口 `plugin/index.ts` 完整模板

```typescript
// ⚠️ 必须是静态 import。OpenClaw daemon 用 Node VM 执行插件，
//    任何 top-level `await` 都会让加载失败并报 SyntaxError。
import { definePluginEntry } from "openclaw/plugin-sdk/plugin-entry";

// === 三行 stderr 哨兵：诊断资产，生产环境也保留 ===
process.stderr.write("[your-plugin] module evaluated\n");

export default definePluginEntry({
  id: "your-plugin",
  name: "Your Plugin",
  version: "0.1.0",

  register(api) {
    process.stderr.write(
      `[your-plugin] register() entered, api keys=${Object.keys(api).join(",")}\n`
    );

    // === 必须在 register 同步调用栈里完成所有 surface 注册 ===
    api.registerTool({
      name: "your_tool_name",
      description: "...",
      inputSchema: { /* JSON Schema */ },
      async handler(input, ctx) {
        // 业务逻辑
        return { result: "..." };
      },
    });

    api.registerCommand({
      name: "your-command",
      handler: async (argv) => { /* ... */ },
    });

    api.registerService({
      name: "your-runtime",
      factory: () => createYourService(),
    });

    process.stderr.write("[your-plugin] register() completed\n");
  },
});
```

---

## 6. Build 校验脚本必查项

`scripts/build-plugin-package.ts` 必须 assert：

```typescript
// 4 处 version 完全一致
assert.equal(rootPkg.version, pluginPkg.version);
assert.equal(pluginPkg.version, manifest.version);
assert.equal(manifest.version, hardcodedRuntimeVersion);

// 入场券存在（tool-only plugin）
if (manifest.contracts?.tools?.length && !manifest.channels?.length) {
  assert.equal(manifest.activation?.onStartup, true,
    "tool-only plugin requires activation.onStartup: true");
}

// 弃用字段不再出现
assert.equal(manifest.entry, undefined,
  "manifest.entry is deprecated; use package.json openclaw.runtimeExtensions");

// runtime 入口路径真实存在
assert.ok(fs.existsSync(path.join(distDir, "index.js")));
```
