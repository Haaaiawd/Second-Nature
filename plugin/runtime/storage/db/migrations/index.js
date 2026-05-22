/**
 * Migration registry — all migrations in version order.
 */
import { V7_001_FOUNDATION } from "./v7-001-foundation.js";
import { V7_002_EFFECT_COMMIT_LEDGER } from "./v7-002-effect-commit-ledger.js";
export const ALL_MIGRATIONS = [
    V7_001_FOUNDATION,
    V7_002_EFFECT_COMMIT_LEDGER,
];
