# .anws v4 - 版本清单

**创建日期**: 2026-03-27
**状态**: Active
**前序版本**: v3

## 版本目标
在 v3 已完成 guidance 闭环基础上，为 Second Nature 补正式的 heartbeat runtime 接入口与可发布的自足 plugin packaging，明确节律只控制自由心跳链，不接管用户明确任务链。

## 主要变更
- 明确 Heartbeat 主入口与 User Task / User Reply 边界
- 将 runtime packaging 从源码依赖模式升级为可独立发布的插件运行时产物
- 明确 heartbeat 作为 Second Nature 自由脉搏入口，用户明确任务不进入节律裁决

## 文档清单
- [x] 00_MANIFEST.md (本文件)
- [x] 01_PRD.md
- [x] 02_ARCHITECTURE_OVERVIEW.md
- [x] 03_ADR/
- [ ] 04_SYSTEM_DESIGN/
- [ ] 05_TASKS.md (由 /blueprint 生成)
- [x] 06_CHANGELOG.md
