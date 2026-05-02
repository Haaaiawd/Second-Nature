/**
 * Persist HostCapabilityReport into observability SQLite (T1.1.2).
 */
import type { ObservabilityDatabase } from "../../observability/db/index.js";
import type { HostCapabilityReport } from "./types.js";
export declare function recordHostCapability(db: ObservabilityDatabase, report: HostCapabilityReport): Promise<void>;
