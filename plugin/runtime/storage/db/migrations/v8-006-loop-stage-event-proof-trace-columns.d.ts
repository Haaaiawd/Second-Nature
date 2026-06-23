/**
 * v8-006 — Add proof/trace refs columns to loop_stage_event.
 *
 * The loop_stage_event table was created without proof_refs_json and
 * trace_refs_json columns. This migration adds them as nullable TEXT columns
 * so the v8 provenance tier write path can persist proofRefs and traceRefs.
 */
import type { Migration } from "../migration-runner.js";
export declare const V8_006_LOOP_STAGE_EVENT_PROOF_TRACE_COLUMNS: Migration;
