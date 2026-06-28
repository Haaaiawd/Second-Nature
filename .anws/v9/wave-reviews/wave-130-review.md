# Wave 130 Code Review — 2026-06-28

## Summary conclusion

**Pass**

All three previously-flagged Low issues from the first-pass Wave 130 review are resolved. No Critical, High, Medium, or Low issues remain in T4.2.2 scope.

## Previously-flagged Low issues — current state

1. **`RoutinePolicyEvaluationContext` type drift**
   - **Previous state**: Defined but unused in `src/shared/types/v9-contracts.ts:802-809`.
   - **Current state**: Removed from `src/shared/types/v9-contracts.ts`. A grep for `RoutinePolicyEvaluationContext` now returns only historical references in `.anws/v9/04_SYSTEM_DESIGN/action-closure-policy-system.detail.md:183`, `.anws/v9/05A_TASKS.md:257`, `AGENTS.md:281`, and the previous review file. The evaluator uses `EvaluateV9ActionPolicyContext` (`src/core/second-nature/action/v9-autonomy-policy-evaluator.ts:44-49`) and attaches the parsed guard directly to `ActionProposal.guard` (`src/shared/types/v9-contracts.ts:787`).
   - **Verdict**: Resolved.

2. **Invocation-time `external_write` rejection reason code**
   - **Previous state**: Returned `routine_permission_expansion_denied` at `src/core/second-nature/action/v9-autonomy-policy-evaluator.ts:218-223`.
   - **Current state**: Returns `routine_guard_policy_denied` at `src/core/second-nature/action/v9-autonomy-policy-evaluator.ts:217-223`, correctly distinguishing invocation-time policy-context rejection from capability expansion denial.
   - **Verdict**: Resolved.

3. **Default `ActionClosurePort` permission/owner preference derivation**
   - **Previous state**: Hardcoded `platformPermissionDeclared: false` and `ownerPreference: false` at `src/core/second-nature/control-plane/v9-heartbeat-orchestrator.ts:358-361`.
   - **Current state**: Derives both from affordance posture at `src/core/second-nature/control-plane/v9-heartbeat-orchestrator.ts:356-363`:
     ```ts
     const isCredentialed = affordancePosture.accessLevel === "credentialed";
     const policyContext = {
       ...
       platformPermissionDeclared: isCredentialed,
       ownerPreference: isCredentialed,
       ...
     };
     ```
   - **Verdict**: Resolved.

## Review scope and static boundary

**Read (static only, no execution)**

- Implementation files: `src/core/second-nature/action/v9-autonomy-policy-evaluator.ts`, `src/core/second-nature/control-plane/v9-heartbeat-orchestrator.ts`, `src/shared/types/v9-contracts.ts`.
- Design anchors: `.anws/v9/04_SYSTEM_DESIGN/action-closure-policy-system.detail.md`, `.anws/v9/04_SYSTEM_DESIGN/shared-v9-contracts.md`, `.anws/v9/05A_TASKS.md` (T4.2.2).

**Not executed**

- No tests were run, no project was started, no files were modified.

## Issues

### Critical

None.

### High

None.

### Medium

None.

### Low

None.

## Verification

- **File written**: `.anws/v9/wave-reviews/wave-130-review.md`
- **Summary conclusion**: Pass
- **Highest severity issue found**: none
