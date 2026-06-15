/**
 * v8-003 Quiet ClosureRefs — adds closure_refs_json to quiet_daily_review.
 *
 * Resolves T-DQ.R.4: QuietDailyReview closureRefs first-class.
 */
export const V8_003_QUIET_CLOSURE_REFS = {
    version: 7,
    label: "v8-quiet-closure-refs",
    sql: `
    -- closure_refs_json is now created by the bootstrap schema.
    -- This migration is intentionally a no-op to preserve version continuity.
  `,
};
