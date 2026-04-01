# T3.0.1 Moltbook 对接路径确认报告

**Task**: T3.0.1 — 确认 Moltbook 最小真实对接路径与文档依据  
**Date**: 2026-03-31  
**Status**: Complete  

---

## Executive Summary

**选定主对接路径**: REST API-first + CLI skill fallback  
**认证方式**: OAuth 2.0 (via CLI `moltbook login`)  
**最小能力**: `feed.read`  

---

## 调研结论

### 1. REST API 存在性: ✅ 确认

- **官方 API 文档**: `moltbook.apidog.io` (Apidog 托管)
- **GitHub 仓库**: `github.com/moltbook/api` (69 stars, MIT license)
- **发布时间**: 2026 年 1 月
- **覆盖能力**: feed.read, post.publish, comment.reply, notifications, following, DMs, search

### 2. CLI/Skill Fallback: ✅ 确认

| 资源 | 标识 | Stars |
|------|------|-------|
| OpenClaw skill | `openclaw-skills-moltbook-cli` v1.1.0 | 1905 |
| MCP server (JS) | `terminalcraft/moltbook-mcp` | 9 |
| MCP server (Py) | `thebenlamm/moltbook-mcp` | — |

### 3. 认证要求

- **认证方式**: OAuth 2.0
- **凭证管理**: CLI 处理 token 刷新 (`moltbook login` / `moltbook whoami`)
- **凭证存储**: `~/.config/moltbook/credentials.json`
- **建议**: 使用 CLI 管理认证，而非原始 HTTP 请求

### 4. 速率限制

- 帖子间隔: 30+ 分钟
- 策略: engagement-first (优先互动而非发布)

---

## 对接路径决策

### 主路径: REST API (api_rest)

```
Second Nature → fetch() → Moltbook REST API → 标准化结果
```

- 使用 `api_rest` channel
- Bearer token 认证
- JSON 请求/响应

### 备选路径: CLI Skill (skill)

```
Second Nature → OpenClaw skill runner → moltbook CLI → 标准化结果
```

- 使用 `skill` channel
- 通过 OpenClaw skill 调用 CLI
- CLI 处理认证和 token 刷新

---

## 最小能力定义

**首选**: `feed.read`
- 读取用户 feed
- 无需写权限
- 最低风险
- 可验证真实 API 连通性

**后续**: `post.publish`, `comment.reply`

---

## 风险登记

| 风险 | 严重度 | 缓解措施 |
|------|--------|---------|
| API 文档可能变化 | Medium | 使用 adapter seam 隔离，易于替换 |
| OAuth token 过期 | Medium | CLI skill fallback 处理 token 刷新 |
| 速率限制 | Low | connector policy layer 处理 cooldown |
