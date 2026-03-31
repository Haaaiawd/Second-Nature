import { eq } from "drizzle-orm";
import { provenanceEdges } from "../db/schema/index.js";
export class ProvenanceRepository {
    database;
    constructor(database) {
        this.database = database;
    }
    async create(record) {
        await this.database.db.insert(provenanceEdges).values(record);
    }
    async listByTarget(toId) {
        return this.database.db.select().from(provenanceEdges).where(eq(provenanceEdges.toId, toId));
    }
    async linkEntrySources(entryId, sourceRefs) {
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
    async traceAsset(assetId) {
        const edges = await this.listByTarget(assetId);
        const upstreamSources = edges.filter((e) => e.kind === "source").map((e) => e.fromId);
        const proposalIds = edges.filter((e) => e.kind === "proposal").map((e) => e.fromId);
        const applyIds = edges.filter((e) => e.kind === "apply").map((e) => e.fromId);
        return { assetId, upstreamSources, proposalIds, applyIds };
    }
    async recordApply(proposalId, assetId, info) {
        await this.create({
            id: `apply:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`,
            fromId: proposalId,
            toId: assetId,
            kind: "apply",
            createdAt: new Date().toISOString(),
        });
    }
}
