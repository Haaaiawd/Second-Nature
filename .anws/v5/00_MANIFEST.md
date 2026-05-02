# .anws v5 - 版本清单

**创建日期**: 2026-05-01
**状态**: Active
**前序版本**: v4

## 版本目标
在 v4 已完成 host-safe heartbeat bridge 与 plugin runtime spine 的基础上，把 Second Nature 从“可被唤醒”推进到“能基于真实生活记录、Quiet 记忆和高阈值判断主动靠近用户”的体验闭环。

## 主要变更
- 将 `heartbeat_check` 从 host-safe acknowledgment 推进为可进入真实 decision loop 的运行入口
- 闭合主动联系用户链路：生活证据 -> outreach 判断 -> guidance/message -> 可审计发送或静默
- 将 README 中的“长期存在感 / 自己的生活”收束为可验证的运行契约，而不是只停留在产品叙事

## 文档清单
- [x] 00_MANIFEST.md (本文件)
- [x] 01_PRD.md
- [x] 02_ARCHITECTURE_OVERVIEW.md
- [x] 03_ADR/
- [x] 04_SYSTEM_DESIGN/ (由 /design-system 更新)
- [x] 05_TASKS.md (由 /blueprint 生成，已通过 /change 修复 review 回流项)
- [x] 06_CHANGELOG.md
