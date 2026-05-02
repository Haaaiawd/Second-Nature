import type { OperatorFallbackView } from "../../storage/fallback/operator-fallback-view.js";

export class OperatorFallbackNotFoundError extends Error {
  readonly code = "FALLBACK_NOT_FOUND" as const;
  constructor(readonly ref: string) {
    super(`No operator fallback artifact for ref: ${ref}`);
    this.name = "OperatorFallbackNotFoundError";
  }
}

export interface ShowOperatorFallbackReadModels {
  loadFallbackView(ref: string): Promise<OperatorFallbackView | null>;
}

/**
 * T1.2.2 — Operator-visible fallback: always `status: not_sent` (ADR-007), never sent/delivered.
 */
export async function showOperatorFallback(ref: string, readModels: ShowOperatorFallbackReadModels): Promise<OperatorFallbackView> {
  const view = await readModels.loadFallbackView(ref);
  if (!view) {
    throw new OperatorFallbackNotFoundError(ref.trim());
  }
  return {
    ...view,
    status: "not_sent",
  };
}
