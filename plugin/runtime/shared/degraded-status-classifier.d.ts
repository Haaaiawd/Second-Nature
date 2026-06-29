/**
 * Degraded Status Classifier (T-OBS.R.8)
 *
 * Core logic: map canonical V8ReasonCode values to precise operational states
 * so that stage-level diagnostics never use the aggregate "degraded" string.
 *
 * Design authority:
 * - `.anws/v8/04_SYSTEM_DESIGN/shared-v8-contracts.md §4.1`
 *
 * Dependencies: `src/shared/types/v8-contracts.js`
 * Boundary: pure function; no I/O.
 * Test coverage: tests/unit/shared/degraded-status-classifier.test.ts
 */
import type { DegradedOperationResult, V8ReasonCode } from "./types/v8-contracts.js";
export type PreciseDegradedStatus = DegradedOperationResult["status"];
export declare function classifyDegradedStatus(reason: V8ReasonCode): PreciseDegradedStatus;
