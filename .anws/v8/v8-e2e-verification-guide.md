<!--
评测列语义（旅程结果 / Step 结果）：仅允许 PASS | PARTIAL_PASS | FAIL。
未在用户授权并完成浏览器/宿主回填前：留空或写「待实机」——严禁写任一 verdict，严禁自拟其它档位或同义粉饰。
-->

# Second Nature v8 E2E Verification Guide for Claw

## E2E Verification

### Scope
- **PRD / 需求来源**: `.anws/v8/01_PRD.md` §3 Goals G1–G8, §4 User Stories US-001–US-009, Non-Goals NG1–NG5; `.anws/v8/02_ARCHITECTURE_OVERVIEW.md`; `.anws/v8/04_SYSTEM_DESIGN/*.md`; `plugin/agent-inner-guide.md`
- **Target**: Second Nature v8 Living Perception Loop running as OpenClaw plugin `@haaaiawd/second-nature@0.2.5` and equivalent CLI surface
- **Environment**: OpenClaw host with `second_nature_ops` tool visible; `SECOND_NATURE_WORKSPACE_ROOT` or per-call `workspaceRoot` pointing to a prepared workspace with `.second-nature/` directory
- **Browser / Viewport（计划）**: N/A — Second Nature v8 has no browser UI; all interaction is JSON-first through OpenClaw tool calls or CLI commands
- **User Role**: owner/operator and Claw (agent using the tool on owner's behalf); human confirms redaction and policy decisions
- **Build / Commit**: `main @ e7d3819` (v0.2.5)
- **Side effects**: `heartbeat_run` writes evidence, perception, judgment, closure, rhythm, Quiet review, and Dream records; `connector:run` may call external URLs; `policy set`, `goal set`, `connector_behavior_add` mutate workspace configuration; `snapshot:capture` and `restore` write recovery artifacts. Use a dedicated test workspace.

### PRD traceability (RTM)
| PRD ref | Summary | Priority | Journeys |
| --- | --- | --- | --- |
| US-001 REQ-001 | Connector evidence normalized into source-backed `EvidenceItem` | P0 | J2 |
| US-002 REQ-002 | `PerceptionCard` generation with topic/entities/novelty/relevance/risk | P0 | J3 |
| US-003 REQ-003 | Agent `JudgmentVerdict` with cross-platform action taxonomy | P0 | J3 |
| US-004 REQ-004 | Unified autonomy policy for allow/defer/downgrade/deny | P0 | J4 |
| US-005 REQ-005 | Long-term memory formed by Quiet Daily Review + Dream Consolidation | P0 | J5 |
| US-006 REQ-006 | Quiet/Dream lifecycle trace truth and repair observability | P1 | J5, J6 |
| US-007 REQ-007 | Context-aware sensitivity classification | P1 | J2, J3 |
| US-008 REQ-008 | Causal loop health with stage-level stall reason | P1 | J6 |
| US-009 REQ-009 | Heartbeat action closure and no-action reason | P0 | J3 |
| G1 | Evidence→Perception SLA | P0 | J2, J3 |
| G2 | Public technical vocabulary not misclassified as secret | P1 | J2 |
| G3 | Platform-neutral action taxonomy | P0 | J3, J4 |
| G4 | Write-side autonomy policy with decision proof | P0 | J4 |
| G5 | Long-term memory only through Quiet/Dream | P0 | J5 |
| G6 | Accepted projection loadable into `EmbodiedContext` | P0 | J5 |
| G7 | Every heartbeat closes with input/decision/output/next_state | P0 | J3 |
| G8 | Causal loop health locates stall stage | P1 | J6 |
| NG1 | No platform-specific brain in core | — | J2, J4 |
| NG4 | No plaintext credential/private payload persistence | — | All |
| NG5 | No keyword blacklist security | — | J2, J3 |

### Surface coverage
| 功能面 / 入口 | 如何发现 | Journey | PRD ref | Notes |
| --- | --- | --- | --- | --- |
| `second_nature_ops` tool (OpenClaw tool list) | Host exposes it in every SN-enabled session | All | runtime-ops-system | Primary E2E surface; if missing, plugin not loaded |
| `setup_hint` command | Call `second_nature_ops` with `command: setup_hint` | J1 | Onboarding | Returns packaged `SKILL.md` + `agent-inner-guide.md` |
| `setup_ack` command | Call `second_nature_ops` with `command: setup_ack` | J1 | Onboarding | Writes ack marker into workspace |
| `storage_smoke` command | Call `second_nature_ops` with `command: storage_smoke` | J1 | US-008 | Validates SQLite/sql.js state backend |
| `credential` command | Call `second_nature_ops` with `command: credential` | J1 | US-008 | Verify credential health without leaking plaintext |
| `policy` command | Call `second_nature_ops` with `command: policy` | J1, J4 | US-004 | Show/set rhythm policy |
| `connector_init` command | Call `second_nature_ops` with `command: connector_init` | J2 | US-001 | Scaffolds connector manifest |
| `connector_status` command | Call `second_nature_ops` with `command: connector_status` | J2 | US-001 | Inventory, trust, executable summary |
| `connector_test` command | Call `second_nature_ops` with `command: connector_test` | J2 | US-001 | Dry-run or wet probe |
| `connector:run` command | Call `second_nature_ops` with `command: connector:run` | J2, J4 | US-001, US-004 | Manual connector execution |
| `connector_behavior_add` command | Call `second_nature_ops` with `command: connector_behavior_add` | J2 | US-001, agent-inner-guide | Register newly observed platform behavior |
| `heartbeat_check` / `heartbeat_run` command | Call `second_nature_ops` with `command: heartbeat_check` or `heartbeat_run` | J3, J4, J5 | US-009 | Core living loop trigger |
| `loop_status` command | Call `second_nature_ops` with `command: loop_status` | J6, all | US-008 | Causal loop health read |
| `heartbeat_digest` command | Call `second_nature_ops` with `command: heartbeat_digest` | J6 | US-008 | Daily digest + real-run health block |
| `self_health` command | Call `second_nature_ops` with `command: self_health` | J6 | US-008 | v7-style self-health snapshot |
| `explain` command | Call `second_nature_ops` with `command: explain` | J6 | US-006, US-008 | Why-question transparency |
| `cycle:recent` command | Call `second_nature_ops` with `command: cycle:recent` | J6 | US-008 | Recent heartbeat/narrative/Dream/connector summary |
| `dream:recent` command | Call `second_nature_ops` with `command: dream:recent` | J5, J6 | US-005, US-006 | Recent Dream runs |
| `quiet` command | Call `second_nature_ops` with `command: quiet` | J5 | US-005, US-006 | Quiet lifecycle state |
| `goal` command | Call `second_nature_ops` with `command: goal` | J1, J3, J4 | US-003, US-004 | Set/list/accept/reject goals |
| `narrative` command | Call `second_nature_ops` with `command: narrative` | J5, J6 | US-005 | Current narrative state |
| `snapshot:capture` command | Call `second_nature_ops` with `command: snapshot:capture` | J7 | US-006, US-008 | Recovery snapshot |
| `restore` command | Call `second_nature_ops` with `command: restore` | J7 | US-006, US-008 | Bounded restore |
| `runtime_secret_bootstrap` command | Call `second_nature_ops` with `command: runtime_secret_bootstrap` | J1, J7 | NG4 | Runtime secret anchor health |
| CLI `second-nature <command>` | Terminal in workspace root | J1–J7 | runtime-ops-system | Parity check with plugin output |

### Journeys（旅程级）
| ID | PRD ref | User Journey | 旅程结果 | Evidence | Notes |
| --- | --- | --- | --- | --- | --- |
| J1 | US-008, NG4, agent-inner-guide | Claw 启用 Second Nature plugin，完成 workspace 对齐、setup ack、runtime secret、credential 与 policy 初始配置 | 待实机 | `setup_hint` JSON; `setup_ack` marker file; `storage_smoke` result; `credential` result; `policy show` result | 必须先确认 plugin 加载 |
| J2 | US-001, US-007, G1, G2 | 初始化并运行 connector，验证 evidence 被规范化、去重、分类，且 connector 失败时不伪造证据 | 待实机 | `connector_init` result; `connector_status`; `connector_test`; `connector:run` JSON; state DB `evidence_item` rows | 使用 fixture/mock，不触碰真实平台写 |
| J3 | US-002, US-003, US-009, G1, G3, G7 | 触发 `heartbeat_run`，验证 evidence → perception → judgment → action closure/no-action 全链产生可追溯记录 | 待实机 | `heartbeat_run` JSON; `evidence_item`, `perception_card`, `judgment_verdict`, `action_closure_record` rows | 断言 cycleSequence 单调递增 |
| J4 | US-004, G4, G7, NG1 | 验证 autonomy policy：高/低风险动作被 allow/defer/downgrade/deny，缺权限时降级，breaker/cooldown 阻止重复执行 | 待实机 | `policy set` result; `heartbeat_run`/`connector:run` JSON; `action_closure_record` with `closure_status` and reason | 不执行真实外部自动写 |
| J5 | US-005, US-006, G5, G6 | 跨天触发 rhythm，验证 Quiet Daily Review 聚合当天 closure，Dream 形成 candidate memory，接受后投影进下一 heartbeat 的 EmbodiedContext | 待实机 | `quiet` status; `dream:recent`; `daily_rhythm_state`; `long_term_memory_projection`; next `heartbeat_run` context | 需要准备两天数据 |
| J6 | US-006, US-008, G8 | 使用 `loop_status`, `heartbeat_digest`, `explain`, `cycle:recent` 诊断 living loop 各阶段健康状态，验证归因不归咎 governance | 待实机 | `loop_status` JSON; `heartbeat_digest` JSON; `explain` result | 重点检查 redaction 无泄漏 |
| J7 | US-006, US-008, G8 | 验证 recovery：snapshot capture/restore，runtime secret bootstrap，connector 重复失败后进入 cooldown 并可恢复 | 待实机 | `snapshot:capture` result; `restore` result; `runtime_secret_bootstrap`; `connector_cooldown_state` rows | 恢复操作在测试 workspace 执行 |

### Step breakdown
| Journey | Step | PRD ref | Step 结果 | Evidence | Notes |
| --- | --- | --- | --- | --- | --- |
| J1 | 1. 打开 OpenClaw 会话，在可用 tool 列表中找到 `second_nature_ops` | runtime-ops-system | 待实机 | Tool 列表截图/JSON | 若缺失，检查 plugin 版本是否为 0.2.5 |
| J1 | 2. 调用 `setup_hint`，返回应包含 `SKILL.md` 和 `agent-inner-guide.md` 的摘要或路径 | Onboarding | 待实机 | `setup_hint` JSON | 确认 Claw 能读取到 inner guide |
| J1 | 3. 调用 `setup_ack`，确认 workspace 中生成 `.second-nature/setup/agent-inner-guide-ack.json` | Onboarding | 待实机 | 文件系统存在性 | Ack 后 setup nudge 应停止 |
| J1 | 4. 调用 `storage_smoke`，断言 `ok=true` 且报告 sql.js/native SQLite 加载状态 | US-008 | 待实机 | `storage_smoke` JSON | 状态后端必须可读 |
| J1 | 5. 调用 `runtime_secret_bootstrap`（或检查对应状态），断言不暴露明文 key 且状态不为 `missing_runtime_secret` | NG4 | 待实机 | 返回 JSON | 只报告位置和恢复原则 |
| J1 | 6. 调用 `credential verify`（如 `platformId: moltbook`），断言返回 `ok` 或诚实的 `missing`/`decrypt_failed` 诊断，且不包含 token 明文 | NG4 | 待实机 | `credential` JSON | credential leak 检查 |
| J1 | 7. 调用 `policy show`，断言返回当前 rhythm policy（social daily limit, quiet enabled 等） | US-004 | 待实机 | `policy` JSON | 初始策略默认保守 |
| J1 | 8. 调用 `goal list`，断言返回 accepted goals 或诚实 `nothing_yet` | US-003 | 待实机 | `goal` JSON | 空态必须可解释 |
| J2 | 1. 调用 `connector_init platformId=moltbook runnerKind=declarative_http`，断言生成 manifest stub 到 `.second-nature/connectors/moltbook/manifest.yaml` | US-001 | 待实机 | 文件系统/返回 JSON | 不注册执行代码 |
| J2 | 2. 调用 `connector_status includeHealth=true`，断言 `moltbook` 出现在 inventory，且 trust/executable/conflict 状态清晰 | US-001 | 待实机 | `connector_status` JSON | 未配置 credential 时应为 `needs_auth` |
| J2 | 3. 配置 credential 后调用 `connector_test platformId=moltbook capabilityId=feed.read dryRun=true`，断言返回 dry-run result 与 policy proof | US-001 | 待实机 | `connector_test` JSON | dry-run 不调用外部 URL |
| J2 | 4. 调用 `connector:run platformId=moltbook capabilityId=feed.read`，断言返回 `ConnectorResult` 与 source refs；state DB 出现 `evidence_item` 行 | US-001 | 待实机 | `connector:run` JSON; DB query | 使用 mock/fixture 数据 |
| J2 | 5. 重复调用同一 `connector:run` 并携带相同 idempotency key，断言 evidence 按 content hash 去重，不产生重复行 | US-001 | 待实机 | `evidence_item` count | 去重必须生效 |
| J2 | 6. 构造一个返回空数组的 connector run，断言系统记录 `evidence_empty`，不伪造 perception | US-001 | 待实机 | `heartbeat_run`/`connector:run` JSON; `loop_status` | no fabrication |
| J2 | 7. 对 `connector_init` 生成的 scaffold connector 直接调用 `connector:run`，断言返回 `terminal_failure` + `protocol_mismatch`/`configuration_missing`，且不伪造数据 | US-001 | 待实机 | `connector:run` JSON | scaffold 不等于可执行；失败必须诚实 |
| J2 | 8. 构造包含 `token design and secret management` 文本的 evidence，断言 classification 为 `public_technical`；构造 `Bearer <high-entropy-string>` 文本，断言 sensitive block | US-007 | 待实机 | `evidence_item.sensitivityClass`; `perception_card` risk flags | shape-based 分类 |
| J3 | 1. 确保 workspace 已有 evidence（来自 J2），调用 `heartbeat_run` | US-009 | 待实机 | `heartbeat_run` JSON | 手动触发 |
| J3 | 2. 断言返回 `ok=true`，包含单调递增 `cycleSequence`，包含 `cycleId` | US-009 | 待实机 | 返回 JSON | cycleSequence 是 SLA 依据 |
| J3 | 3. 断言返回包含 `closureRef` 或 `noActionReason`，两者不同时缺失 | US-009 | 待实机 | 返回 JSON | 禁止 silent no-op |
| J3 | 4. 查询 state DB，断言 `perception_card` 存在，包含 topic/entities/novelty/relevance/summary/sourceRefs | US-002 | 待实机 | DB query | perception 必须可追溯 |
| J3 | 5. 查询 state DB，断言 `judgment_verdict` 存在，包含 candidate action、confidence、reason、source refs | US-003 | 待实机 | DB query | judgment 必须自解释 |
| J3 | 6. 查询 state DB，断言 `action_closure_record` 存在，包含 input/decision/output/postProcessing/nextState 或 no-action reason | US-009 | 待实机 | DB query | closure 是生活轨迹 |
| J3 | 7. 调用 `loop_status`，断言 causal health 各 stage 不为全 healthy 默认，且 `action_closure` stage 有证据 | US-008 | 待实机 | `loop_status` JSON | real-run 健康必须基于 persisted evidence |
| J4 | 1. 调用 `policy set` 临时允许 `moltbook` reply（保持 dry-run/owner-confirm posture），然后构造一个低风险 reply candidate heartbeat | US-004 | 待实机 | `policy set` JSON; `heartbeat_run` JSON | 策略变更必须显式 |
| J4 | 2. 断言 `action_closure_record` 的 `closure_status` 为 `allowed`/`downgraded`/`denied` 之一，且携带 decision reason | US-004 | 待实机 | DB query | policy decision proof |
| J4 | 3. 移除 reply permission 后触发 reply candidate heartbeat，断言降级为 `draft_reply` 或 `notify_owner` | US-004 | 待实机 | `action_closure_record` | 缺权限必须降级 |
| J4 | 4. 构造高敏感度或缺失 source refs 的 candidate，断言 policy deny 且 `loop_status` 归因到 `policyDeniedCount` 或 `sourceAbsenceCount` | US-004 | 待实机 | `loop_status` attribution | 不归咎 governance |
| J4 | 5. 触发同一次写动作两次，断言第二次因 idempotency 不重复执行 | US-004 | 待实机 | `action_closure_record` count; execution telemetry | exactly-once |
| J5 | 1. 准备或构造两天前的 `ActionClosureRecord`，确保 `daily_rhythm_state` 对前一天为 `due` | US-005 | 待实机 | DB query | 可手动插入 fixture |
| J5 | 2. 调用 `heartbeat_run`，等待 `advanceAndRecordDailyRhythm` 完成对前一天的 Quiet review | T-CP.R.3 | 待实机 | `heartbeat_run` JSON; DB query | rhythm 推进在 closure 之后 |
| J5 | 3. 断言 `quiet_daily_review` 存在，包含 closureRefs 和 summary | US-005 | 待实机 | DB query | review 来自 closure provenance |
| J5 | 4. 断言 `daily_rhythm_state.quietStatus=completed` 且 `dreamStatus=scheduled`（或显式 blocked reason） | US-006 | 待实机 | DB query | 无 silent missing |
| J5 | 5. 等待或手动触发 Dream consolidation，断言 `dream_consolidation_run` 存在且状态为 `scheduled/started/completed/blocked` 之一 | US-006 | 待实机 | DB query | lifecycle trace |
| J5 | 6. 若 Dream 产生 candidate memory，调用 accept/reject/supersede，断言 `long_term_memory_projection` 状态正确迁移 | US-005 | 待实机 | DB query | projection lifecycle |
| J5 | 7. 触发下一轮 `heartbeat_run`，断言 `EmbodiedContext` 加载了 accepted projection 并影响 judgment/perception context | G6 | 待实机 | 下一 cycle 的 `judgment_verdict`/`action_closure_record` | memory feedback |
| J6 | 1. 对已有 runtime 数据的 workspace 调用 `loop_status` | US-008 | 待实机 | `loop_status` JSON | 不触发新 heartbeat |
| J6 | 2. 断言返回包含 `overallStatus`（`healthy|stalled|blocked|degraded|no_data`）和 `stalledAt` 字段 | US-008 | 待实机 | 返回 JSON | stalled 必须指向具体 stage |
| J6 | 3. 断言 `causalHealth.stages[]` 覆盖 ingestion/perception/judgment/action_policy/execution/action_closure/quiet_review/dream_consolidation/projection | G8 | 待实机 | 返回 JSON | 八个阶段不可缺 |
| J6 | 4. 断言 attribution 段存在 `policyDeniedCount`, `hardGuardDeniedCount`, `cooldownReplayCount`, `sourceAbsenceCount`, `quietSuppressionCount`, `connectorTerminalCount` | US-008 | 待实机 | 返回 JSON | 六字段不可缺 |
| J6 | 5. 断言 `nextAction` 是人类可读的修复建议，不包含 `governance_denied` 等模糊归咎 | US-008 | 待实机 | 返回 JSON | 禁止 generic governance blame |
| J6 | 6. 对返回 JSON 字符串搜索 `api-key`, `token`, `Bearer`, `encrypted_value`, `private_key`，断言无命中 | NG4 | 待实机 | 字符串搜索 | redaction 检查 |
| J6 | 7. 调用 `heartbeat_digest`，断言 digest 中的 health block 与 `loop_status` 一致 | US-008 | 待实机 | `heartbeat_digest` JSON | status/digest parity |
| J6 | 8. 调用 `explain subject=decision:<closureId>`，断言返回 source-backed 解释，不编造原因 | US-006 | 待实机 | `explain` JSON | transparency |
| J6 | 9. 调用 `cycle:recent limit=3`，断言返回最近 heartbeat/narrative/Dream/connector 聚合 | US-008 | 待实机 | `cycle:recent` JSON | observability read model |
| J7 | 1. 调用 `snapshot:capture`，断言返回 snapshot id 与 narrative timeline version | US-006 | 待实机 | `snapshot:capture` JSON | recovery artifact |
| J7 | 2. 再次调用 `snapshot:capture`，断言生成第二个 narrative timeline version | US-006 | 待实机 | `snapshot:capture` JSON | 为 diff 准备两个版本 |
| J7 | 3. 调用 `narrative:diff`（无参时自动比较最近两版），断言返回可读的 narrative delta | US-006 | 待实机 | `narrative:diff` JSON | 无参路径应自动解析 |
| J7 | 4. 调用 `narrative:diff from=<old> to=<new>`，断言返回同一 delta | US-006 | 待实机 | `narrative:diff` JSON | 显式参数路径 |
| J7 | 5. 调用 `restore snapshotId=<id> reason=test`，断言 bounded restore 写入 audit 且不破坏无关状态 | US-006 | 待实机 | `restore` JSON; audit records | 在测试 workspace 执行 |
| J7 | 6. 配置一个返回 401/5xx 的 mock connector，连续触发 3 次，断言第三次返回 `cooldown_blocked` | US-008 | 待实机 | `connector:run` JSON; `connector_cooldown_state` | cooldown boundary |
| J7 | 7. 在 cooldown 期内调用 `loop_status`，断言 `cooldownReplayCount` 递增且 `nextAction` 提示等待或修复 credential | US-008 | 待实机 | `loop_status` JSON | replay attribution |
| J7 | 8. 修复 credential/mock 后等待 cooldown 过期或重置，再次触发 connector，断言 runner 被重新调用且结果正常 | US-008 | 待实机 | `connector:run` JSON; mock 请求计数 | recovery path |

### Claw posture checklist
Claw 在执行以上旅程时，应遵循 `plugin/agent-inner-guide.md` 的原则：
- 每次回答 owner 关于状态的问题前，先调用 `loop_status`/`narrative`/`dream:recent`/`cycle:recent` 等 read command；无记录时诚实说明。
- 使用 `connector_behavior_add` 登记新行为时，必须附带 `description` 或 `sourceRefs`；不声称自己能执行直到 registry/trust/policy 允许。
- 主动靠近 owner 前，确认存在真实信号、accepted goal 或 Dream candidate；否则保持安静。
- 将 `expressionBoundaryConstraints` 作为语气 shaping，不当作 hard veto；输出中不虚构经历、关系或情绪事件。
- 对 `guidance_payload` 返回的 impulse，区分 carrier 响应与完整长期状态；candidate projection 不当作确定结论。

### Findings
- 待实机后回填

### Coverage gaps
- **无浏览器 UI**: v8 是 JSON-first runtime，没有可点击 Web UI；所有验证通过 OpenClaw tool 或 CLI 完成。
- **真实外部平台写**: 默认 autonomy policy 保守；`auto_reply`/`auto_publish`/`auto_*` 写操作默认被降级或拒绝。真实外部写需要显式 policy allow + 低风险 + idempotency + owner-confirm/dry-run，不在基础 E2E 范围。
- **多平台扩展**: 本指南以 `moltbook` 为示例 connector；`instreet`, `evomap`, `agent-world` 等平台行为类似，但真实 HTTP 行为需各自 mock。
- **跨天 Quiet/Dream**: J5 需要构造或等待两天 closure 数据；可通过 fixture 加速，但真实 host cadence 下需至少两天。
- **ModelAssistPort 可选路径**: LLM-assisted perception/judgment/Dream 是增强路径而非基线；rules-only 路径是本指南的强制断言。
- **Deep host integration**: OpenClaw host 的 tool 可见性、plugin 加载顺序、workspaceRoot 解析、会话生命周期属于宿主行为；本指南覆盖 SN plugin 侧契约。
- **性能/压力/长周期**: 每日 1,000 条 evidence、10 个平台、30 天数据增长等属于非功能验收，不在本功能 E2E 范围。
- **v7 历史 surface**: `status`, `report`, `session`, `audit`, `fallback`, `tool_affordance` 等命令保留兼容；本指南只在使用到它们的旅程中覆盖。

### Recommendation
- 最小可发布 E2E：完成 J1 + J2 + J3 + J6 四项，确认 plugin 能加载、connector 能读、heartbeat 能闭环、loop_status 能诊断。
- 完整 v8 发布 E2E：在上述基础上完成 J4（policy safety）+ J5（memory feedback）+ J7（recovery）。
- 任何 `loop_status` 输出若包含 credential-like 子串，立即标记为 FAIL 并阻塞发布。
- 所有 verdict 必须在实机/宿主回填证据后才可以改为 PASS/PARTIAL_PASS/FAIL；指南阶段保持留空或 `待实机`。

---

## Evidence checklist (to be filled during real host walkthrough)

- [ ] OpenClaw tool list contains `second_nature_ops`
- [ ] `setup_hint` returns packaged `SKILL.md` + `agent-inner-guide.md`
- [ ] `setup_ack` writes marker file
- [ ] `storage_smoke` returns ok with SQLite/sql.js state
- [ ] `runtime_secret_bootstrap` reports health without plaintext key
- [ ] `credential verify` reports health without token leak
- [ ] `policy show` returns current rhythm policy
- [ ] `connector_init` scaffolds manifest
- [ ] `connector_status` shows inventory with trust/executable states
- [ ] `connector_test dryRun=true` returns policy proof
- [ ] `connector:run` returns result and writes `evidence_item`
- [ ] `heartbeat_run` returns cycle id, sequence, closure/no-action
- [ ] State DB contains `perception_card`, `judgment_verdict`, `action_closure_record`
- [ ] `loop_status` returns `overallStatus`, `stalledAt`, eight stages, six attribution counters
- [ ] `loop_status` JSON has no credential-like substrings
- [ ] `heartbeat_digest` parity with `loop_status`
- [ ] `quiet_daily_review` exists with closureRefs
- [ ] `dream_consolidation_run` has lifecycle trace
- [ ] `long_term_memory_projection` accepts/supersedes/retires correctly
- [ ] `snapshot:capture` + `restore` complete with audit
- [ ] `connector_cooldown_state` blocks replay after terminal failures
