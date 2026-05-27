/**
 * Dream Engine — orchestrates the hybrid memory consolidation pipeline.
 *
 * Pipeline: load inputs → consolidate (rules) → sample → redact →
 * optional model insights → merge → validate → write output + trace.
 *
 * Contract:
 * - Input store is never modified.
 * - Output is always candidate until validation passes and lifecycle port accepts it.
 * - Budget/redaction/timeout failures degrade gracefully with trace.
 * Test coverage: tests/integration/dream/t7-1-1-dream-pipeline.test.ts
 */
import type { DreamEngineInput, DreamRunResult } from "./types.js";
export declare function runDream(input: DreamEngineInput): Promise<DreamRunResult>;
