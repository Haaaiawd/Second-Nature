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

export class AuditFamilyRegistry {
  private readonly entries: ReadonlyMap<string, AuditFamilyEntry>;

  constructor(families: readonly AuditFamilyEntry[]) {
    const map = new Map<string, AuditFamilyEntry>();
    for (const entry of families) {
      map.set(entry.family, entry);
    }
    this.entries = map;
  }

  isRegistered(family: string): boolean {
    return this.entries.has(family);
  }

  getEntry(family: string): AuditFamilyEntry | undefined {
    return this.entries.get(family);
  }

  validateFamily(family: string): { ok: true } | { ok: false; error: string } {
    if (this.entries.has(family)) {
      return { ok: true };
    }
    return { ok: false, error: `unknown_audit_family: ${family}` };
  }

  listFamilies(): readonly AuditFamilyEntry[] {
    return [...this.entries.values()];
  }

  listSystemIds(): string[] {
    const ids = new Set<string>();
    for (const entry of this.entries.values()) {
      ids.add(entry.systemId);
    }
    return [...ids].sort();
  }

  familiesForSystem(systemId: string): AuditFamilyEntry[] {
    return [...this.entries.values()].filter(
      (e) => e.systemId === systemId
    );
  }

  get size(): number {
    return this.entries.size;
  }
}

let defaultRegistry: AuditFamilyRegistry | undefined;

export function loadAuditFamilyRegistry(): AuditFamilyRegistry {
  if (defaultRegistry) {
    return defaultRegistry;
  }

  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const jsonPath = path.join(__dirname, "audit-family-registry.json");
  const raw = readFileSync(jsonPath, "utf-8");
  const data: AuditFamilyRegistryData = JSON.parse(raw);

  defaultRegistry = new AuditFamilyRegistry(data.families);
  return defaultRegistry;
}

export function createAuditFamilyRegistry(
  families: readonly AuditFamilyEntry[]
): AuditFamilyRegistry {
  return new AuditFamilyRegistry(families);
}
