/**
 * v8-005 Single Status Schema — records Wave 114 status-column cleanup.
 *
 * SQLite cannot safely run `DROP COLUMN IF EXISTS`; the actual idempotent
 * column removal lives in applyStateSchemaMigrations where each statement is
 * isolated. This migration marks the schema version after that defensive pass.
 *
 * Resolves T-SMS.R.4.
 */
export const V8_005_SINGLE_STATUS_SCHEMA = {
    version: 9,
    label: "v8-single-status-schema",
    sql: `
    SELECT 1;
  `,
};
