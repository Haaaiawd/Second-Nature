# cli-system 调研摘要

**日期**: 2026-03-23
**来源工作流**: `/explore`
**系统**: `cli-system`

---

## 1. 核心结论

- `cli-system` 不该是“会说话的黑盒向导”，而应是 **command-first, explain-first, local-first operator console**。
- 最推荐模式是：`Command Surface + Read Models + Explain Trace + Guided Prompt`
- explainability 应优先结构化，再提供 prose，而不是大段自由解释。
- prompt 只用于首次配置、缺参补足、人工恢复，不应成为系统主交互范式。

## 2. 推荐架构模式

- `Command Surface`
- `Read Models`
- `Explain Trace`
- `Guided Prompt`

## 3. 建议吸收的设计点

- GitHub CLI：`--json` 与人类输出并行一等公民
- kubectl / flyctl：稳定资源模型、脚本友好命令语义
- Temporal CLI：profile/config/env precedence
- Bubble Tea / Ink：仅在局部浏览工作台中使用 TUI
- OPA explain：拒绝原因显示命中的规则与失败的规则

## 4. 应避免的反模式

- 把 CLI 做成自然语言聊天壳
- 全交互 wizard 替代显式命令
- 直接暴露底层 SQLite / JSONL 结构
- 用一个 `status` 命令塞进所有信息
- 用纯文本长解释替代结构化 explain

## 5. 对本系统的直接影响

- 一级对象建议：`status`, `policy`, `platform`, `connector`, `credential`, `quiet`, `report`, `session`, `audit`, `memory`, `explain`
- 输出模式建议：`table`, `detail`, `json`, `explain`
- `status` 需要分块：runtime、rhythm、quiet、credentials、connectors、pending actions、risk summary
- `session show` 应升级为 `decision summary + decision factors + policy refs + outcome + audit refs`
- `why denied / why selected / why outreach / why soul changed` 应作为 explain read model 一等支持

## 6. 参考资料

- `https://cli.github.com/manual/gh_help_formatting`
- `https://kubernetes.io/docs/reference/kubectl/jsonpath/`
- `https://fly.io/docs/flyctl/`
- `https://fly.io/docs/flyctl/integrating/`
- `https://docs.temporal.io/cli`
- `https://docs.temporal.io/develop/environment-configuration#cli-integration`
- `https://www.openpolicyagent.org/docs/latest/cli`
- `https://github.com/charmbracelet/bubbletea`
- `https://github.com/vadimdemedes/ink`
- `https://github.com/charmbracelet/huh`
