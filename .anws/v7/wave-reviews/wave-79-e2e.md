# Wave 79 E2E — INT-V7C.R 0.1.38 Claw Gap Regression

**状态**: guide-only（本地无浏览器/OpenClaw host 环境）
**实机环境**: 待 Claw 0.1.38+

---

## 实机复测步骤

见 `reports/int-v7c-r-claw-gap-regression.md` §6 Claw 实机复测手册。

### Representative A Journey（命令可达性）

1. `guidance_payload` → 验证 impulse + expressionBoundary 返回
2. `connector_test dryRun:false` → 验证真实 HTTP status + probe result 写入
3. `restore snapshotId` → 验证参数兼容 + 结构化错误
4. `self_health` → 验证 P95 < 1s + 维度完整

### Representative B Journey（DB growth）

1. 记录 DB 行数（before）
2. 触发 heartbeat cycle（含 connector intent）
3. 记录 DB 行数（after）
4. 断言: life_evidence_index / tool_experience / dream_output_index / heartbeat_digest 至少一项增长

---

** verdict**: 本地集成测试 231/231 PASS；实机步骤待执行。
