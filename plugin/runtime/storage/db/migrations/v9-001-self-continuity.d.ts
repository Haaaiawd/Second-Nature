/**
 * v9-001 Self Continuity, Character & Procedural Evolution migration.
 *
 * Adds v9 entity tables and extends evidence_item / action_closure_record
 * with v9 identity and linkage columns.
 *
 * Dependencies: v8-005 (single-status schema cleanup).
 */
export declare const V9_001_SELF_CONTINUITY: {
    version: number;
    label: string;
    sql: string;
};
