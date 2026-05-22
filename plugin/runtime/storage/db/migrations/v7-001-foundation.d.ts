/**
 * v7-001 Foundation migration — adds v7 entity tables and _meta tracking.
 *
 * Tables added:
 * - identity_profile, tool_experience, daily_diary_index,
 *   dream_output_index, capability_probe_result, restore_snapshot,
 *   runtime_secret_anchor, heartbeat_digest, narrative_timeline
 * - agent_goal v7 extensions (scope, expires_at columns)
 *
 * All new columns use DEFAULT NULL for backward compatibility.
 */
import type { Migration } from "../migration-runner.js";
export declare const V7_001_FOUNDATION: Migration;
