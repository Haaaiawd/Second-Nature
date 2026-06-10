/**
 * Migration registry — all migrations in version order.
 */
import { V7_001_FOUNDATION } from "./v7-001-foundation.js";
import { V7_002_EFFECT_COMMIT_LEDGER } from "./v7-002-effect-commit-ledger.js";
import { V7_003_CIRCUIT_BREAKER } from "./v7-003-circuit-breaker.js";
import { V7_004_BEHAVIOR_PROMOTION } from "./v7-004-behavior-promotion.js";
import { V8_001_LIVING_PERCEPTION_LOOP } from "./v8-001-living-perception-loop.js";
import { V8_002_PERCEPTION_CONTRACT_ALIGNMENT } from "./v8-002-perception-contract-alignment.js";
import { V8_003_QUIET_CLOSURE_REFS } from "./v8-003-quiet-closure-refs.js";
export const ALL_MIGRATIONS = [
    V7_001_FOUNDATION,
    V7_002_EFFECT_COMMIT_LEDGER,
    V7_003_CIRCUIT_BREAKER,
    V7_004_BEHAVIOR_PROMOTION,
    V8_001_LIVING_PERCEPTION_LOOP,
    V8_002_PERCEPTION_CONTRACT_ALIGNMENT,
    V8_003_QUIET_CLOSURE_REFS,
];
