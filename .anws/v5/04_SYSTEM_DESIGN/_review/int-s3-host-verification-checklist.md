# INT-S3 宿主验证检查清单

**任务**: INT-S3 — S3 集成验证 (Host Closure)  
**创建日期**: 2026-03-31  
**更新日期**: 2026-03-31  
**状态**: 待执行 (需要真实 OpenClaw 宿主环境)  

---

## 前置条件

- [x] 所有 S1 任务已完成 (T1.0.1 ~ T1.2.2, INT-S1) — 代码/测试层完成
- [x] 所有 S2 任务已完成 (T2.0.1 ~ T2.2.2, T5.1.1, INT-S2) — 代码/测试层完成
- [x] 所有 S3 代码任务已完成 (T3.0.1, T3.1.1, T6.1.1) — 代码/测试层完成
- [x] `pnpm test` 全绿 (当前 122/122)
- [ ] 插件已打包 (`npm pack` 在 `plugin/` 目录)
- [ ] OpenClaw 宿主环境可用

---

## 已知风险与待验证项 (非 blocker，但需关注)

### R1: Moltbook 真实平台闭环尚未验证 (T3.1.1)
- **当前状态**: 最小真实客户端代码已实现，测试使用 mock fetch
- **待验证**: 真实 Moltbook API 连通性、OAuth 认证、feed.read 实际返回
- **如失败**: 回退到 T3.0.1 调研结论，检查 API 文档和认证配置

### R2: better-sqlite3 在 --ignore-scripts 安装场景下可能失效 (T1.0.1 已识别)
- **当前状态**: 开发环境验证通过，prebuilds 未确认
- **待验证**: 宿主安装后原生模块是否正常加载
- **如失败**: 检查 `npm install` 是否带 `--ignore-scripts`，考虑 sql.js 备选

### R3: heartbeat 宿主桥接尚未真实接通 (T2.0.1 是策略 POC)
- **当前状态**: 桥接策略已确认 (HEARTBEAT.md + tool use)，代码层 decision loop 完整
- **待验证**: OpenClaw 宿主实际触发 heartbeat → tool call → Second Nature 的完整链路
- **如失败**: 检查 HEARTBEAT.md 配置和 tool 注册是否正确

### R4: 用户直聊连续性 (T6.1.1) 需在真实对话中验证
- **当前状态**: 代码实现完成，`user_reply` scene type 已正式注册到 guidance system
- **待验证**: 实际直聊中语气连续性和人格感是否自然
- **如失败**: 调整 atmosphere 文本和 persona snippet 选择策略

---

## 验证步骤

### 1. 插件安装验证

- [ ] 在宿主环境中安装插件:
  ```bash
  # 方式 A: 本地安装
  openclaw plugin install /path/to/haaaiawd-second-nature-0.1.1.tgz
  
  # 方式 B: ClawHub 安装 (如已发布)
  openclaw plugin install @haaaiawd/second-nature
  ```
- [ ] 验证安装成功:
  ```bash
  openclaw plugins info second-nature
  ```
- [ ] 预期输出:
  - 显示插件名称: "Second Nature"
  - 显示版本: 0.1.1
  - 显示描述: "Registers command/tool/service surface..."

### 2. Command Surface 验证

- [ ] 验证命令注册:
  ```bash
  openclaw plugins info second-nature --commands
  ```
- [ ] 执行核心命令:
  ```bash
  # status 命令
  openclaw second-nature status
  
  # quiet 命令
  openclaw second-nature quiet
  
  # report 命令
  openclaw second-nature report
  
  # session 命令
  openclaw second-nature session
  
  # explain 命令
  openclaw second-nature explain
  ```
- [ ] 预期: 所有命令返回有效结果，**不进入 packaging fallback mode**

### 3. Tool Surface 验证

- [ ] 验证工具注册:
  ```bash
  openclaw plugins info second-nature --tools
  ```
- [ ] 预期: 显示 `second_nature_ops` 工具

### 4. Service Surface 验证

- [ ] 验证服务注册:
  ```bash
  openclaw plugins info second-nature --services
  ```
- [ ] 预期输出:
  - `second-nature-runtime` 服务
  - `second-nature-lifecycle` 服务
- [ ] 验证服务启动:
  ```bash
  openclaw plugins restart second-nature
  ```
- [ ] 预期: 服务正常启动，无错误日志

### 5. Heartbeat 主链验证

- [ ] 确认 heartbeat 配置:
  ```bash
  openclaw config get heartbeat
  ```
- [ ] 触发一次 heartbeat:
  ```bash
  # 等待自然 heartbeat 触发 (默认 30 分钟)
  # 或手动触发 (如支持)
  ```
- [ ] 检查 heartbeat 结果:
  ```bash
  openclaw second-nature report
  ```
- [ ] 预期:
  - heartbeat 产生 `HEARTBEAT_OK` 或 `intent_selected` 结果
  - 结果可被解释 (通过 explain 命令)

### 6. Moltbook 平台连通验证

- [ ] 配置 Moltbook 凭据:
  ```bash
  openclaw second-nature credential set moltbook --api-key <key>
  ```
- [ ] 测试 feed.read:
  ```bash
  openclaw second-nature status --platform moltbook
  ```
- [ ] 预期:
  - 返回 Moltbook feed 数据
  - 或返回认证错误 (如凭据无效)
  - **不应返回 "not implemented" 或空接口**

### 7. 用户任务边界验证

- [ ] 发送明确任务:
  ```
  帮我检查 Moltbook 的最新帖子
  ```
- [ ] 预期:
  - 任务直接执行，**不被节律裁决**
  - 任务链不受 heartbeat 影响

### 8. 用户直聊连续性验证

- [ ] 与 agent 直聊:
  ```
  你今天感觉怎么样？
  ```
- [ ] 预期:
  - 回复有轻量人格连续性
  - **不使用帖子回复腔**
  - 语气自然连贯

### 9. 可观测性验证

- [ ] 检查决策记录:
  ```bash
  openclaw second-nature explain --subject heartbeat
  ```
- [ ] 预期:
  - 显示最近的 heartbeat 决策
  - 包含 runtimeScope, triggerSource, decisionStatus, reasons

### 10. 重启恢复验证

- [ ] 重启 gateway:
  ```bash
  openclaw gateway restart
  ```
- [ ] 验证插件自动加载:
  ```bash
  openclaw plugins info second-nature
  ```
- [ ] 预期:
  - 插件自动加载
  - 服务正常启动
  - 命令可用

---

## 通过标准

- [ ] 插件可安装、加载、查看 surface
- [ ] 核心命令可用 (status, quiet, report, session, explain)
- [ ] heartbeat 主链可验证 (产生 HEARTBEAT_OK 或 allow 结果)
- [ ] 最小平台动作可执行 (Moltbook feed.read)
- [ ] 用户任务边界不被破坏
- [ ] 用户直聊有轻量连续性
- [ ] 决策记录可查询和解释
- [ ] 重启后插件自动恢复

---

## 失败处理

如果任何步骤失败:

1. 记录失败步骤和错误信息
2. 检查插件日志:
   ```bash
   openclaw logs --plugin second-nature
   ```
3. 检查是否进入 packaging fallback mode
4. 如确认是 packaging 问题，回退到 S1 修复
5. 如确认是 heartbeat 问题，回退到 S2 修复

---

## 验证报告模板

```markdown
# INT-S3 验证报告

**验证日期**: YYYY-MM-DD
**验证环境**: [本地/云端]
**OpenClaw 版本**: x.x.x
**插件版本**: 0.1.1

## 验证结果

| 步骤 | 状态 | 备注 |
|------|------|------|
| 1. 插件安装 | ✅/❌ | |
| 2. Command Surface | ✅/❌ | |
| 3. Tool Surface | ✅/❌ | |
| 4. Service Surface | ✅/❌ | |
| 5. Heartbeat 主链 | ✅/❌ | |
| 6. Moltbook 连通 | ✅/❌ | |
| 7. 用户任务边界 | ✅/❌ | |
| 8. 用户直聊连续性 | ✅/❌ | |
| 9. 可观测性 | ✅/❌ | |
| 10. 重启恢复 | ✅/❌ | |

## 问题清单

| # | 问题描述 | 严重度 | 归属 Sprint |
|---|---------|--------|------------|
| 1 | | | |

## 结论

[通过/不通过] - [简要说明]
```
