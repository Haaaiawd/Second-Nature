import { eq } from "drizzle-orm";
import { proposalRecords } from "../db/schema/index.js";
export class ProposalRepository {
    database;
    constructor(database) {
        this.database = database;
    }
    async create(record) {
        await this.database.db.insert(proposalRecords).values(record);
    }
    async findById(id) {
        return this.database.db.query.proposalRecords.findFirst({
            where: eq(proposalRecords.id, id),
        });
    }
    async updateStatus(id, status, afterHash) {
        await this.database.db
            .update(proposalRecords)
            .set({
            status,
            afterHash: afterHash ?? undefined,
            appliedAt: status === "applied" ? new Date().toISOString() : undefined,
        })
            .where(eq(proposalRecords.id, id));
    }
}
