import type { ActivityLogWrite, ObservationWrite, DailyReportInput, CuratedMemoryWrite, AnchorWriteProposal } from "./types.js";
import type { StateDatabase } from "../../db/index.js";
export interface WorkspaceArtifactStore {
    appendActivityLog(entry: ActivityLogWrite): Promise<{
        assetPath: string;
        hash: string;
    }>;
    appendObservation(entry: ObservationWrite): Promise<{
        assetPath: string;
        hash: string;
    }>;
    generateDailyReport(input: DailyReportInput): Promise<{
        assetPath: string;
        hash: string;
    }>;
    upsertCuratedMemory(candidate: CuratedMemoryWrite): Promise<{
        assetPath: string;
        hash: string;
    }>;
    proposeAnchorWrite(proposal: AnchorWriteProposal): Promise<{
        proposalPath: string;
        status: string;
    }>;
    loadAnchorSnapshot(): Promise<Record<string, string>>;
}
export declare function createWorkspaceArtifactStore(db: StateDatabase["db"]): WorkspaceArtifactStore;
