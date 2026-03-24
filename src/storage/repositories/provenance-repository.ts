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
}
