# .anws v6 - 版本清单

**创建日期**: 2026-05-15
**状态**: Draft / Blueprint-ready
**前序版本**: v5

## 版本目标
将 Second Nature 从"平台数据搬运工 + 通知发送器"演进为"有自我叙事、有目标追求、能持续成长的 Agent"。引入 Agent Self Layer（叙事连贯性、经验提炼、关系记忆、目标追求），同时建设 Connector Ecosystem 与多通道 Outreach。

> **Gate**: v6 的 `04_SYSTEM_DESIGN/*.md` 已补齐，`07_CHALLENGE_REPORT.md` Round 5 的 DR5-01～03 已回流；进入实现时以 `05A_TASKS.md`、`05B_VERIFICATION_PLAN.md` 与各系统设计文档为准。

## 主要变更
- [ ] Quiet 更名为 Dream，引入 Claude Dream 式持续记忆与自我叙事机制
- [ ] 新增 Agent Self Layer：Narrative State、Relationship Memory、Insight Extraction、Goal-Directed Planning
- [ ] Connector Ecosystem：动态 manifest 注册、SDK/CLI 生成、声明式 runner 安全底座；15+ 联盟站点作为后续内容建设
- [ ] Outreach 三层投递：心跳静默、发现推送、紧急告警
- [ ] CapabilityContractRegistry 开放注册/命名空间
- [ ] Skill 联动架构：intent → skill dispatch 分支（当前 deferred，需单独信任模型）
- [ ] 加密密钥管理强化
- [ ] 可观测性消费：dashboard、定期摘要、调试命令

## 文档清单
- [ ] 00_MANIFEST.md (本文件)
- [ ] 01_PRD.md
- [ ] 02_ARCHITECTURE_OVERVIEW.md
- [ ] 03_ADR/
- [ ] 04_SYSTEM_DESIGN/ (7 个系统设计已补齐；部分复杂系统含 `.detail.md`)
- [ ] 05A_TASKS.md (执行主清单，由 /blueprint 生成)
- [ ] 05B_VERIFICATION_PLAN.md (验证计划，由 /blueprint 生成)
- [ ] 05_TASKS.md (旧版合并任务草案，保留兼容)
- [ ] 06_CHANGELOG.md
- [ ] 07_CHALLENGE_REPORT.md
