# 探索报告: cli-system v5 Host Capability & Plugin Surface

**日期**: 2026-05-01  
**探索者**: GPT-5.5  
**系统**: `cli-system`

---

## 1. 问题与范围

**核心问题**: `cli-system` 如何在 Second Nature v5 中从“OpenClaw command/tool/service 与 runtime artifact 交付边界”升级为“宿主能力验证与用户可见主动联系 smoke 的证明层”，同时保持 v4 的自足发布包边界？

**探索范围**:
- 包含: OpenClaw plugin surface、manifest/runtime 分层、自足 runtime artifact、host capability probe、heartbeat delivery target smoke、`HEARTBEAT_OK` ack drop、`target: "none"`、operator-visible fallback。
- 不包含: control-plane 的 heartbeat decision 算法、state schema 完整设计、behavioral-guidance 文案模板、connector 平台细节。

---

## 2. 核心洞察 (Key Insights)

1. **cli-system 是 v5 宿主能力证明层，不只是命令壳**: v5 主动联系是否成立取决于 OpenClaw delivery target 和宿主 API，`cli-system` 必须提供可重复的 capability probe 与 smoke report。
2. **runtime artifact 与 capability probe 是两条不同闭环**: 包内 runtime 自足只能证明“插件能跑”；不能自动证明 heartbeat reply 会投递给用户。
3. **`heartbeat_check` 是 shipping bridge，不是完整 lived-experience loop 的替代品**: 它必须能返回 `runtime_carrier_only`、真实 decision result 或 capability report ref，且不能把 host-safe ack 伪装为用户联系成功。
4. **`target: "none"` 与 `HEARTBEAT_OK` ack drop 必须在 CLI/ops 表面可验证**: 这些是 OpenClaw 的宿主行为，后续 blueprint 不能只靠 control-plane 单测覆盖。
5. **fallback 必须 operator-visible 且不冒充 sent**: 当 delivery target 不可用时，CLI 需要能展示 fallback artifact / reason / sourceRefs / next step，帮助用户判断缺的是宿主能力、配置还是证据。

---

## 3. 详细发现

### 3.1 OpenClaw plugin surface 仍是交付边界

**探索方式**: v4 调研复用 + ADR-006 校验。

**发现**:
- 原生 OpenClaw 插件通过 manifest 与 runtime entry 被发现、加载和注册。
- command / tool / service surface 是宿主可见的主要接入面。
- 发布包不能依赖源码仓 `src/`，否则会重复 v4 的 wrapper-only 失败。

**来源**:
- `../03_ADR/ADR_006_DEPLOYABLE_PLUGIN_RUNTIME_PACKAGE.md`
- `https://docs.openclaw.ai/plugin`

### 3.2 v5 新增的 host capability probe 责任

**探索方式**: OpenClaw lived-experience closure research 复用。

**发现**:
- OpenClaw heartbeat delivery 的 `target` 决定是否外送。
- `target: "none"` 会运行 heartbeat 但不外送。
- `target: "last"` 或显式 channel/to 才可能用户可见。
- GitHub issue #40297 指出插件侧 `requestHeartbeatNow` 类能力若默认 target none，会导致回复被丢弃；`runHeartbeatOnce({ heartbeat: { target: "last" } })` 或等价能力需要实测。

**来源**:
- `./openclaw-lived-experience-closure-research.md`
- `https://github.com/openclaw/openclaw/issues/40297`

### 3.3 CLI/operator surface 应服务 explain 与 smoke

**探索方式**: 内部架构推演。

**发现**:
- v5 的 operator-facing surface 需要能回答“为什么这轮没联系我 / 为什么只是 fallback / 这个 heartbeat 是否真的投递给我”。
- `status`、`explain`、`report`、`audit` 不应只展示静态状态，还应能读取 host smoke / capability probe 结果。
- host-safe carrier 模式下的合成数据必须被清楚标注，不能让用户误以为空 connectors 或 missing credentials 是真实完整 runtime 状态。

### 3.4 packaging 风险已经从原生模块转向 host-safe runtime truth split

**探索方式**: v4 文档与 ADR-001/006 对齐。

**发现**:
- 旧调研聚焦 `better-sqlite3` 原生编译风险，但 v5 当前架构已接受 SQLite/sql.js + Markdown/JSON artifacts。
- 现在更重要的风险是：宿主内 host-safe path、workspace-attached full runtime path、capability probe path 的语义不要混淆。
- CLI 需要显式返回 `surfaceMode` / `runtimeMode` / `capabilityStatus`，而不是只用 `ok: true`。

---

## 4. 方案清单

| 方案 | 可行性 | 风险 | 推荐度 |
| --- | :---: | --- | :---: |
| A. 保持 plugin command/tool/service surface + 增加 capability probe / smoke report | 高 | 文档和测试矩阵更重 | 推荐 |
| B. 只保持 v4 command/tool/service，不把 delivery target 纳入 CLI | 中 | v5 主动联系能力无法被用户验证 | 不推荐 |
| C. CLI 自建外部通知通道验证主动联系 | 低 | 绕过 OpenClaw delivery，违背 ADR-007 | 不推荐 |
| D. 只把 capability probe 写进 README 手工步骤 | 中 | 不可复现，blueprint 难承接 | 不推荐 |

---

## 5. 行动建议

| 优先级 | 建议 | 理由 |
| :---: | --- | --- |
| P0 | 将 `probeHostCapability()` / `runHostSmoke()` 作为 L0 操作契约 | REQ-025 是 `cli-system` 的核心责任 |
| P0 | 在测试矩阵中显式覆盖 `target:none`、`target:last`、ack drop、delivery unavailable | 这些是 v5 最危险的宿主失败模式 |
| P0 | 区分 `runtime_carrier_only`、`full_runtime`、`capability_probe` 三种 surface mode | 防止 host-safe 成功被误判为完整生活闭环 |
| P1 | 为 operator-visible fallback 设计 CLI/read model | delivery 不可用时需要可见兜底，不是只写 trace |
| P1 | 刷新 packaging 叙事，聚焦 sql.js 与 host-safe 加载边界 | 旧 `better-sqlite3` 叙事会误导后续任务 |

---

## 6. 局限性与待探索

- 当前基于公开 OpenClaw 文档和 issue；仍需要后续宿主实测确认当前 OpenClaw 版本的 `runHeartbeatOnce` 或等价 API 是否可用。
- `target: "last"` 与 owner 当前可见会话的映射必须由 smoke report 证明。
- `cli-system` 只能证明和展示能力；不能代替 control-plane 做 outreach judgment，也不能代替 OpenClaw delivery 实际投递。

---

## 7. 参考来源

1. [OpenClaw Plugin Overview](https://docs.openclaw.ai/plugin)
2. [OpenClaw Plugin CLI](https://docs.openclaw.ai/cli/plugins)
3. [OpenClaw Heartbeat](https://docs.openclaw.ai/gateway/heartbeat)
4. [OpenClaw Plugin Hooks](https://docs.openclaw.ai/plugins/hooks)
5. [OpenClaw issue #40297](https://github.com/openclaw/openclaw/issues/40297)
6. `./openclaw-lived-experience-closure-research.md`
7. `../../03_ADR/ADR_001_TECH_STACK.md`
8. `../../03_ADR/ADR_006_DEPLOYABLE_PLUGIN_RUNTIME_PACKAGE.md`
9. `../../03_ADR/ADR_007_HEARTBEAT_DELIVERY_AND_LIFE_EVIDENCE_CLOSURE.md`
