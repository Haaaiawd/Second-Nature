/**
 * Side-effect idempotency + degraded-channel gate + effect commit replay (T3.2.1).
 * Aligns with connector-system.detail §3.6 enforceExecutionPolicy.
 */
import * as crypto from "node:crypto";
import { ConnectorPolicyError } from "./failure-taxonomy.js";
import type { CapabilityIntent, ConnectorRequest, ExecutionPlan } from "./contract.js";

export type EffectSemanticsClass = "read_only" | "side_effect" | "task_claim" | "keepalive";

const READONLY: ReadonlySet<CapabilityIntent> = new Set([
  "feed.read",
  "notification.list",
  "work.discover",
]);

export function classifyConnectorIntentEffect(intent: CapabilityIntent): EffectSemanticsClass {
  if (intent === "agent.heartbeat") return "keepalive";
  if (intent === "task.claim") return "task_claim";
  if (READONLY.has(intent)) return "read_only";
  return "side_effect";
}

export interface EffectCommitLedgerPort {
  getOrCreateIntentCommitRecord(input: {
    decisionId: string;
    intentId: string;
    idempotencyKey: string;
    effectClass: string;
  }): Promise<{
    existing: boolean;
    record: { id: string; state: string; outcomeRef?: string };
  }>;
}

/** In-memory ledger for tests and offline harnesses. */
export class InMemoryEffectCommitLedger implements EffectCommitLedgerPort {
  private readonly byKey = new Map<string, { id: string; state: string; outcomeRef?: string }>();

  private key(decisionId: string, idempotencyKey: string): string {
    return `${decisionId}::${idempotencyKey}`;
  }

  async getOrCreateIntentCommitRecord(input: {
    decisionId: string;
    intentId: string;
    idempotencyKey: string;
    effectClass: string;
  }): Promise<{ existing: boolean; record: { id: string; state: string; outcomeRef?: string } }> {
    const k = this.key(input.decisionId, input.idempotencyKey);
    const hit = this.byKey.get(k);
    if (hit) {
      return { existing: true, record: hit };
    }
    const id = crypto.randomUUID();
    const rec = { id, state: "planned", outcomeRef: undefined };
    this.byKey.set(k, rec);
    return { existing: false, record: rec };
  }

  /** Test seam: mark a key as already committed with replayable outcome. */
  seedCommitted(decisionId: string, idempotencyKey: string, outcomeRef: string): void {
    const id = crypto.randomUUID();
    this.byKey.set(this.key(decisionId, idempotencyKey), { id, state: "committed", outcomeRef });
  }

  markState(decisionId: string, idempotencyKey: string, state: string): void {
    const k = this.key(decisionId, idempotencyKey);
    const cur = this.byKey.get(k);
    if (!cur) throw new Error("ledger_seed_missing");
    this.byKey.set(k, { ...cur, state });
  }
}

export interface EnforceExecutionPolicyDeps {
  effectCommitLedger?: EffectCommitLedgerPort;
}

export async function enforceExecutionPolicy(
  plan: ExecutionPlan,
  intent: CapabilityIntent,
  request: ConnectorRequest,
  deps: EnforceExecutionPolicyDeps,
): Promise<{ skipAdapter: boolean; existingOutcomeRef?: string; effectCommitId?: string }> {
  const semantics = classifyConnectorIntentEffect(intent);

  if ((semantics === "side_effect" || semantics === "task_claim") && !plan.idempotencyKey?.trim()) {
    throw new ConnectorPolicyError("permanent_input_error", "side_effect_requires_idempotency_key");
  }

  if (plan.degraded && (semantics === "side_effect" || semantics === "task_claim")) {
    throw new ConnectorPolicyError("semantic_rejection", "degraded_channel_not_allowed_for_side_effect");
  }

  if (plan.idempotencyKey && deps.effectCommitLedger) {
    if (!request.decisionId?.trim() || !request.intentId?.trim()) {
      throw new ConnectorPolicyError("permanent_input_error", "effect_commit_requires_decision_and_intent_id");
    }
    const lookup = await deps.effectCommitLedger.getOrCreateIntentCommitRecord({
      decisionId: request.decisionId,
      intentId: request.intentId,
      idempotencyKey: plan.idempotencyKey,
      effectClass: semantics,
    });
    if (lookup.existing && lookup.record.state === "committed") {
      return {
        skipAdapter: true,
        existingOutcomeRef: lookup.record.outcomeRef,
        effectCommitId: lookup.record.id,
      };
    }
    if (lookup.existing && (lookup.record.state === "dispatched" || lookup.record.state === "reconcile")) {
      throw new ConnectorPolicyError("concurrency_conflict", "effect_commit_requires_reconcile");
    }
    return { skipAdapter: false, effectCommitId: lookup.record.id };
  }

  return { skipAdapter: false };
}
