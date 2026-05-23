/**
 * Dream System public API.
 */
export * from "./types.js";
export { consolidateMemory } from "./memory-consolidator.js";
export { sampleDreamInput } from "./sampler.js";
export { redactDreamInput, redactBundle } from "./redaction-gate.js";
export { validateDreamOutput } from "./output-validator.js";
export { runDream } from "./dream-engine.js";
export { scheduleDream, shouldTrigger, memoryLockPort } from "./dream-scheduler.js";
export type { SchedulerInput, DreamRunLockPort, ScheduleResult, CronPolicy, EvidenceThresholdPolicy, ManualPolicy, QuietCompletionPolicy, TriggerPolicy } from "./dream-scheduler.js";
export { extractInsights } from "./insight-extractor.js";
export { draftNarrativeFromDream } from "./narrative-update-proposal.js";
export { draftRelationshipFromDream } from "./relationship-update-proposal.js";
export { createDreamInputLoader } from "./dream-input-loader.js";
export type { DreamInputLoaderOptions } from "./dream-input-loader.js";
