# Windsurf 工作流与技能（本仓库）

本目录与 `.anws/install-lock.json` 中 `windsurf` 目标的 `managedFiles` 对齐，对应 Cursor 侧的 `.cursor/commands/` 与 `.cursor/skills/`：工作流在 `workflows/`，技能在 `skills/`。安装或更新时请使用项目约定的 `anws init --target windsurf`（或等价命令）。

## 与架构文档的关系

- **当前真理**：`.anws/` 下数字最大的 `v{N}`（与根目录 `AGENTS.md` 一致）。
- 各 workflow 中的 `{TARGET_DIR}` 即该最新版本目录。

## 系统设计契约源

与 `.cursor/README.md` 相同：加载 `04_SYSTEM_DESIGN/` 时排除 `*.old.md`、**Non-Contract Archive**、`_archive/`、`_legacy/`；`_review/` 默认不作为当前契约源，除非任务或用户明确要求。
