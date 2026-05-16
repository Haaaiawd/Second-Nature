/**
 * Dream System public API.
 */
export * from "./types.js";
export { consolidateMemory } from "./memory-consolidator.js";
export { sampleDreamInput } from "./sampler.js";
export { redactDreamInput } from "./redaction-gate.js";
export { validateDreamOutput } from "./output-validator.js";
export { runDream } from "./dream-engine.js";
