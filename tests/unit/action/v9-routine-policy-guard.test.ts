/**
 * v9 ToolRoutine Guard Policy — Unit Tests (T4.2.2)
 *
 * Validates:
 * - routine permission expansion denied when allowedCapabilities exceed trigger capability
 * - requiresOwnerConfirm downgrade to owner_confirm
 * - deniedCapabilities block invocation
 * - maxSideEffectClass ceiling against policy context
 * - missing guard schema denies routine
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  evaluateV9ActionPolicy,
  type EvaluateV9ActionPolicyContext,
} from "../../../src/core/second-nature/action/v9-autonomy-policy-evaluator.js";
import type { ActionProposal, ToolRoutineGuardSchema } from "../../../src/shared/types/v9-contracts.js";

function makeProposal(overrides: Partial<ActionProposal> = {}): ActionProposal {
  return {
    id: "prop_test",
    cycleId: "cyc_test",
    actionKind: "routine",
    targetPlatformId: "moltbook",
    targetCapabilityId: "moltbook:feed.read",
    capabilityPattern: "moltbook:feed.read",
    triggerCapabilities: ["moltbook:feed.read"],
    sourceRefs: [{ family: "routine", id: "routine-1" }],
    proofRefs: [],
    reason: "proposal_created",
    riskPosture: "medium",
    sideEffectClass: "routine",
    idempotencyKey: "idem_test",
    routineInvocationId: "routine-1",
    routineVersion: "1.0.0",
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeGuard(overrides: Partial<ToolRoutineGuardSchema> = {}): ToolRoutineGuardSchema {
  return {
    version: "1.0.0",
    allowedCapabilities: ["moltbook:feed.read"],
    deniedCapabilities: [],
    maxSideEffectClass: "owner_attention",
    requiresOwnerConfirm: false,
    maxStepCount: 10,
    maxTimeoutMs: 5000,
    sandboxPolicy: "declarative_only",
    ...overrides,
  };
}

function makeContext(overrides: Partial<EvaluateV9ActionPolicyContext> = {}): EvaluateV9ActionPolicyContext {
  return {
    affordancePosture: {
      platformId: "moltbook",
      capabilityId: "feed.read",
      accessLevel: "credentialed",
      reliabilityLevel: "proven",
      familiarityLevel: "practiced",
      sourceRefs: [{ family: "capability_probe_result", id: "probe-1" }],
    },
    platformPermissionDeclared: true,
    circuitBreakerClosed: true,
    ownerPreference: true,
    credentialHealth: "ok",
    routineStatus: "active",
    ...overrides,
  };
}

describe("v9-routine-policy-guard", () => {
  it("allows active routine with matching guard and healthy context", () => {
    const decision = evaluateV9ActionPolicy(
      makeProposal({ guard: makeGuard() }),
      makeContext(),
    );
    assert.equal(decision.decision, "allow");
    assert.equal(decision.decisionReason, "policy_allowed");
    assert.equal(decision.autonomyLevel, "auto_allowed");
  });

  it("denies routine when allowedCapabilities expand beyond trigger capability", () => {
    const decision = evaluateV9ActionPolicy(
      makeProposal({
        guard: makeGuard({
          allowedCapabilities: ["moltbook:feed.read", "moltbook:feed.write"],
        }),
      }),
      makeContext(),
    );
    assert.equal(decision.decision, "deny");
    assert.equal(decision.decisionReason, "routine_permission_expansion_denied");
    assert.equal(decision.autonomyLevel, "none");
  });

  it("downgrades routine when guard requires owner confirm", () => {
    const decision = evaluateV9ActionPolicy(
      makeProposal({
        guard: makeGuard({ requiresOwnerConfirm: true }),
      }),
      makeContext(),
    );
    assert.equal(decision.decision, "downgrade");
    assert.equal(decision.decisionReason, "policy_downgraded_to_draft");
    assert.equal(decision.autonomyLevel, "owner_confirm");
  });

  it("denies routine when target capability is in guard deniedCapabilities", () => {
    const decision = evaluateV9ActionPolicy(
      makeProposal({
        guard: makeGuard({
          deniedCapabilities: ["moltbook:feed.read"],
        }),
      }),
      makeContext(),
    );
    assert.equal(decision.decision, "deny");
    assert.equal(decision.decisionReason, "routine_guard_policy_denied");
  });

  it("denies routine when guard maxSideEffectClass=external_write but permission context missing", () => {
    const decision = evaluateV9ActionPolicy(
      makeProposal({
        guard: makeGuard({ maxSideEffectClass: "external_write" }),
      }),
      makeContext({ platformPermissionDeclared: false }),
    );
    assert.equal(decision.decision, "deny");
    assert.equal(decision.decisionReason, "routine_permission_expansion_denied");
  });

  it("denies routine when guard maxSideEffectClass=owner_attention but owner preference false", () => {
    const decision = evaluateV9ActionPolicy(
      makeProposal({
        guard: makeGuard({ maxSideEffectClass: "owner_attention" }),
      }),
      makeContext({ ownerPreference: false }),
    );
    assert.equal(decision.decision, "deny");
    assert.equal(decision.decisionReason, "routine_guard_policy_denied");
  });

  it("denies routine when guard schema is missing", () => {
    const decision = evaluateV9ActionPolicy(
      makeProposal({ guard: undefined }),
      makeContext(),
    );
    assert.equal(decision.decision, "deny");
    assert.equal(decision.decisionReason, "routine_guard_policy_denied");
  });

  it("denies routine when guard schema version is unsupported", () => {
    const decision = evaluateV9ActionPolicy(
      makeProposal({
        guard: {
          ...makeGuard(),
          version: "2.0.0" as "1.0.0",
        },
      }),
      makeContext(),
    );
    assert.equal(decision.decision, "deny");
    assert.equal(decision.decisionReason, "routine_guard_schema_invalid");
  });

  it("allows routine when allowedCapabilities match wildcard capabilityPattern", () => {
    const decision = evaluateV9ActionPolicy(
      makeProposal({
        capabilityPattern: "moltbook:feed.*",
        triggerCapabilities: [],
        targetCapabilityId: "moltbook:feed.read",
        guard: makeGuard({
          allowedCapabilities: ["moltbook:feed.read"],
        }),
      }),
      makeContext(),
    );
    assert.equal(decision.decision, "allow");
    assert.equal(decision.decisionReason, "policy_allowed");
  });

  it("denies routine when allowedCapabilities expand beyond wildcard capabilityPattern", () => {
    const decision = evaluateV9ActionPolicy(
      makeProposal({
        capabilityPattern: "moltbook:feed.*",
        triggerCapabilities: [],
        targetCapabilityId: "moltbook:feed.read",
        guard: makeGuard({
          allowedCapabilities: ["moltbook:feed.read", "moltbook:profile.write"],
        }),
      }),
      makeContext(),
    );
    assert.equal(decision.decision, "deny");
    assert.equal(decision.decisionReason, "routine_permission_expansion_denied");
  });

  it("denies routine when allowedCapabilities expand beyond multiple trigger capabilities", () => {
    const decision = evaluateV9ActionPolicy(
      makeProposal({
        capabilityPattern: undefined,
        triggerCapabilities: ["moltbook:feed.read", "moltbook:feed.search"],
        targetCapabilityId: "moltbook:feed.read",
        guard: makeGuard({
          allowedCapabilities: ["moltbook:feed.read", "moltbook:profile.read"],
        }),
      }),
      makeContext(),
    );
    assert.equal(decision.decision, "deny");
    assert.equal(decision.decisionReason, "routine_permission_expansion_denied");
  });

  it("denies routine when maxSideEffectClass exceeds trigger capability side-effect class", () => {
    const decision = evaluateV9ActionPolicy(
      makeProposal({
        targetCapabilityId: "moltbook:feed.read",
        capabilityPattern: "moltbook:feed.read",
        triggerCapabilities: ["moltbook:feed.read"],
        guard: makeGuard({ maxSideEffectClass: "external_write" }),
      }),
      makeContext(),
    );
    assert.equal(decision.decision, "deny");
    assert.equal(decision.decisionReason, "routine_permission_expansion_denied");
  });

  it("still denies routine that is not active even with valid guard", () => {
    const decision = evaluateV9ActionPolicy(
      makeProposal({ guard: makeGuard() }),
      makeContext({ routineStatus: "candidate" }),
    );
    assert.equal(decision.decision, "deny");
    assert.equal(decision.decisionReason, "routine_invocation_denied");
  });
});
