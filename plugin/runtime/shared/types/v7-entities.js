/**
 * v7 全量共享实体类型 (v7 Shared Entity Types)
 *
 * Core logic: Centralizes all cross-system entity declarations introduced in
 * Second Nature v7, ensuring type consistency across state-memory,
 * control-plane, body-tool, dream-quiet, guidance-voice, connector, and
 * observability-health systems.
 *
 * Design authority:
 * - `02_ARCHITECTURE_OVERVIEW.md` §2 (System Inventory) — entity list
 * - `05A_TASKS.md` T-SMS.F.1 — contract requirements
 * - ADR-002/003/007/008 — entity semantics
 *
 * Dependencies:
 * - `SourceRef` from `./source-ref.js`
 * - `AgentGoal` from `./goal.js`
 *
 * Boundary:
 * - This file defines types only; no runtime logic or business rules.
 * - Sensitive fields (credential, raw private content, raw prompt,
 *   encryption key, session token) are explicitly excluded from
 *   RestoreSnapshot via type-level whitelist.
 * - RuntimeSecretAnchor never stores key plaintext (ADR-007).
 *
 * Test coverage: tests/unit/shared/v7-entities.test.ts
 */
export {};
