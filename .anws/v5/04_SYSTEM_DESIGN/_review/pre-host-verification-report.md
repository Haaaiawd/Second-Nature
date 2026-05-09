# 宿主前报告 (Pre-Host Verification Report)

**项目**: Second Nature v4  
**报告日期**: 2026-03-31  
**状态**: 准备进入宿主验证  

---

## 1. 当前完成状态摘要

### 代码/测试层已完成

| Sprint | 任务 | 完成状态 | 说明 |
|--------|------|---------|------|
| S1 | T1.0.1 ~ T1.2.2, INT-S1 | ✅ 完成 | Plugin runtime packaging 闭环 |
| S2 | T2.0.1 ~ T2.2.2, T5.1.1, INT-S2 | ✅ 完成 | Heartbeat spine 闭环 |
| S3 | T3.0.1, T3.1.1, T6.1.1 | ✅ 代码完成 | Moltbook 客户端 + user reply continuity |
| S3 | INT-S3 | 📋 检查清单就绪 | 待宿主环境执行 |

**测试状态**: 122/122 全绿

### 待宿主验证补齐的证据

| 任务 | 当前证据 | 待宿主验证 |
|------|---------|-----------|
| T3.1.1 | 最小客户端代码 + mock 测试 | 真实 Moltbook API 连通性 |
| T2.0.1 | 桥接策略 POC 报告 | 真实 heartbeat → tool call 链路 |
| T6.1.1 | 代码实现 + 单元测试 | 真实对话中的语气连续性 |
| INT-S3 | 检查清单 | 完整宿主环境验证 |

---

## 2. 进入宿主验证前的已知风险

### R1: Moltbook 真实平台闭环 (T3.1.1)
- **风险**: 当前测试使用 mock fetch，未验证真实 API
- **影响**: 如果 Moltbook API 不可用或认证失败，T3.1.1 的"真实平台闭环"不成立
- **缓解**: T3.0.1 已确认 API 存在 (moltbook.apidog.io)，OAuth 认证通过 CLI 管理
- **回退**: 如果 API 不可用，降级到 skill fallback 路径

### R2: better-sqlite3 原生模块 (T1.0.1)
- **风险**: `--ignore-scripts` 安装场景下原生模块可能无法编译
- **影响**: 插件安装后 storage 层可能不可用
- **缓解**: better-sqlite3 在 dependencies 中，npm install 默认会编译
- **回退**: 考虑 sql.js 作为备选方案

### R3: Heartbeat 宿主桥接 (T2.0.1)
- **风险**: 策略 POC 已确认，但真实宿主链路未验证
- **影响**: HEARTBEAT.md + tool use 桥接可能在宿主中行为不同
- **缓解**: 桥接策略基于 OpenClaw 官方文档确认
- **回退**: 检查 HEARTBEAT.md 配置和 tool 注册

### R4: user_reply scene type (T6.1.1)
- **风险**: 新注册的 scene type 在 guidance system 中的行为需验证
- **影响**: 用户直聊可能不获得预期的轻量连续性
- **缓解**: 已在 guidance-assembler、template-registry、persona-selection 中完整注册
- **回退**: 调整 atmosphere 文本和 persona snippet 策略

---

## 3. 需要特别关注的验证点

### 高优先级
1. **插件安装后命令可用** — 验证 packaging fallback mode 不成为常态
2. **Heartbeat 主链可验证** — 确认 heartbeat → decision → observability 链路
3. **Moltbook feed.read 可执行** — 确认真实 API 连通性

### 中优先级
4. **用户任务边界** — 确认明确任务不被节律裁决
5. **用户直聊连续性** — 确认语气自然、不似帖子回复
6. **重启恢复** — 确认插件自动加载

### 低优先级
7. **Service surface 信息** — 确认 `plugins info` 显示正确

---

## 4. 失败回退策略

| 失败现象 | 优先回退任务线 | 排查方向 |
|---------|--------------|---------|
| 命令进入 fallback mode | S1 (T1.2.1) | 检查 plugin wrapper 路径解析 |
| Heartbeat 不触发 | S2 (T2.0.1) | 检查 HEARTBEAT.md 配置 |
| Moltbook API 失败 | S3 (T3.0.1) | 检查认证和 API 文档 |
| better-sqlite3 加载失败 | S1 (T1.0.1) | 检查原生模块编译 |
| 用户直聊不连续 | S3 (T6.1.1) | 调整 guidance atmosphere |

---

## 5. 不建议进入宿主验证的情况

如果出现以下情况，建议先修复再进入宿主验证：

- [ ] `pnpm test` 不全绿
- [ ] 插件打包失败 (`npm pack` 在 `plugin/` 目录)
- [ ] 已知 R1-R4 中有 blocker 级别的确认失败

---

## 6. 结论

**当前状态**: ✅ 建议进入真实 OpenClaw 宿主测试

**理由**:
1. 所有代码任务已完成，122/122 测试全绿
2. S1/S2 集成验证已通过
3. S3 代码任务已完成，检查清单就绪
4. 已知风险均为非 blocker，有明确的回退策略
5. T6.1.1 的 scene 语义漂移已修复，`user_reply` 已正式注册到 guidance system

**注意事项**:
- T3.1.1 的"真实平台闭环"证据需宿主验证补齐，当前为"最小真实客户端实现完成"
- T2.0.1 的"宿主桥接"证据需宿主验证补齐，当前为"桥接策略已确认"
- T6.1.1 的"用户直聊连续性"需真实对话验证

---

## 附录: 改动清单

本轮宿主前整理涉及以下文件:

| 文件 | 改动类型 | 说明 |
|------|---------|------|
| `src/guidance/types.ts` | 修改 | 添加 `user_reply` 到 GuidanceSceneType |
| `src/guidance/template-registry.ts` | 修改 | 排除 `user_reply` 从 impulse template |
| `src/guidance/guidance-assembler.ts` | 修改 | `user_reply` scene 不选 impulses |
| `src/guidance/persona-selection.ts` | 修改 | 添加 `user_reply` persona selection policy |
| `src/core/second-nature/guidance/user-reply-continuity.ts` | 修改 | sceneType 从 `"explain"` 改为 `"user_reply"` |
| `tests/integration/guidance/user-reply-continuity.test.ts` | 修改 | 更新测试断言 |
| `.anws/v4/04_SYSTEM_DESIGN/_review/int-s3-host-verification-checklist.md` | 更新 | 添加风险说明和前置条件校准 |
| `.anws/v4/04_SYSTEM_DESIGN/_review/pre-host-verification-report.md` | 新增 | 本报告 |
