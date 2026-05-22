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
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
export class AuditFamilyRegistry {
    entries;
    constructor(families) {
        const map = new Map();
        for (const entry of families) {
            map.set(entry.family, entry);
        }
        this.entries = map;
    }
    isRegistered(family) {
        return this.entries.has(family);
    }
    getEntry(family) {
        return this.entries.get(family);
    }
    validateFamily(family) {
        if (this.entries.has(family)) {
            return { ok: true };
        }
        return { ok: false, error: `unknown_audit_family: ${family}` };
    }
    listFamilies() {
        return [...this.entries.values()];
    }
    listSystemIds() {
        const ids = new Set();
        for (const entry of this.entries.values()) {
            ids.add(entry.systemId);
        }
        return [...ids].sort();
    }
    familiesForSystem(systemId) {
        return [...this.entries.values()].filter((e) => e.systemId === systemId);
    }
    get size() {
        return this.entries.size;
    }
}
let defaultRegistry;
export function loadAuditFamilyRegistry() {
    if (defaultRegistry) {
        return defaultRegistry;
    }
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const jsonPath = path.join(__dirname, "audit-family-registry.json");
    const raw = readFileSync(jsonPath, "utf-8");
    const data = JSON.parse(raw);
    defaultRegistry = new AuditFamilyRegistry(data.families);
    return defaultRegistry;
}
export function createAuditFamilyRegistry(families) {
    return new AuditFamilyRegistry(families);
}
