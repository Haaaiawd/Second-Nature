/**
 * Life evidence contract types (state-system v5 subset for ingest port).
 *
 * Test coverage: tests/unit/storage/life-evidence.test.ts
 */
export type LifeEvidenceType = "platform_browse" | "platform_interaction" | "work_progress" | "task_discovery" | "user_interaction" | "quiet_reflection" | "delivery_fallback";
export type Sensitivity = "public" | "private" | "credential" | "sensitive";
export interface SourceRef {
    id: string;
    kind: "platform_item" | "workspace_artifact" | "decision_record" | "user_anchor" | "connector_result" | "host_report" | "fallback_artifact";
    uri: string;
    excerptHash?: string;
    observedAt?: string;
}
export interface LifeEvidenceCandidate {
    id?: string;
    timestamp: string;
    evidenceType: LifeEvidenceType;
    platformId?: string;
    summary: string;
    rawContentRef?: string;
    sourceRefs: SourceRef[];
    sensitivity: Sensitivity;
    confidence?: number;
    tags?: string[];
    producer: "connector-system" | "control-plane-system" | "observability-system" | "state-system";
}
export interface LifeEvidence {
    id: string;
    timestamp: string;
    evidenceType: LifeEvidenceType;
    platformId?: string;
    summary: string;
    rawContentRef?: string;
    sourceRefs: SourceRef[];
    sensitivity: Sensitivity;
    confidence: number;
    tags: string[];
    producer: string;
    artifactRef: SourceRef;
}
export interface LifeEvidenceWriteAck {
    evidenceId: string;
    artifactRef: SourceRef;
}
