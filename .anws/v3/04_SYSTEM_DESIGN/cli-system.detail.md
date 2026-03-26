# CLI System — 实现细节 (L1)

> **文件性质**: L1 实现层 · **对应 L0**: [`cli-system.md`](./cli-system.md)
> 本文件仅在 `/forge` 任务明确引用时加载。日常阅读和任务规划请优先看 L0。
> **⚠️ 孤岛检查**: 本文件各节均须在 L0 有对应超链接入口，禁止孤岛内容。

---

## 版本历史

| 版本 | 日期         | Changelog |
| ---- | ------------ | --------- |
| v2.0 | 2026-03-23 | 初始版本 |

---

## 本文件章节索引

|   §   | 章节 | 对应 L0 入口 |
| :---: | ---- | :----------: |
|  §1   | [配置常量](#1-配置常量-config-constants) | L0 §6 数据模型 |
|  §2   | [完整数据结构](#2-核心数据结构完整定义-full-data-structures) | L0 §6 数据模型 |
|  §3   | [核心算法伪代码](#3-核心算法伪代码-non-trivial-algorithm-pseudocode) | L0 §5 操作契约表 |
|  §4   | [决策树详细逻辑](#4-决策树详细逻辑-decision-tree-details) | L0 §4 架构图 |
|  §5   | [边缘情况与注意事项](#5-边缘情况与注意事项-edge-cases--gotchas) | L0 §5 / §9 |
|  §6   | [测试辅助](#6-测试辅助-test-helpers) | L0 §11 测试策略 |

---

## §1 配置常量 (Config Constants)

```ts
export const OUTPUT_MODES = ['table', 'detail', 'json', 'explain'] as const;

// `cli-system` 的首要实现形态是 OpenClaw plugin 注册出的 command / tool / service surface。
// Command parser 是 surface 实现，不代表本系统是终端产品本体。

export const COMMAND_GROUPS = {
  root: ['status', 'policy', 'platform', 'connector', 'credential', 'quiet', 'report', 'session', 'audit', 'memory', 'explain'],
} as const;

export const RESPONSE_CONFIG = {
  defaultMode: 'json',
  explainMode: 'explain',
  humanReadableModes: ['table', 'detail'],
} as const;
```

---

## §2 核心数据结构完整定义 (Full Data Structures)

```ts
export interface StatusReadModel {
  runtime: RuntimeSummary;
  rhythm: RhythmSummary;
  quiet: QuietSummary;
  connectors: ConnectorSummary[];
  credentials: CredentialSummary[];
  risk: RiskSummary;
}

export interface CredentialReadModel {
  platformId: string;
  status: 'missing' | 'pending_verification' | 'active' | 'expired' | 'revoked' | 'failed';
  lastUpdatedAt?: string;
  nextStep?: string;
}

export interface ExplainReadModel {
  subjectType: 'decision' | 'platform-selection' | 'outreach' | 'soul-change';
  conclusion: string;
  keyFactors: string[];
  evidenceRefs: string[];
  policyRefs?: string[];
  requiredUserInput?: string[];
  nextStep?: string;
}
```

---

## §3 核心算法伪代码 (Non-Trivial Algorithm Pseudocode)

### §3.1 policySet

**对应契约**: L0 §5.1 — `policySet(input)`
**准入理由**: 需要非交互校验与稳定写入桥接。

```ts
async function policySet(input: PolicyWriteInput): Promise<CliResult<PolicyView>> {
  const validated = validatePolicyInput(input);
  if (!validated.ok) return validationError(validated.error);

  await actionBridge.savePolicy(validated.value);
  return success(await readModels.loadPolicy(validated.value.platformId));
}
```

### §3.2 statusShow

**对应契约**: L0 §5.1 — `statusShow(scope)`
**准入理由**: 需跨系统聚合 runtime/rhythm/quiet/credential/connectors/risk。

```ts
async function statusShow(scope?: string): Promise<CliResult<StatusReadModel>> {
  const status = await readModels.loadStatus(scope);
  return success(status);
}
```

### §3.3 credentialShow

**对应契约**: L0 §5.1 — `credentialShow(platformId)`
**准入理由**: 需最小披露显示 credential lifecycle 与恢复步骤。

```ts
async function credentialShow(platformId: string): Promise<CliResult<CredentialReadModel>> {
  const view = await readModels.loadCredential(platformId);
  return success(view);
}
```

### §3.4 credentialVerify

**对应契约**: L0 §5.1 — `credentialVerify(platformId, answer)`
**准入理由**: 需要非交互验证提交通道和恢复路径输出。

```ts
async function credentialVerify(platformId: string, answer: string): Promise<CliResult<CredentialReadModel>> {
  if (!answer) {
    return validationError({
      code: 'MISSING_VERIFICATION_ANSWER',
      message: 'verification answer is required',
      requiredUserInput: ['verification_answer'],
    });
  }
  await actionBridge.verifyCredential(platformId, answer);
  return success(await readModels.loadCredential(platformId));
}
```

### §3.5 reportShow

**对应契约**: L0 §5.1 — `reportShow(day)`
**准入理由**: 要将日报从原始资产提升为聚合可读模型。

```ts
async function reportShow(day: string): Promise<CliResult<DailyReportReadModel>> {
  const report = await readModels.loadDailyReport(day);
  return success(report);
}
```

### §3.6 quietShow

**对应契约**: L0 §5.1 — `quietShow(scope)`
**准入理由**: Quiet 是一等对象，需要解释当前窗口、上次运行、最近中断原因。

```ts
async function quietShow(scope?: string): Promise<CliResult<QuietReadModel>> {
  const quiet = await readModels.loadQuiet(scope);
  return success(quiet);
}
```

### §3.7 sessionShow

**对应契约**: L0 §5.1 — `sessionShow(sessionId)`
**准入理由**: 需要展示 decision summary + outcome + audit refs。

```ts
async function sessionShow(sessionId: string): Promise<CliResult<SessionDetailReadModel>> {
  const session = await readModels.loadSession(sessionId);
  return success(session);
}
```

### §3.8 explainDecision

**对应契约**: L0 §5.1 — `explainDecision(subject)`
**准入理由**: why-question 是本系统核心能力。

```ts
async function explainDecision(subject: ExplainSubject): Promise<CliResult<ExplainReadModel>> {
  const explanation = await readModels.explain(subject);
  return success(explanation);
}
```

---

## §4 决策树详细逻辑 (Decision Tree Details)

### §4.1 写命令是否返回 requiredUserInput

**对应 L0 Mermaid**: `cli-system.md §4.1`

```ts
function resolveMissingInputs(command: string, args: Record<string, unknown>): string[] {
  if (command === 'policy set') return missingRequiredPolicyFields(args);
  if (command === 'credential verify' && !args['answer']) return ['verification_answer'];
  return [];
}
```

### §4.2 explain subject 路由

**对应 L0 Mermaid**: `cli-system.md §4.4`

```ts
function resolveExplainSubject(subject: string): 'decision' | 'platform-selection' | 'outreach' | 'soul-change' {
  if (subject.startsWith('decision:')) return 'decision';
  if (subject.startsWith('platform:')) return 'platform-selection';
  if (subject.startsWith('outreach:')) return 'outreach';
  return 'soul-change';
}
```

---

## §5 边缘情况与注意事项 (Edge Cases & Gotchas)

| 场景 | 风险 | 处理方式 |
| ---- | ---- | -------- |
| explain 输出太长像 essay | 用户看不懂 | 先结论，再关键因子，再 refs |
| credential 状态完全遮蔽 | 无法操作恢复 | 状态可见、值不可见、next step 必须可见 |
| CLI 依赖交互式终端 | 云端 Agent 无法调用 | 缺参时返回 `requiredUserInput`，由 Agent 自行转述 |
| status 一屏塞太多信息 | 用户失去重点 | 分 runtime/rhythm/quiet/credentials/connectors/risk 分块 |
| 把 command surface 实现成独立终端产品 | 偏离 plugin 宿主语义 | 始终以 plugin-registered surface 为主，人类界面只做复用同源读模型的上层壳 |

### §5.1 用聊天式解释替代结构化 explain

```ts
// ❌ 错误做法
// explanation = llm.generateNarrative(...)

// ✅ 正确做法
// explanation = { conclusion, keyFactors, evidenceRefs, nextStep }
```

### §5.2 明文暴露 challenge / token

```ts
// ❌ 错误做法
// print(fullChallengeText, apiKey)

// ✅ 正确做法
// print(status, deadline, attemptsRemaining, nextStep)
```

### §5.3 用 prompt 阻塞恢复流程

```ts
// ❌ 错误做法
// cli 进入交互式等待用户回答 challenge

// ✅ 正确做法
// cli 返回 requiredUserInput + nextStep，由 Agent 问用户并再次调用命令
```

---

## §6 测试辅助 (Test Helpers)

```ts
export function makeExplainReadModel(overrides: Partial<ExplainReadModel> = {}): ExplainReadModel {
  return {
    subjectType: 'decision',
    conclusion: 'Denied due to quiet window and low urgency.',
    keyFactors: ['quiet_window', 'non_urgent_outreach'],
    evidenceRefs: ['decision:1'],
    ...overrides,
  };
}
```
