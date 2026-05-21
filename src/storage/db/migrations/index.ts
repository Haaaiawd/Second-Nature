/**
 * Migration registry — all migrations in version order.
 */

import type { Migration } from "../migration-runner.js";
import { V7_001_FOUNDATION } from "./v7-001-foundation.js";

export const ALL_MIGRATIONS: readonly Migration[] = [
  V7_001_FOUNDATION,
];
