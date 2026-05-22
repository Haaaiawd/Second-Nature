/**
 * Audit family registry runtime (DR-040).
 *
 * Core logic:
 * - Loads registered families from `audit-family-registry.json`.
 * - Provides lookup and validation for audit write operations.
 * - Rejects writes from unknown (unregistered) families with
 *   `unknown_audit_family` error.
 * - Covers all 8 v7 system boundaries.
 *
 * Dependencies: audit-family-registry.json (co-located).
 * Boundary: Called before any audit write to validate family membership.
 * Test coverage: tests/unit/observability/family-registry.test.ts
 */
export interface AuditFamilyEntry {
    family: string;
    plane: string;
    systemId: string;
    description: string;
}
export interface AuditFamilyRegistryData {
    $schema: string;
    description: string;
    families: AuditFamilyEntry[];
}
export declare class AuditFamilyRegistry {
    private readonly entries;
    constructor(families: readonly AuditFamilyEntry[]);
    isRegistered(family: string): boolean;
    getEntry(family: string): AuditFamilyEntry | undefined;
    validateFamily(family: string): {
        ok: true;
    } | {
        ok: false;
        error: string;
    };
    listFamilies(): readonly AuditFamilyEntry[];
    listSystemIds(): string[];
    familiesForSystem(systemId: string): AuditFamilyEntry[];
    get size(): number;
}
export declare function loadAuditFamilyRegistry(): AuditFamilyRegistry;
export declare function createAuditFamilyRegistry(families: readonly AuditFamilyEntry[]): AuditFamilyRegistry;
