/**
 * Migration registry — all migrations in version order.
 */

import type { Migration } from "../migration-runner.js";
import { V7_001_FOUNDATION } from "./v7-001-foundation.js";
import { V7_002_EFFECT_COMMIT_LEDGER } from "./v7-002-effect-commit-ledger.js";
import { V7_003_CIRCUIT_BREAKER } from "./v7-003-circuit-breaker.js";
import { V7_004_BEHAVIOR_PROMOTION } from "./v7-004-behavior-promotion.js";

export const ALL_MIGRATIONS: readonly Migration[] = [
  V7_001_FOUNDATION,
  V7_002_EFFECT_COMMIT_LEDGER,
  V7_003_CIRCUIT_BREAKER,
  V7_004_BEHAVIOR_PROMOTION,
];
