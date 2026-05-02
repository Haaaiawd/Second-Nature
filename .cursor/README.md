# Cursor 工作流与技能（本仓库）

本目录由 **Second Nature / anws** 工作流使用，并与 `.anws/install-lock.json` 中 `cursor` 目标的 `managedFiles` 对齐。运行 `anws init --target cursor`（或项目约定的安装命令）时，CLI 可同步或校验这些文件。

## 内容说明

| 路径 | 用途 |
|------|------|
| `commands/*.md` | Cursor **Commands**（如 `/genesis`、`/forge`、`/challenge`）的提示词与步骤协议 |
| `skills/**/SKILL.md` | Cursor **Agent Skills** 的触发说明与输出约束 |
| `skills/**/references/` | 技能引用的模板与协议片段 |

## 与架构文档的关系

- **当前真理**始终在 `.anws/` 下**数字最大**的 `v{N}` 目录（与 `AGENTS.md` 中「最新架构版本」一致）。
- Commands / Skills 中的 `{TARGET_DIR}`、`.anws/v{N}` 均指上述最新版本；实现或审查时不要硬编码旧版本号。

## 系统设计契约源

读取 `04_SYSTEM_DESIGN/` 作为**当前契约**时，应排除：

- `*.old.md` 及文件头声明为 **Non-Contract Archive** 的文件  
- `_archive/`、`_legacy/`（若存在）  
- `_review/` 默认视为过程材料，除非任务或用户明确要求纳入  

详见各 Command / Skill 中的说明与 `challenge` 工作流 Step 1。
