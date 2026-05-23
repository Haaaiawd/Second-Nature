/**
 * ClaimSynthesizer — T-DQS.C.1
 *
 * Core logic: Transform aggregated life evidence into source-backed QuietClaims.
 * - EvidenceAggregator: group and summarize raw evidence candidates
 * - ClaimDeduplicator: remove duplicate claims by sourceRef key
 * - ClaimSynthesizer: map evidence -> claim kind (observation/fact/pattern)
 * - SourceValidator: reject fact claims with empty sourceRefs (DR-025)
 *
 * Rules:
 * - Single weak evidence (confidence < 0.5, count == 1) → observation only
 * - Multiple evidence or confidence >= 0.5 → fact
 * - Pattern requires >= 3 related evidence with confidence >= 0.7
 * - Fact claim sourceRefs must be non-empty tuple (DR-025)
 * - SourceValidator returns claim_source_missing for empty sourceRefs
 *
 * Dependencies:
 * - `QuietClaim`, `QuietClaimKind` from `../../../shared/types/v7-entities.js`
 * - `LifeEvidenceCandidate` from `../../../storage/life-evidence/types.js`
 *
 * Test coverage: tests/unit/quiet/claim-synthesizer.test.ts
 */

import type {
  QuietClaim,
  QuietClaimKind,
} from "../../../shared/types/v7-entities.js";
import type {
  LifeEvidenceCandidate,
} from "../../../storage/life-evidence/types.js";

export interface EvidenceSlice {
  items: LifeEvidenceCandidate[];
  summary: string;
}

export interface ClaimSynthesisResult {
  claims: QuietClaim[];
  errors: string[];
}

export interface EvidenceAggregator {
  aggregate(candidates: LifeEvidenceCandidate[]): EvidenceSlice;
}

export interface ClaimDeduplicator {
  deduplicate(claims: QuietClaim[]): QuietClaim[];
}

export interface ClaimSynthesizer {
  synthesize(slice: EvidenceSlice): ClaimSynthesisResult;
}

export interface SourceValidator {
  validate(claim: QuietClaim): { ok: true } | { ok: false; reason: string };
}

// ── EvidenceAggregator ───────────────────────────────────────

export function createEvidenceAggregator(): EvidenceAggregator {
  return {
    aggregate(candidates) {
      // Group by evidenceType for summary
      const byType = new Map<string, LifeEvidenceCandidate[]>();
      for (const c of candidates) {
        const list = byType.get(c.evidenceType) ?? [];
        list.push(c);
        byType.set(c.evidenceType, list);
      }

      const parts: string[] = [];
      for (const [type, list] of byType) {
        parts.push(`${list.length} ${type}`);
      }

      return {
        items: candidates,
        summary: parts.join("; ") || "empty",
      };
    },
  };
}

// ── ClaimDeduplicator ────────────────────────────────────────

function sourceRefKey(claim: QuietClaim): string {
  return [...claim.sourceRefs].sort().join("|");
}

export function createClaimDeduplicator(): ClaimDeduplicator {
  return {
    deduplicate(claims) {
      const seen = new Set<string>();
      const result: QuietClaim[] = [];
      for (const claim of claims) {
        const key = sourceRefKey(claim);
        if (seen.has(key)) continue;
        seen.add(key);
        result.push(claim);
      }
      return result;
    },
  };
}

// ── ClaimSynthesizer ─────────────────────────────────────────

function determineKind(
  items: LifeEvidenceCandidate[],
  avgConfidence: number,
): QuietClaimKind {
  if (items.length === 1 && (items[0]!.confidence ?? 0) < 0.5) {
    return "observation";
  }
  if (items.length >= 3 && avgConfidence >= 0.7) {
    return "pattern";
  }
  return "fact";
}

function buildText(kind: QuietClaimKind, summary: string, count: number): string {
  switch (kind) {
    case "observation":
      return `Observed: ${summary}`;
    case "fact":
      return `Noted ${count} evidence(s): ${summary}`;
    case "pattern":
      return `Pattern detected across ${count} sources: ${summary}`;
  }
}

function toSourceRefTuple(
  refs: { id: string; uri: string }[],
): [string, ...string[]] {
  const ids = refs.map((r) => r.id);
  if (ids.length === 0) {
    // This should not happen if validation is correct, but type-safety requires it
    return ["synthetic:missing"];
  }
  return ids as [string, ...string[]];
}

export function createClaimSynthesizer(): ClaimSynthesizer {
  return {
    synthesize(slice) {
      const claims: QuietClaim[] = [];
      const errors: string[] = [];
      const now = new Date().toISOString();

      if (slice.items.length === 0) {
        return { claims: [], errors: [] };
      }

      // Group by evidenceType for per-group synthesis
      const byType = new Map<string, LifeEvidenceCandidate[]>();
      for (const item of slice.items) {
        const list = byType.get(item.evidenceType) ?? [];
        list.push(item);
        byType.set(item.evidenceType, list);
      }

      for (const [evidenceType, items] of byType) {
        const avgConfidence =
          items.reduce((sum, i) => sum + (i.confidence ?? 0), 0) /
          items.length;
        const kind = determineKind(items, avgConfidence);

        // Single weak evidence → observation only (no fact/pattern)
        if (items.length === 1 && (items[0]!.confidence ?? 0) < 0.5 && kind !== "observation") {
          errors.push(
            `weak_evidence_downgrade:${evidenceType}:single_weak_forced_to_observation`,
          );
        }

        const summary = items.map((i) => i.summary).join("; ");
        const text = buildText(kind, summary, items.length);
        const sourceRefs = toSourceRefTuple(
          items.map((i) => ({ id: i.id ?? i.summary, uri: i.sourceRefs[0]?.uri ?? "" })),
        );

        claims.push({
          claimId: `claim:${evidenceType}:${Date.now()}:${items.length}`,
          kind,
          text,
          sourceRefs,
          confidence: Math.min(avgConfidence, 1),
          createdAt: now,
        });
      }

      return { claims, errors };
    },
  };
}

// ── SourceValidator ──────────────────────────────────────────

export function createSourceValidator(): SourceValidator {
  return {
    validate(claim) {
      if (claim.kind === "fact" || claim.kind === "pattern") {
        if (claim.sourceRefs.length === 0) {
          return { ok: false, reason: "claim_source_missing" };
        }
        // Also validate that all refs are non-empty strings
        for (const ref of claim.sourceRefs) {
          if (!ref || ref.trim().length === 0) {
            return { ok: false, reason: "claim_source_missing" };
          }
        }
      }
      // observation claims are also required to have sourceRefs per DR-025
      if (claim.sourceRefs.length === 0) {
        return { ok: false, reason: "claim_source_missing" };
      }
      return { ok: true };
    },
  };
}
