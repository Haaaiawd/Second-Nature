/**
 * Decision trace, delivery audit, source coverage, guidance grounding + explain index (T5.2.1).
 *
 * Core logic: append-only envelopes with hash chain; explain index links decisionId to events and
 * flags when delivery audit indicates no user-visible contact (target_none / not_sent_fallback).
 * Test coverage: tests/unit/observability/lived-experience-audit.test.ts
 */
import * as crypto from "node:crypto";
import { AppendOnlyAuditStore } from "../audit/append-only-audit-store.js";
import { buildAuditEnvelope } from "../audit/audit-envelope.js";
function validateDecisionTrace(t) {
    if (!t.decisionId?.trim())
        throw new Error("decision_trace_requires_decision_id");
    if (!t.traceId?.trim())
        throw new Error("decision_trace_requires_trace_id");
    if (!t.outcome)
        throw new Error("decision_trace_requires_outcome");
}
function validateDeliveryAudit(a) {
    if (!a.auditId?.trim())
        throw new Error("delivery_audit_requires_audit_id");
    if (!a.decisionId?.trim())
        throw new Error("delivery_audit_requires_decision_id");
    if (a.status === "sent") {
        const ok = Boolean(a.messageId?.trim()) || Boolean(a.hostProofRef);
        if (!ok)
            throw new Error("delivery_audit_sent_requires_message_id_or_host_proof_ref");
    }
}
export class LivedExperienceAuditRecorder {
    store;
    seq = 0;
    explainIndex = new Map();
    constructor(store) {
        this.store = store;
    }
    bumpSequence() {
        this.seq += 1;
        return this.seq;
    }
    touchDecision(decisionId, traceId, eventId) {
        let e = this.explainIndex.get(decisionId);
        if (!e) {
            e = { traceIds: new Set(), eventIds: [], deliveryStatuses: [], fallbackRefs: [], noUserVisibleContact: false };
            this.explainIndex.set(decisionId, e);
        }
        e.traceIds.add(traceId);
        e.eventIds.push(eventId);
        return e;
    }
    recordDecisionTrace(payload) {
        validateDecisionTrace(payload);
        const seq = this.bumpSequence();
        const envelope = buildAuditEnvelope({
            family: "heartbeat.decision",
            plane: "decision",
            traceId: payload.traceId,
            sequence: seq,
            payload,
            previousHash: this.store.lastRecordHash(),
            eventId: crypto.randomUUID(),
            createdAt: payload.createdAt,
        });
        this.store.append(envelope);
        const entry = this.touchDecision(payload.decisionId, payload.traceId, envelope.eventId);
        if (payload.outcome === "heartbeat_ok" &&
            payload.reasonCodes.some((c) => c.includes("target_none") || c === "target_none")) {
            entry.noUserVisibleContact = true;
        }
        return { eventId: envelope.eventId };
    }
    recordDeliveryAudit(payload) {
        validateDeliveryAudit(payload);
        const seq = this.bumpSequence();
        const envelope = buildAuditEnvelope({
            family: "delivery",
            plane: "delivery",
            traceId: payload.traceId,
            sequence: seq,
            payload,
            previousHash: this.store.lastRecordHash(),
            eventId: payload.auditId,
            createdAt: payload.createdAt,
        });
        this.store.append(envelope);
        const entry = this.touchDecision(payload.decisionId, payload.traceId, envelope.eventId);
        entry.deliveryStatuses.push(payload.status);
        if (payload.fallbackRef)
            entry.fallbackRefs.push(payload.fallbackRef);
        if (payload.status === "target_none" ||
            payload.status === "not_sent_fallback" ||
            payload.status === "channel_missing" ||
            payload.status === "host_unsupported" ||
            payload.status === "failed" ||
            payload.status === "ack_dropped") {
            entry.noUserVisibleContact = true;
        }
        return { eventId: envelope.eventId };
    }
    recordSourceCoverage(payload) {
        const seq = this.bumpSequence();
        const envelope = buildAuditEnvelope({
            family: "source_coverage",
            plane: "source_coverage",
            traceId: payload.traceId,
            sequence: seq,
            payload,
            previousHash: this.store.lastRecordHash(),
            eventId: payload.auditId,
            createdAt: payload.createdAt,
        });
        this.store.append(envelope);
        if (payload.decisionId) {
            this.touchDecision(payload.decisionId, payload.traceId, envelope.eventId);
        }
        return { eventId: envelope.eventId };
    }
    recordGuidanceGrounding(payload) {
        const seq = this.bumpSequence();
        const envelope = buildAuditEnvelope({
            family: "guidance.grounding",
            plane: "source_coverage",
            traceId: payload.traceId,
            sequence: seq,
            payload,
            previousHash: this.store.lastRecordHash(),
            eventId: payload.auditId,
            createdAt: payload.createdAt,
        });
        this.store.append(envelope);
        if (payload.decisionId) {
            this.touchDecision(payload.decisionId, payload.traceId, envelope.eventId);
        }
        return { eventId: envelope.eventId };
    }
    explainLinkageForDecision(decisionId) {
        const entry = this.explainIndex.get(decisionId);
        const warnings = [];
        if (!entry) {
            return {
                decisionId,
                summary: "no_audit_events_indexed_for_decision",
                warnings: ["no_indexed_events"],
                relatedEventIds: [],
            };
        }
        if (entry.noUserVisibleContact) {
            warnings.push("no_user_visible_contact_claim_prohibited");
        }
        const lastDelivery = entry.deliveryStatuses[entry.deliveryStatuses.length - 1];
        return {
            decisionId,
            summary: `indexed_events=${entry.eventIds.length};delivery=${lastDelivery ?? "unknown"}`,
            warnings,
            deliveryStatus: lastDelivery,
            relatedEventIds: [...entry.eventIds],
        };
    }
}
export function createLivedExperienceAuditRecorder(store) {
    return new LivedExperienceAuditRecorder(store ?? new AppendOnlyAuditStore());
}
