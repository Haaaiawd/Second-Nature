export class ChannelHealthStore {
    byKey = new Map();
    attempts = new Map();
    upsert(snapshot) {
        const key = this.key(snapshot.platformId, snapshot.channel);
        this.byKey.set(key, snapshot);
    }
    get(platformId, channel) {
        return this.byKey.get(this.key(platformId, channel));
    }
    markAttempt(context) {
        this.attempts.set(context.traceId, context);
    }
    getAttempt(traceId) {
        return this.attempts.get(traceId);
    }
    clearAttempt(traceId) {
        this.attempts.delete(traceId);
    }
    key(platformId, channel) {
        return `${platformId}::${channel}`;
    }
}
