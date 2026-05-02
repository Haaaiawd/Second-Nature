export class AppendOnlyAuditStore {
    events = [];
    append(envelope) {
        const last = this.events[this.events.length - 1];
        if (last) {
            if (envelope.integrity.previousHash !== last.integrity.recordHash) {
                throw new Error("audit_previous_hash_mismatch");
            }
        }
        else if (envelope.integrity.previousHash !== undefined) {
            throw new Error("audit_genesis_previous_hash");
        }
        this.events.push(envelope);
    }
    list() {
        return this.events;
    }
    lastRecordHash() {
        return this.events[this.events.length - 1]?.integrity.recordHash;
    }
}
