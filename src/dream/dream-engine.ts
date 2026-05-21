/**
 * Dream Engine — orchestrates the hybrid memory consolidation pipeline.
 *
 * Pipeline: load inputs → consolidate (rules) → sample → redact →
 * optional model insights → merge → validate → write output + trace.
 *
 * Contract:
 * - Input store is never modified.
 * - Output is always candidate until validation passes and lifecycle port accepts it.
 * - Budget/redaction/timeout failures degrade gracefully with trace.
 * Test coverage: tests/integration/dream/t7-1-1-dream-pipeline.test.ts
 */

import type {
  DreamEngineInput,
  DreamRunResult,
  DreamOutput,
  DreamTrace,
  DreamOutputStatus,
  DreamMode,
} from "./types.js";
import { consolidateMemory } from "./memory-consolidator.js";
import { sampleDreamInput } from "./sampler.js";
import { redactDreamInput } from "./redaction-gate.js";
import { validateDreamOutput } from "./output-validator.js";

const DEFAULT_TIMEOUT_MS = 30 * 60 * 1000; // 30min
const DEFAULT_MAX_CANONICAL = 200;

export async function runDream(
  input: DreamEngineInput,
): Promise<DreamRunResult> {
  const startedAt = new Date().toISOString();
  const runId = input.runId;
  const traceId = input.traceId;
  const triggerKind = input.triggerKind;
  const options = input.options ?? {};
  const operatorTimeoutMs = options.operatorTimeoutMs ?? DEFAULT_TIMEOUT_MS;

  // ─── 1. Load inputs ────────────────────────────────────────────────────────
  const inputBundle = await input.statePort.loadDreamInputs({
    timeWindowDays: options.timeWindowDays ?? 30,
    evidenceLimit: options.evidenceLimit ?? 1000,
  });

  if (
    inputBundle.evidenceRefs.length === 0 &&
    inputBundle.chronicleEntryIds.length === 0 &&
    (inputBundle.inputCounts.memoryEntries ?? 0) === 0
  ) {
    const trace = buildTrace({
      traceId,
      runId,
      startedAt,
      inputCounts: inputBundle.inputCounts,
      fallbackReason: "no_inputs",
    });
    await input.tracePort?.recordDreamTrace(trace);
    return {
      runId,
      status: "skipped",
      trace,
      fallbackReason: "no_inputs",
    };
  }

  // ─── 2. Rules consolidate ──────────────────────────────────────────────────
  // For the rules stage we use placeholder summaries derived from refs.
  // Real integration would load actual summaries from state ports.
  const evidenceSummaries = inputBundle.evidenceRefs.map((ref, i) => ({
    id: ref,
    summary: `evidence:${ref}`,
    sourceRefs: [{ sourceId: ref, kind: "evidence", url: undefined }],
    createdAt: new Date().toISOString(),
  }));

  const chronicleSummaries = inputBundle.chronicleEntryIds.map((id) => ({
    id,
    summary: `chronicle:${id}`,
    sourceRefs: [{ sourceId: id, kind: "chronicle", url: undefined }],
    createdAt: new Date().toISOString(),
  }));

  const consolidation = consolidateMemory({
    evidenceSummaries,
    chronicleSummaries,
    existingEntries: [], // In real use, load from activeMemoryStoreId
  });

  // ─── 3. Sample ─────────────────────────────────────────────────────────────
  const sampling = sampleDreamInput({
    evidenceSummaries: evidenceSummaries.map((e) => ({
      id: e.id,
      summary: e.summary,
      createdAt: e.createdAt,
    })),
    chronicleSummaries: chronicleSummaries.map((c) => ({
      id: c.id,
      summary: c.summary,
      createdAt: c.createdAt,
    })),
    evidenceLimit: options.evidenceLimit,
  });

  // ─── 4. Redaction ──────────────────────────────────────────────────────────
  const redaction = redactDreamInput({
    evidenceSummaries: sampling.sampledEvidenceIds.map(
      (id) => evidenceSummaries.find((e) => e.id === id)?.summary ?? id,
    ),
    chronicleSummaries: sampling.sampledChronicleIds.map(
      (id) => chronicleSummaries.find((c) => c.id === id)?.summary ?? id,
    ),
  });

  if (!redaction.allowed) {
    const output = buildOutput({
      runId,
      inputMemoryStoreId: inputBundle.activeMemoryStoreId,
      canonicalEntries: consolidation.entries.slice(
        0,
        options.maxCanonicalEntries ?? DEFAULT_MAX_CANONICAL,
      ),
      insights: [],
      validation: {
        schemaValid: true,
        sourceGrounded: true,
        sensitivityClean: false,
        unsupportedClaims: [],
        errors: [redaction.blockedReason ?? "redaction_failed"],
        checkedAt: new Date().toISOString(),
      },
    });
    await input.statePort.writeDreamOutput(output);
    const trace = buildTrace({
      traceId,
      runId,
      startedAt,
      inputCounts: inputBundle.inputCounts,
      fallbackReason: redaction.blockedReason ?? "redaction_failed",
      sensitivityFailure: true,
    });
    await input.tracePort?.recordDreamTrace(trace);
    return {
      runId,
      status: "completed",
      output,
      trace,
      fallbackReason: redaction.blockedReason ?? "redaction_failed",
    };
  }

  // ─── 5. Budget gate ────────────────────────────────────────────────────────
  let modelResult:
    | {
        insights: import("./types.js").DreamInsight[];
        narrativeUpdate?: import("./types.js").DreamNarrativeUpdate;
        relationshipUpdate?: import("./types.js").DreamRelationshipUpdate;
        unsupportedClaims: string[];
        costUsd?: number;
      }
    | undefined;
  let mode: DreamMode = "rules_only";
  let fallbackReason: string | undefined;
  let llmCostUsd: number | undefined;

  if (input.modelPort && input.budgetPort) {
    const budgetCheck = await input.budgetPort.checkBudget(0.5);
    if (budgetCheck.allowed) {
      // ─── 6. Model insights ─────────────────────────────────────────────────
      try {
        const modelPromise = input.modelPort.extractInsights({
          sampledEvidence: redaction.redactedEvidence,
          chronicleSummary: redaction.redactedChronicle.join("\n"),
          redacted: true,
        });

        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(
            () => reject(new Error("model_timeout")),
            operatorTimeoutMs,
          );
        });

        modelResult = await Promise.race([modelPromise, timeoutPromise]);
        mode = "hybrid_llm";
        llmCostUsd = modelResult.costUsd;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes("timeout")) {
          fallbackReason = "model_timeout";
          mode = "model_skipped";
        } else {
          fallbackReason = "model_error";
          mode = "model_skipped";
        }
      }
    } else {
      fallbackReason = "budget_exceeded";
      mode = "rules_only";
    }
  } else {
    fallbackReason = "model_port_unavailable";
    mode = "rules_only";
  }

  // ─── 7. Merge ──────────────────────────────────────────────────────────────
  const canonicalEntries = consolidation.entries.slice(
    0,
    options.maxCanonicalEntries ?? DEFAULT_MAX_CANONICAL,
  );

  const insights = modelResult?.insights ?? [];

  const output = buildOutput({
    runId,
    inputMemoryStoreId: inputBundle.activeMemoryStoreId,
    canonicalEntries,
    insights,
    narrativeUpdate: modelResult?.narrativeUpdate,
    relationshipUpdate: modelResult?.relationshipUpdate,
    validation: {
      schemaValid: true,
      sourceGrounded: true,
      sensitivityClean: true,
      unsupportedClaims: modelResult?.unsupportedClaims ?? [],
      errors: [],
      checkedAt: new Date().toISOString(),
    },
  });

  // ─── 8. Validate ───────────────────────────────────────────────────────────
  const validation = validateDreamOutput({
    output,
    inputEvidenceIds: inputBundle.evidenceRefs,
    inputChronicleIds: inputBundle.chronicleEntryIds,
  });

  // Update output with validation result
  output.validation = validation.validation;

  let outputStatus: DreamOutputStatus = "candidate";
  if (!validation.eligible) {
    outputStatus = "archived";
    // If model failed but rules produced something, mark partial
    if (fallbackReason === "model_timeout") {
      outputStatus = "partial";
    }
  }
  output.status = outputStatus;

  // ─── 9. Write output + trace ───────────────────────────────────────────────
  await input.statePort.writeDreamOutput(output);

  const finishedAt = new Date().toISOString();
  const durationMs =
    new Date(finishedAt).getTime() - new Date(startedAt).getTime();

  const trace = buildTrace({
    traceId,
    runId,
    startedAt,
    finishedAt,
    durationMs,
    inputCounts: inputBundle.inputCounts,
    fallbackReason,
    llmCostUsd,
    validationErrors: validation.validation.errors,
    timeoutMs:
      fallbackReason === "model_timeout" ? operatorTimeoutMs : undefined,
    sensitivityFailure: false,
  });
  await input.tracePort?.recordDreamTrace(trace);

  return {
    runId,
    status: "completed",
    output,
    trace,
    fallbackReason,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildOutput(params: {
  runId: string;
  inputMemoryStoreId?: string;
  canonicalEntries: import("./types.js").DreamOutput["canonicalEntries"];
  insights: import("./types.js").DreamOutput["insights"];
  narrativeUpdate?: import("./types.js").DreamOutput["narrativeUpdate"];
  relationshipUpdate?: import("./types.js").DreamOutput["relationshipUpdate"];
  validation: import("./types.js").DreamOutput["validation"];
}): DreamOutput {
  return {
    outputId: `dream_output:${crypto.randomUUID()}`,
    runId: params.runId,
    status: "candidate",
    inputMemoryStoreId: params.inputMemoryStoreId,
    canonicalEntries: params.canonicalEntries,
    insights: params.insights,
    narrativeUpdate: params.narrativeUpdate,
    relationshipUpdate: params.relationshipUpdate,
    validation: params.validation,
  };
}

function buildTrace(params: {
  traceId: string;
  runId: string;
  startedAt: string;
  finishedAt?: string;
  durationMs?: number;
  inputCounts: import("./types.js").DreamInputBundle["inputCounts"];
  fallbackReason?: string;
  llmCostUsd?: number;
  validationErrors?: string[];
  timeoutMs?: number;
  sensitivityFailure?: boolean;
}): DreamTrace {
  return {
    traceId: params.traceId,
    runId: params.runId,
    startedAt: params.startedAt,
    finishedAt: params.finishedAt ?? params.startedAt,
    durationMs: params.durationMs ?? 0,
    inputCounts: params.inputCounts,
    fallbackReason: params.fallbackReason,
    llmCostUsd: params.llmCostUsd,
    validationErrors: params.validationErrors,
    timeoutMs: params.timeoutMs,
    sensitivityFailure: params.sensitivityFailure,
  };
}
