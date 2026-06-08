/**
 * PolicyBoundWriteDispatch — Write-side connector dispatch with policy proof gate.
 *
 * Core logic: Verify policy proof before external write; reject without platform
 * call when proof is missing, deny, or lacks owner confirmation for high-risk
 * actions. Support dry-run mode for safe testing.
 *
 * Design authority:
 * - `.anws/v8/04_SYSTEM_DESIGN/connector-system.md §2`
 * - `.anws/v8/04_SYSTEM_DESIGN/action-closure-policy-system.detail.md §3.3`
 * - `docs/validation/openclaw-plugin-classification.md §5`
 *
 * Dependencies:
 * - `src/connectors/base/contract.js` (ConnectorRequest, ConnectorResult, PolicyProof)
 * - `src/connectors/base/policy-layer.js` (createConnectorPolicyLayer)
 *
 * Boundary:
 * - Does NOT bypass ActionPolicyDecision.
 * - Does NOT execute write without valid policy proof.
 * - Does NOT leak credentials in returned results.
 */
import type { ConnectorRequest, ConnectorResult } from "./contract.js";
export interface WriteDispatchResult {
    status: "allowed" | "denied" | "deferred" | "dry_run" | "downgraded";
    reason: string;
    connectorResult?: ConnectorResult<unknown>;
    simulatedPayload?: Record<string, unknown>;
}
export declare function dispatchPolicyBoundWrite(request: ConnectorRequest, executeConnector: (req: ConnectorRequest) => Promise<ConnectorResult<unknown>>): Promise<WriteDispatchResult>;
