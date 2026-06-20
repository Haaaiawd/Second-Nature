/**
 * Host Capability Discovery Port (T-ROS.R.7)
 *
 * Core logic: provide an explicit boundary for proving that the Second Nature
 * tool (`second_nature_ops`) and packaged skill are visible to the host.
 *
 * Design authority:
 * - `.anws/v8/04_SYSTEM_DESIGN/runtime-ops-system.md §3.1`
 *
 * Dependencies: none (plain contracts)
 * Boundary: pure interface + a default fail-closed adapter that reports
 * `host_probe_unsupported` rather than inventing a discovery proof.
 * Test coverage: tests/unit/cli/host-discovery-port.test.ts
 */
export type HostDiscoveryStatus = "available" | "unavailable" | "unsupported" | "blocked";
export type HostToolUnavailableReason = "host_tool_unavailable" | "host_probe_unsupported" | "host_policy_blocked" | "host_probe_timeout";
export type HostSkillUnavailableReason = "skill_projection_unavailable" | "skill_probe_unsupported" | "host_policy_blocked" | "host_probe_timeout";
export interface HostToolDiscoveryResult {
    status: HostDiscoveryStatus;
    tools: string[];
    hostName?: string;
    hostVersion?: string;
    observedAt: string;
    reason?: HostToolUnavailableReason;
}
export interface HostSkillDiscoveryResult {
    status: HostDiscoveryStatus;
    skills: string[];
    observedAt: string;
    reason?: HostSkillUnavailableReason;
}
export interface HostCapabilityDiscoveryPort {
    /** Prove that `second_nature_ops` is visible in the current host session. */
    listHostTools(): Promise<HostToolDiscoveryResult>;
    /** Prove that the packaged skill is discoverable by the host skill registry. */
    listHostSkills?(): Promise<HostSkillDiscoveryResult>;
}
export interface HostDiscoveryProbeOptions {
    port: HostCapabilityDiscoveryPort;
    hostName?: string;
    hostVersion?: string;
}
export interface HostDiscoveryReport {
    toolDiscovery: HostToolDiscoveryResult;
    skillDiscovery: HostSkillDiscoveryResult;
    setupComplete: boolean;
    /** Evidence level for setup state after applying discovery truth. */
    evidenceLevel: "carrier_ack" | "contract_smoke" | "state_present";
    reason?: HostToolUnavailableReason | HostSkillUnavailableReason;
    nextStep: string;
}
/**
 * Default fail-closed adapter. It does not invent host API access;
 * it returns explicit `unsupported` diagnostics so callers cannot
 * promote setup to `real_runtime` without real host evidence.
 */
export declare function createDefaultHostDiscoveryPort(): HostCapabilityDiscoveryPort;
export declare function probeHostDiscovery(options: HostDiscoveryProbeOptions): Promise<HostDiscoveryReport>;
export interface HostToolVisibilityLogEntry {
    observedAt: string;
    hostName?: string;
    hostVersion?: string;
    command: string;
    toolDiscovery: HostToolDiscoveryResult;
    skillDiscovery: HostSkillDiscoveryResult;
    evidenceLevel: HostDiscoveryReport["evidenceLevel"];
    setupComplete: boolean;
}
/**
 * Persist a host tool/skill visibility log under the workspace so manual host
 * smoke appendices can include timestamp, hostName, hostVersion, raw tool list,
 * command envelope, and evidenceLevel.
 */
export declare function recordHostToolVisibilityLog(workspaceRoot: string, command: string, report: HostDiscoveryReport): Promise<void>;
