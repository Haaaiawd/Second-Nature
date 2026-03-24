import { eq } from "drizzle-orm";

import type { StateDatabase } from "../db/index.js";
import { provenanceEdges, type NewProvenanceEdgeRecord, type ProvenanceEdgeRecord } from "../db/schema/index.js";

export class ProvenanceRepository {
  constructor(private readonly database: StateDatabase) {}

  async create(record: NewProvenanceEdgeRecord): Promise<void> {
    await this.database.db.insert(provenanceEdges).values(record);
  }

  async listByTarget(toId: string): Promise<ProvenanceEdgeRecord[]> {
    return this.database.db.select().from(provenanceEdges).where(eq(provenanceEdges.toId, toId));
  }

  async linkEntrySources(entryId: string, sourceRefs: string[]): Promise<void> {
    for (const sourceId of sourceRefs) {
      await this.create({
        id: `prov:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`,
        fromId: sourceId,
        toId: entryId,
        kind: "source",
        createdAt: new Date().toISOString(),
      });
    }
  }

  async traceAsset(assetId: string): Promise<{ assetId: string; upstreamSources: string[]; proposalIds: string[]; applyIds: string[] }> {
    const edges = await this.listByTarget(assetId);
    const upstreamSources = edges.filter((e) => e.kind === "source").map((e) => e.fromId);
    const proposalIds = edges.filter((e) => e.kind === "proposal").map((e) => e.fromId);
    const applyIds = edges.filter((e) => e.kind === "apply").map((e) => e.fromId);

    return { assetId, upstreamSources, proposalIds, applyIds };
  }

  async recordApply(proposalId: string, assetId: string, info: { beforeHash: string; afterHash: string; diff: string }): Promise<void> {
    await this.create({
      id: `apply:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`,
      fromId: proposalId,
      toId: assetId,
      kind: "apply",
      createdAt: new Date().toISOString(),
    });
  }
}
