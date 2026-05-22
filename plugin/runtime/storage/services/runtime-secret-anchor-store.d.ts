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
import type { StateDatabase } from "../db/index.js";
import type { RuntimeSecretAnchor } from "../../shared/types/v7-entities.js";
export interface RuntimeSecretAnchorStore {
    upsertAnchor(anchor: RuntimeSecretAnchor): Promise<void>;
    loadAnchor(anchorId: string): Promise<RuntimeSecretAnchor | undefined>;
    listAnchors(): Promise<RuntimeSecretAnchor[]>;
}
export declare function createRuntimeSecretAnchorStore(database: StateDatabase): RuntimeSecretAnchorStore;
