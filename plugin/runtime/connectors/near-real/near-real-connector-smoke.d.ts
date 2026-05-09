import type { ObservabilityDatabase } from "../../observability/db/index.js";
import type { StateDatabase } from "../../storage/db/index.js";
export interface NearRealConnectorSmokeResult {
    generatedAt: string;
    platforms: {
        social: "moltbook";
        agentNetwork: "evomap";
    };
    feedReadEvidenceId?: string;
    workDiscoverEvidenceId?: string;
    taskClaimDryRunOk: boolean;
    executionAttemptRowsForDecision: number;
}
export interface RunNearRealConnectorSmokeInput {
    state: StateDatabase;
    observabilityDb: ObservabilityDatabase;
    workspaceRoot: string;
}
export declare function runNearRealConnectorSmoke(input: RunNearRealConnectorSmokeInput): Promise<NearRealConnectorSmokeResult>;
