import type { DecisionRecord, ExecutionAttempt } from "../../shared/types/continuity.js";

export interface GovernanceEvidenceRecord {
  id: string;
  eventType: string;
  proposalId?: string;
  targetAssetId?: string;
  assetPath?: string;
  statusFrom?: string;
  statusTo: string;
  beforeHash?: string;
  afterHash?: string;
  supportingSources: string[];
  reason?: string;
  verificationDeadline?: string;
  attemptsRemaining?: number;
  createdAt: string;
}

export interface ResolvedContentRef {
  ref: string;
  resolved: boolean;
  content?: string;
}

export interface EvidenceResolutionPlan {
  path: string[];
  key: "decisionId" | "traceId" | "assetId" | "proposalId" | "sessionId";
}

export interface EvidenceQuery {
  decisionId?: string;
  traceId?: string;
  assetId?: string;
  proposalId?: string;
  sessionId?: string;
  includeContentRefs?: boolean;
}

export interface ExplanationCapsule {
  conclusion: string;
  keyFactors: string[];
  evidenceRefs: string[];
}

export interface EvidenceBundle {
  query: EvidenceQuery;
  plan: EvidenceResolutionPlan;
  decisions: DecisionRecord[];
  attempts: ExecutionAttempt[];
  governance: GovernanceEvidenceRecord[];
  resolvedContentRefs: ResolvedContentRef[];
  explanation: ExplanationCapsule;
}

function collectEvidenceRefs(decisions: DecisionRecord[], governance: GovernanceEvidenceRecord[]): string[] {
  const refs = new Set<string>();

  for (const record of decisions) {
    for (const ref of record.evidenceRefs) {
      refs.add(ref);
    }
  }

  for (const record of governance) {
    for (const ref of record.supportingSources) {
      refs.add(ref);
    }
  }

  return [...refs];
}

export function composeEvidenceBundle(input: {
  query: EvidenceQuery;
  plan: EvidenceResolutionPlan;
  decisions: DecisionRecord[];
  attempts: ExecutionAttempt[];
  governance: GovernanceEvidenceRecord[];
  resolvedContentRefs: ResolvedContentRef[];
}): EvidenceBundle {
  const { query, plan, decisions, attempts, governance, resolvedContentRefs } = input;
  const evidenceRefs = collectEvidenceRefs(decisions, governance);

  const keyFactors = [
    ...new Set([
      ...decisions.flatMap((d) => d.reasonCodes),
      ...attempts.map((a) => a.failureClass).filter((x): x is string => Boolean(x)),
      ...governance.map((g) => g.eventType),
    ]),
  ];

  const conclusion = decisions.length > 0
    ? `找到 ${decisions.length} 条决策证据与 ${attempts.length} 条执行证据。`
    : governance.length > 0
      ? `找到 ${governance.length} 条治理证据。`
      : "仅找到有限证据，建议补充查询键。";

  return {
    query,
    plan,
    decisions,
    attempts,
    governance,
    resolvedContentRefs,
    explanation: {
      conclusion,
      keyFactors,
      evidenceRefs,
    },
  };
}
