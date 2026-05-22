/**
 * BehaviorPromotionLoop — T-BTS.C.3
 *
 * Core logic: Operator-authorized behavior suggestion lifecycle.
 * - candidate → approved (idempotent: repeated approve returns existing)
 * - candidate → rejected (with reason)
 * - candidate → expired (7 days TTL from submission)
 * - rejected/expired are read-only; new submit creates a fresh candidate
 *
 * Dependencies:
 * - `StateDatabase` from `../../../../storage/db/index.js`
 *
 * Boundary:
 * - Does NOT grant execution authorization; approval is a bookkeeping signal.
 * - Only accepts operator-authorized suggestions, not connector auto-probe results.
 *
 * Test coverage: tests/unit/body/behavior-promotion-loop.test.ts
 */

import type { StateDatabase } from "../../../../storage/db/index.js";

export type PromotionStatus = "candidate" | "approved" | "rejected" | "expired";

export interface BehaviorPromotion {
  promotionId: string;
  behaviorKind: string;
  description: string;
  status: PromotionStatus;
  operatorId?: string;
  rejectReason?: string;
  submittedAt: string;
  decidedAt?: string;
  expiresAt: string;
}

export interface BehaviorPromotionLoop {
  submitPromotion(input: {
    promotionId: string;
    behaviorKind: string;
    description: string;
    operatorId?: string;
  }): Promise<BehaviorPromotion>;
  approvePromotion(promotionId: string): Promise<BehaviorPromotion>;
  rejectPromotion(promotionId: string, reason: string): Promise<BehaviorPromotion>;
  loadPromotion(promotionId: string): Promise<BehaviorPromotion | undefined>;
  listPromotions(status?: PromotionStatus): Promise<BehaviorPromotion[]>;
  expireStaleCandidates(): Promise<number>;
}

const DEFAULT_TTL_DAYS = 7;

function rowToPromotion(
  row: unknown[],
  cols: string[],
): BehaviorPromotion {
  const get = (name: string) =>
    row[cols.indexOf(name)] as string | null;
  return {
    promotionId: get("promotion_id")!,
    behaviorKind: get("behavior_kind")!,
    description: get("description")!,
    status: get("status")! as PromotionStatus,
    operatorId: (get("operator_id") as string | null) ?? undefined,
    rejectReason: (get("reject_reason") as string | null) ?? undefined,
    submittedAt: get("submitted_at")!,
    decidedAt: (get("decided_at") as string | null) ?? undefined,
    expiresAt: get("expires_at")!,
  };
}

export function createBehaviorPromotionLoop(
  database: StateDatabase,
): BehaviorPromotionLoop {
  const { sqlite } = database;

  function loadRecord(
    promotionId: string,
  ): BehaviorPromotion | undefined {
    const result = sqlite.exec(
      `SELECT * FROM behavior_promotion WHERE promotion_id = ?`,
      [promotionId],
    );
    if (result.length === 0 || result[0]!.values.length === 0) {
      return undefined;
    }
    return rowToPromotion(result[0]!.values[0]!, result[0]!.columns);
  }

  function saveStatus(
    promotionId: string,
    status: PromotionStatus,
    decidedAt: string,
    rejectReason?: string,
  ): void {
    sqlite.run(
      `UPDATE behavior_promotion
       SET status = ?, decided_at = ?, reject_reason = ?
       WHERE promotion_id = ?`,
      [status, decidedAt, rejectReason ?? null, promotionId],
    );
  }

  return {
    async submitPromotion(input) {
      const now = new Date().toISOString();
      const expiresAt = new Date(
        Date.now() + DEFAULT_TTL_DAYS * 24 * 60 * 60 * 1000,
      ).toISOString();

      sqlite.run(
        `INSERT INTO behavior_promotion
         (promotion_id, behavior_kind, description, status,
          operator_id, submitted_at, expires_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          input.promotionId,
          input.behaviorKind,
          input.description,
          "candidate",
          input.operatorId ?? null,
          now,
          expiresAt,
        ],
      );

      return {
        promotionId: input.promotionId,
        behaviorKind: input.behaviorKind,
        description: input.description,
        status: "candidate",
        operatorId: input.operatorId,
        submittedAt: now,
        expiresAt,
      };
    },

    async approvePromotion(promotionId) {
      const rec = loadRecord(promotionId);
      if (!rec) {
        throw new Error(`promotion_not_found:${promotionId}`);
      }
      if (rec.status === "approved") {
        return rec; // idempotent
      }
      if (rec.status === "rejected" || rec.status === "expired") {
        throw new Error(
          `promotion_immutable:${promotionId}:${rec.status}`,
        );
      }
      const now = new Date().toISOString();
      saveStatus(promotionId, "approved", now);
      return { ...rec, status: "approved", decidedAt: now };
    },

    async rejectPromotion(promotionId, reason) {
      const rec = loadRecord(promotionId);
      if (!rec) {
        throw new Error(`promotion_not_found:${promotionId}`);
      }
      if (rec.status === "rejected") {
        return rec; // idempotent
      }
      if (rec.status === "approved" || rec.status === "expired") {
        throw new Error(
          `promotion_immutable:${promotionId}:${rec.status}`,
        );
      }
      const now = new Date().toISOString();
      saveStatus(promotionId, "rejected", now, reason);
      return { ...rec, status: "rejected", decidedAt: now, rejectReason: reason };
    },

    async loadPromotion(promotionId) {
      return loadRecord(promotionId);
    },

    async listPromotions(status) {
      let sql = `SELECT * FROM behavior_promotion`;
      const params: string[] = [];
      if (status) {
        sql += ` WHERE status = ?`;
        params.push(status);
      }
      sql += ` ORDER BY submitted_at DESC`;

      const result = sqlite.exec(sql, params);
      if (result.length === 0 || result[0]!.values.length === 0) {
        return [];
      }
      return result[0]!.values.map((row) =>
        rowToPromotion(row, result[0]!.columns),
      );
    },

    async expireStaleCandidates() {
      const now = new Date().toISOString();
      sqlite.run(
        `UPDATE behavior_promotion
         SET status = 'expired', decided_at = ?
         WHERE status = 'candidate' AND expires_at < ?`,
        [now, now],
      );
      // sql.js does not provide changes count easily; approximate via re-query
      const result = sqlite.exec(
        `SELECT COUNT(*) as cnt FROM behavior_promotion
         WHERE status = 'expired' AND decided_at = ?`,
        [now],
      );
      return (result[0]?.values[0]?.[0] as number) ?? 0;
    },
  };
}
