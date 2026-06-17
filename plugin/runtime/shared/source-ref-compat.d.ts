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
export type LegacySourceRefKind = "platform_item" | "workspace_artifact" | "decision_record" | "user_anchor" | "connector_result" | "host_report" | "fallback_artifact";
export interface LegacySourceRefLike {
    id: string;
    kind?: LegacySourceRefKind | string;
    uri: string;
}
export declare function sourceRefFamilyFromLegacyKind(kind: LegacySourceRefKind | string | undefined): SourceRefFamily;
export declare function legacyKindFromSourceRef(ref: SourceRef): LegacySourceRefKind;
export declare function toCanonicalSourceRef(ref: LegacySourceRefLike): SourceRef;
export declare function makeCanonicalSourceRef(input: {
    id: string;
    family: SourceRefFamily;
    uri: string;
    redactionClass?: SourceRef["redactionClass"];
}): SourceRef;
