export type TopLevelMode = "active" | "quiet" | "maintenance_only" | "paused_for_interrupt";

export type DecisionVerdict = "allow" | "deny" | "defer" | "escalate";

export type DecisionBasis = "rule_only" | "score_based" | "model_assisted";

export type IntentCommitState =
  | "planned"
  | "dispatched"
  | "externally_acknowledged"
  | "committed"
  | "reconcile"
  | "aborted";

export interface DecisionRecord {
  id: string;
  tickId: string;
  traceId: string;
  intentId?: string;
  platformId?: string;
  verdict: DecisionVerdict;
  mode: TopLevelMode;
  reasons: string[];
  reasonCodes: string[];
  decisionBasis: DecisionBasis;
  evidenceRefs: string[];
  modelEvalRef?: string;
  createdAt: string;
}

export interface ExecutionAttempt {
  id: string;
  traceId: string;
  decisionId: string;
  intentId: string;
  platformId: string;
  capability: string;
  channel: string;
  status: "planned" | "started" | "succeeded" | "failed";
  commitState?: IntentCommitState;
  failureClass?: string;
  retryPolicy?: string;
  idempotencyKey?: string;
  metadata?: Record<string, unknown>;
  startedAt?: string;
  finishedAt?: string;
}

export interface AnchorChangeAudit {
  id: string;
  proposalId: string;
  targetAssetId: string;
  assetPath: string;
  status: "draft" | "requires_review" | "approved" | "rejected" | "applied" | "conflicted";
  beforeHash?: string;
  afterHash?: string;
  supportingSources: string[];
  reason: string;
  appliedAt?: string;
  createdAt: string;
}

export interface IntentCommitOutcome {
  traceId: string;
  outcomeRef: string;
}

export interface IntentCommitRecord {
  id: string;
  intentId: string;
  decisionId: string;
  checkpointId?: string;
  state: IntentCommitState;
  outcomeRef?: string;
  metadata?: Record<string, unknown>;
  updatedAt: string;
}

export interface IntentCommitRecordInput {
  intentId: string;
  decisionId: string;
  checkpointId?: string;
  state: IntentCommitState;
}
