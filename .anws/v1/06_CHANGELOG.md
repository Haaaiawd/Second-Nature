# 变更日志 - .anws v1

> 此文件记录本版本迭代过程中的微调变更（由 /change 处理）。新增功能/任务需创建新版本（由 /genesis 处理）。

## 格式说明
- **[CHANGE]** 微调已有任务（由 /change 处理）
- **[FIX]** 修复问题
- **[REMOVE]** 移除内容

---

## 2026-03-22 - 初始化
- [ADD] 创建 `.anws` v1 版本

## 2026-03-22 - /genesis 产出
- [ADD] 生成 `concept_model.json`，明确 personal agent companion、探索预算与风险边界
- [ADD] 完成 `01_PRD.md`，定义产品定位为跨平台探索控制层，而非通用 runtime 或平台 CLI 替代品
- [ADD] 完成 `02_ARCHITECTURE_OVERVIEW.md`，定义本地优先架构、控制层边界与 connector family
- [ADD] 完成平台调研报告，明确 Moltbook、InStreet、EvoMap 为首批适配目标
- [ADD] 新增 `03_ADR/ADR_001_TECH_STACK.md` 与 `03_ADR/ADR_002_CONNECTOR_MODEL.md`

## 2026-03-22 - 文档状态收口
- [CHANGE] 同步 `AGENTS.md` 当前状态区与导航说明
  - 用户原话: "请你修复一下这些残余的小问题，修复完再来找我我们来设计系统"
  - 修改内容: 将任务清单、系统设计与 challenge 报告的真实状态同步到项目状态区，并明确 `05_TASKS.md` 当前为建议性草案
  - 影响范围: `AGENTS.md`
  - PRD 追溯: [REQ-005]
- [CHANGE] 收口 `02_ARCHITECTURE_OVERVIEW.md` 的过时建议
  - 用户原话: "如果只是删除无用的你说的老旧的那个建议，我觉得是可以的"
  - 修改内容: 移除已过时的“待创建/先完成再进入”表述，改为反映当前系统设计完成度与后续 blueprint 重构建议
  - 影响范围: `.anws/v1/02_ARCHITECTURE_OVERVIEW.md`
  - PRD 追溯: [REQ-001], [REQ-005]
- [CHANGE] 明确 `05_TASKS.md` 为 challenge 承接草案
  - 用户原话: "我们的现在的tasks类似占位符"
  - 修改内容: 增加文件状态说明，明确当前任务清单是建议性/占位草案，后续由 `/blueprint` 重构为完整 WBS
  - 影响范围: `.anws/v1/05_TASKS.md`
  - PRD 追溯: [REQ-001], [REQ-005]
