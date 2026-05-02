/**
 * Maps T5.3.1 operator explain query results into CLI ExplainReadModel (T1.2.1).
 */
import type { OperatorExplainReadModel } from "../../observability/query/explain-query.js";
import type { ExplainReadModel, ExplainSubjectKind } from "./types.js";
export declare function mapOperatorExplainToReadModel(op: OperatorExplainReadModel, subjectKind: ExplainSubjectKind): ExplainReadModel;
