export class AppendOnlyAuditStore {
    events = [];
    lastHashCache = new Map();
    append(envelope) {
        const family = envelope.family;
        const cachedHash = this.lastHashCache.get(family);
        if (cachedHash !== undefined) {
            if (envelope.integrity.previousHash !== cachedHash) {
                throw new Error("audit_previous_hash_mismatch");
            }
        }
        else {
            // No family cache — first event for this family
            if (envelope.integrity.previousHash !== undefined) {
                throw new Error("audit_genesis_previous_hash");
            }
        }
        this.events.push(envelope);
        this.lastHashCache.set(family, envelope.integrity.recordHash);
    }
    list() {
        return this.events;
    }
    /** O(1) per-family previousHash; falls back to global last when family omitted (backward compat). */
    lastRecordHash(family) {
        if (family) {
            return this.lastHashCache.get(family);
        }
        return this.events[this.events.length - 1]?.integrity.recordHash;
    }
    /**
     * Seed cache after process restart from DB latest record (DR-033 backfill).
     *
     * TODO(T-OBS.C.1): wire a startup bootstrap routine that queries the DB audit_log
     * table for the latest recordHash per family and calls seedFamilyHash().
     * Blocked: the observability DB schema does not yet have an audit_log table
     * with previousHash/recordHash columns; once added, backfill should be
     * invoked in the store constructor or at app bootstrap time.
     */
    seedFamilyHash(family, hash) {
        this.lastHashCache.set(family, hash);
    }
    /** Expose cached families for diagnostics / testing. */
    cachedFamilies() {
        return Array.from(this.lastHashCache.keys());
    }
}
