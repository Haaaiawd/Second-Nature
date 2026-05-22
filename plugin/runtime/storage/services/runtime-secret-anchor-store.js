/**
 * RuntimeSecretAnchorStore — T-SMS.C.6
 *
 * Core logic: Stores only locationRef/health/rotationPolicyRef for runtime
 * secrets. Key plaintext is NEVER persisted (ADR-007). WriteValidationGate
 * rejects any payload that contains key material.
 *
 * Dependencies:
 * - `StateDatabase` from `../db/index.js`
 * - `RuntimeSecretAnchor`, `SecretAnchorHealth` from `../../shared/types/v7-entities.js`
 * - `validateWritePayload` from `./write-validation-gate.js`
 *
 * Boundary:
 * - No key/credential/token/encryption_key field is ever written.
 * - Gate scans for sensitive field keys and rejects on hit.
 *
 * Test coverage: tests/unit/storage/runtime-secret-anchor-store.test.ts
 */
import { validateWritePayload } from "./write-validation-gate.js";
export function createRuntimeSecretAnchorStore(database) {
    const { sqlite } = database;
    return {
        async upsertAnchor(anchor) {
            // Guard: reject any payload that hints at key material
            const gate = validateWritePayload({
                anchorId: anchor.anchorId,
                locationRef: anchor.locationRef,
                health: anchor.health,
                rotationPolicyRef: anchor.rotationPolicyRef,
                updatedAt: anchor.updatedAt,
            });
            if (!gate.ok) {
                throw new Error(`RuntimeSecretAnchor rejected by gate: ${gate.reason}`);
            }
            sqlite.run(`INSERT INTO runtime_secret_anchor
         (anchor_id, location_ref, health, rotation_policy_ref, updated_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(anchor_id) DO UPDATE SET
           location_ref = excluded.location_ref,
           health = excluded.health,
           rotation_policy_ref = excluded.rotation_policy_ref,
           updated_at = excluded.updated_at`, [
                anchor.anchorId,
                anchor.locationRef,
                anchor.health,
                anchor.rotationPolicyRef ?? null,
                anchor.updatedAt,
            ]);
        },
        async loadAnchor(anchorId) {
            const result = sqlite.exec(`SELECT * FROM runtime_secret_anchor WHERE anchor_id = ?`, [anchorId]);
            if (result.length === 0 || result[0].values.length === 0) {
                return undefined;
            }
            const cols = result[0].columns;
            const get = (row, name) => row[cols.indexOf(name)];
            const row = result[0].values[0];
            return {
                anchorId: get(row, "anchor_id"),
                locationRef: get(row, "location_ref"),
                health: get(row, "health"),
                rotationPolicyRef: get(row, "rotation_policy_ref") ?? undefined,
                updatedAt: get(row, "updated_at"),
            };
        },
        async listAnchors() {
            const result = sqlite.exec(`SELECT * FROM runtime_secret_anchor ORDER BY updated_at DESC`);
            if (result.length === 0 || result[0].values.length === 0) {
                return [];
            }
            const cols = result[0].columns;
            const get = (row, name) => row[cols.indexOf(name)];
            return result[0].values.map((row) => ({
                anchorId: get(row, "anchor_id"),
                locationRef: get(row, "location_ref"),
                health: get(row, "health"),
                rotationPolicyRef: get(row, "rotation_policy_ref") ?? undefined,
                updatedAt: get(row, "updated_at"),
            }));
        },
    };
}
