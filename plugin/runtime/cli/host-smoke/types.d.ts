/**
 * Host smoke plan + report types (T1.3.1).
 *
 * `heartbeat_tool_invocation` verifies that a near-real transcript actually invoked heartbeat_check.
 */
export interface HeartbeatToolInvocationCase {
    readonly type: "heartbeat_tool_invocation";
    /** Tool names, ops strings, or host transcript fragments observed during the smoke turn */
    toolInvocations: string[];
}
export interface DocsVsObservedConflictCase {
    readonly type: "docs_vs_observed_conflict";
    docExpectation: string;
    observedBehavior: string;
}
export type HostSmokeCase = HeartbeatToolInvocationCase | DocsVsObservedConflictCase;
export interface HostSmokePlan {
    cases: HostSmokeCase[];
    docLinks?: string[];
    docCheckedAt?: string;
    hostVersion?: string;
}
export interface HostSmokeCaseResult {
    caseType: HostSmokeCase["type"];
    status: "pass" | "fail" | "unknown";
    reasons: string[];
}
export interface HostSmokeReport {
    reportId: string;
    generatedAt: string;
    results: HostSmokeCaseResult[];
    docLinks?: string[];
    docCheckedAt?: string;
    hostVersion?: string;
}
