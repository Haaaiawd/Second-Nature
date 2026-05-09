/**
 * Maps normalized connector success results to `LifeEvidenceCandidate` (T3.1.2).
 * Returns null when evidence cannot be source-backed (no refs, wrong intent, or failure).
 */
import type { CapabilityIntent, ConnectorResult } from "./contract.js";
import type { LifeEvidenceCandidate, LifeEvidenceType, SourceRef, Sensitivity } from "../../storage/life-evidence/types.js";

function extractSourceRefs(platformId: string, data: unknown, observedAt: string): SourceRef[] {
  if (data && typeof data === "object") {
    const record = data as Record<string, unknown>;
    if (Array.isArray(record.sourceRefs)) {
      const out: SourceRef[] = [];
      for (const item of record.sourceRefs) {
        if (item && typeof item === "object" && "uri" in item && "id" in item) {
          const ref = item as Record<string, unknown>;
          out.push({
            id: String(ref.id),
            kind: (ref.kind as SourceRef["kind"]) ?? "platform_item",
            uri: String(ref.uri),
            excerptHash: ref.excerptHash !== undefined ? String(ref.excerptHash) : undefined,
            observedAt: ref.observedAt !== undefined ? String(ref.observedAt) : observedAt,
          });
        }
      }
      if (out.length > 0) return out;
    }
    if (Array.isArray(record.items)) {
      return record.items.map((item, index) => {
        const id =
          item && typeof item === "object" && "id" in (item as object)
            ? String((item as { id: unknown }).id)
            : `${platformId}-item-${index}`;
        return {
          id,
          kind: "platform_item" as const,
          uri: `platform://${platformId}/item/${encodeURIComponent(id)}`,
          observedAt,
        };
      });
    }
  }
  return [];
}

function resolveEvidenceType(intent: CapabilityIntent): LifeEvidenceType | null {
  if (intent === "feed.read") return "platform_browse";
  if (intent === "work.discover") return "task_discovery";
  return null;
}

function resolveSensitivity(intent: CapabilityIntent, explicit?: Sensitivity): Sensitivity {
  if (explicit) return explicit;
  if (intent === "message.send" || intent === "comment.reply") return "private";
  return "public";
}

/**
 * Produce a single life-evidence candidate from a connector outcome, or null if not mappable.
 */
export function mapLifeEvidence(input: {
  platformId: string;
  intent: CapabilityIntent;
  result: ConnectorResult<unknown>;
  observedAt?: string;
  sensitivityOverride?: Sensitivity;
}): LifeEvidenceCandidate | null {
  if (input.result.status !== "success") {
    return null;
  }
  if (input.intent === "message.send") {
    return null;
  }
  const evidenceType = resolveEvidenceType(input.intent);
  if (!evidenceType) {
    return null;
  }
  const observedAt = input.observedAt ?? new Date().toISOString();
  const refs = extractSourceRefs(input.platformId, input.result.data, observedAt);
  if (refs.length === 0) {
    return null;
  }
  return {
    timestamp: observedAt,
    evidenceType,
    platformId: input.platformId,
    summary: `${input.platformId}:${input.intent}`,
    sourceRefs: refs,
    sensitivity: resolveSensitivity(input.intent, input.sensitivityOverride),
    producer: "connector-system",
  };
}
