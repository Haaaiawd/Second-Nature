/**
 * SourceRef — v7 non-empty tuple for source grounding.
 *
 * Core logic: Every fact claim must carry at least one source reference.
 * DR-025 enforces non-empty at compile time. Empty array assignments are
 * rejected by the TypeScript compiler (`strict: true`).
 *
 * Dependencies: none (primitive shared type).
 * Boundary: Used across state-memory, dream-quiet, guidance-voice, and
 * observability systems for source-backed assertions.
 * Test coverage: tests/unit/shared/v7-entities.test.ts (compile-time
 * `@ts-expect-error` guard for empty tuple).
 */
export type SourceRef = readonly [string, ...string[]];
