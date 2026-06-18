/**
 * SourceRef compatibility adapters.
 *
 * Core logic: convert legacy v5/v7 source-ref shapes that used `kind` into
 * the v8 canonical `SourceRef` shape (`family` + `redactionClass`).
 * Dependencies: shared v8 contracts only.
 * Boundary: compatibility at old/new system seams; canonical v8 modules should
 * pass `SourceRef` directly without reintroducing local clones.
 * Test coverage: Wave 113 typecheck and affected control-plane/host/life-evidence tests.
 */
import type { SourceRef, SourceRefFamily } from "./types/v8-contracts.js";

export type LegacySourceRefKind =
  | "platform_item"
  | "workspace_artifact"
  | "decision_record"
  | "user_anchor"
  | "connector_result"
  | "host_report"
  | "fallback_artifact";

export interface LegacySourceRefLike {
  id: string;
  kind?: LegacySourceRefKind | string;
  uri: string;
}

export function sourceRefFamilyFromLegacyKind(kind: LegacySourceRefKind | string | undefined): SourceRefFamily {
  switch (kind) {
    case "connector_result":
      return "connector_result";
    case "decision_record":
      return "judgment";
    case "platform_item":
    case "user_anchor":
      return "evidence";
    case "workspace_artifact":
    case "host_report":
    case "fallback_artifact":
    default:
      return "audit";
  }
}

export function legacyKindFromSourceRef(ref: SourceRef): LegacySourceRefKind {
  // Check family first so canonical connector_result refs with platform://
  // URIs are not incorrectly downgraded to "platform_item".
  if (ref.family === "connector_result") {
    return "connector_result";
  }
  if (ref.uri.startsWith("platform://")) {
    return "platform_item";
  }
  if (ref.uri.startsWith("goal://") || ref.uri.startsWith("workspace://")) {
    return "workspace_artifact";
  }
  if (ref.id.startsWith("anchor:") || ref.id.startsWith("curated:") || /(?:USER|MEMORY)\.md$/i.test(ref.uri)) {
    return "user_anchor";
  }
  switch (ref.family) {
    case "judgment":
      return "decision_record";
    case "evidence":
    case "perception":
      return "platform_item";
    case "audit":
    case "action_closure":
    case "quiet_review":
    case "dream_run":
    case "memory_projection":
    case "projection":
    case "tool_experience":
    default:
      return "workspace_artifact";
  }
}

export function toCanonicalSourceRef(ref: LegacySourceRefLike): SourceRef {
  return {
    id: ref.id,
    uri: ref.uri,
    family: sourceRefFamilyFromLegacyKind(ref.kind),
    redactionClass: "none",
  };
}

export function makeCanonicalSourceRef(input: {
  id: string;
  family: SourceRefFamily;
  uri: string;
  redactionClass?: SourceRef["redactionClass"];
}): SourceRef {
  return {
    id: input.id,
    family: input.family,
    uri: input.uri,
    redactionClass: input.redactionClass ?? "none",
  };
}
