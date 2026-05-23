/**
 * Quiet system barrel — T-DQS.C.1 exports
 */

export {
  createEvidenceAggregator,
  createClaimDeduplicator,
  createClaimSynthesizer,
  createSourceValidator,
  type EvidenceSlice,
  type ClaimSynthesisResult,
  type EvidenceAggregator,
  type ClaimDeduplicator,
  type ClaimSynthesizer,
  type SourceValidator,
} from "./claim-synthesizer.js";

export {
  createDailyDiaryWriter,
  type DailyDiaryResult,
  type DailyDiaryWriter,
} from "./daily-diary-writer.js";
