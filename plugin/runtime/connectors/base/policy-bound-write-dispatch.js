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
// ───────────────────────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────────────────────
function isWriteCapability(intent) {
    const writeIntents = ["post.publish", "comment.reply", "message.send"];
    return writeIntents.includes(intent);
}
function validatePolicyProof(proof, intent) {
    if (!proof) {
        return {
            valid: false,
            reason: "policy_denied_missing_permission",
        };
    }
    if (proof.decision === "deny") {
        return {
            valid: false,
            reason: proof.reason || "policy_denied_high_risk",
        };
    }
    if (proof.decision === "defer") {
        return {
            valid: false,
            reason: "policy_deferred_owner_confirmation",
        };
    }
    if (proof.decision === "downgrade") {
        return {
            valid: false,
            reason: proof.reason || "policy_downgraded_to_draft",
        };
    }
    // Allow decision
    if (proof.decision !== "allow") {
        return {
            valid: false,
            reason: "policy_denied_missing_permission",
        };
    }
    // For write capabilities, require owner-confirm, dry-run, or explicit owner-confirmed flag
    if (isWriteCapability(intent) &&
        !proof.ownerConfirmMode &&
        !proof.dryRun &&
        !proof.ownerConfirmed) {
        return {
            valid: false,
            reason: "policy_denied_owner_confirm_required",
        };
    }
    return { valid: true, reason: "policy_allowed" };
}
// ───────────────────────────────────────────────────────────────
// Public API
// ───────────────────────────────────────────────────────────────
export async function dispatchPolicyBoundWrite(request, executeConnector) {
    const { intent, policyProof, payload } = request;
    // Only gate write capabilities
    if (!isWriteCapability(intent)) {
        // Read capabilities pass through to normal execution
        const result = await executeConnector(request);
        return {
            status: "allowed",
            reason: "read_capability_no_policy_gate",
            connectorResult: result,
        };
    }
    // Validate policy proof
    const validation = validatePolicyProof(policyProof, intent);
    if (!validation.valid) {
        return {
            status: validation.reason === "policy_deferred_owner_confirmation"
                ? "deferred"
                : "denied",
            reason: validation.reason,
        };
    }
    // Dry-run mode: simulate execution without platform call
    if (policyProof?.dryRun) {
        return {
            status: "dry_run",
            reason: "dry_run_simulated_success",
            simulatedPayload: {
                ...payload,
                _simulated: true,
                _idempotencyKey: request.idempotencyKey,
                _decisionId: policyProof.decisionId,
            },
        };
    }
    // Owner-confirm mode without explicit approval: defer to owner approval
    if (policyProof?.ownerConfirmMode && !policyProof?.ownerConfirmed) {
        return {
            status: "deferred",
            reason: "owner_confirm_pending",
        };
    }
    // Full allow → execute connector
    const result = await executeConnector(request);
    return {
        status: result.status === "success" ? "allowed" : "denied",
        reason: result.status === "success"
            ? "execution_completed"
            : (result.failureClass || "execution_failed"),
        connectorResult: result,
    };
}
