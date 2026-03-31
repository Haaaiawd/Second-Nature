export interface ReflectionClaim {
    text: string;
    sourceRefs: string[];
    claimType: "fact" | "inference" | "plan";
}
export interface ProposedWrite {
    targetAssetId: string;
    content: string;
    sourceRefs: string[];
}
export interface ReflectionGeneration {
    summary: string;
    claims: ReflectionClaim[];
    proposedWrites: ProposedWrite[];
    modelEvalRef: string;
}
export interface ReflectionWriteRequest {
    summary: string;
    claims: ReflectionClaim[];
    writes: ProposedWrite[];
    sourceRefs: string[];
    modelEvalRef: string;
    unsupportedClaimCount: number;
    sourceCoverageRatio: number;
}
export interface ReflectionPorts {
    loadQuietInputs(query: {
        lookbackDays: number;
    }): Promise<{
        sourceRefs: string[];
    }>;
    generateNarrativeReflection(input: {
        sourceRefs: string[];
    }): Promise<ReflectionGeneration>;
    filterAllowedWrites(writes: ProposedWrite[]): ProposedWrite[];
}
export declare function runNarrativeReflection(ports: ReflectionPorts, input: {
    lookbackDays: number;
}): Promise<ReflectionWriteRequest>;
