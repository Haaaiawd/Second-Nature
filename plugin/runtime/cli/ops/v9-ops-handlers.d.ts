/**
 * v9 Ops Command Handlers (T1.2.1).
 *
 * Implements v9 ops command surface with JSON-first RuntimeOpsEnvelopeV9.
 *
 * Commands:
 * - continuity.read: SelfContinuityCard + CharacterFrameProjection
 * - routine.list: list routines with filter
 * - routine.show: show single routine
 * - routine.rollback: rollback routine (delegates to body-connector)
 * - connector_evolution.status: list evolution plans
 * - connector_evolution.trigger: trigger gate chain (delegates)
 * - connector_evolution.rollback: rollback connector version (delegates)
 * - loop_status.read: v9 loop status with activity health
 *
 * Design authority:
 * - `.anws/v9/04_SYSTEM_DESIGN/runtime-ops-system.md §5.1`
 * - `.anws/v9/04_SYSTEM_DESIGN/runtime-ops-system.detail.md §1-§5`
 * - `shared-v9-contracts.md §8`
 *
 * Dependencies:
 * - `src/shared/types/v9-contracts.js` (RuntimeOpsEnvelopeV9, ContinuityReadResult, etc.)
 * - `src/storage/v9-state-stores.js` (readToolRoutinesByStatus, readConnectorEvolutionPlansByStatus)
 * - `src/core/second-nature/memory/self-continuity-card-assembler.js` (createContinuityReadPort)
 * - `src/observability/v9-loop-health-aggregator.js` (aggregateLoopStatus)
 *
 * Boundary:
 * - Pure dispatch functions with injectable deps.
 * - All output wrapped in RuntimeOpsEnvelopeV9 with evidenceLevel + degradedReasons.
 * - Carrier mode returns honest degradation (§4.1).
 * - No raw credential/private/prompt in output (§3.3 redaction — T1.2.2).
 *
 * Test coverage: `tests/api/runtime-ops/v9-ops-surface.test.ts`
 */
import type { RuntimeOpsEnvelopeV9, SurfaceMode, ContinuityReadResult, RoutineReadModel, ConnectorEvolutionStatusReadModel } from "../../shared/types/v9-contracts.js";
import type { StateDatabase } from "../../storage/db/index.js";
import { type LoopStatusResult, type LoopStatusInputs } from "../../observability/v9-loop-health-aggregator.js";
export interface V9OpsHandlerDeps {
    state?: StateDatabase;
    workspaceRoot?: string;
    /** Surface mode: carrier (plugin schema only) vs full_runtime (CLI) vs workspace_full_runtime (plugin with deps). */
    surfaceMode: SurfaceMode;
    /** Injected clock for testing. */
    now?: () => Date;
    /** Loop status inputs provider (for loop_status.read). */
    loopStatusInputsProvider?: () => Promise<LoopStatusInputs>;
}
export declare function handleContinuityRead(deps: V9OpsHandlerDeps, input: {
    workspaceRoot?: string;
} | undefined): Promise<RuntimeOpsEnvelopeV9<ContinuityReadResult>>;
export declare function handleRoutineList(deps: V9OpsHandlerDeps, input: {
    workspaceRoot?: string;
    status?: ("installed" | "disabled" | "rollback")[];
    capabilityPattern?: string;
} | undefined): Promise<RuntimeOpsEnvelopeV9<RoutineReadModel[]>>;
export declare function handleRoutineShow(deps: V9OpsHandlerDeps, input: {
    workspaceRoot?: string;
    routineId?: string;
} | undefined): Promise<RuntimeOpsEnvelopeV9<RoutineReadModel | null>>;
export declare function handleRoutineRollback(deps: V9OpsHandlerDeps, input: {
    workspaceRoot?: string;
    routineId?: string;
} | undefined): Promise<RuntimeOpsEnvelopeV9<{
    rolledBack: boolean;
    rollbackRef?: string;
}>>;
export declare function handleConnectorEvolutionStatus(deps: V9OpsHandlerDeps, input: {
    workspaceRoot?: string;
    platformId?: string;
} | undefined): Promise<RuntimeOpsEnvelopeV9<ConnectorEvolutionStatusReadModel[]>>;
export declare function handleConnectorEvolutionTrigger(deps: V9OpsHandlerDeps, input: {
    workspaceRoot?: string;
    planId?: string;
} | undefined): Promise<RuntimeOpsEnvelopeV9<{
    triggered: boolean;
    planId?: string;
}>>;
export declare function handleConnectorEvolutionRollback(deps: V9OpsHandlerDeps, input: {
    workspaceRoot?: string;
    planId?: string;
} | undefined): Promise<RuntimeOpsEnvelopeV9<{
    rolledBack: boolean;
    planId?: string;
}>>;
export declare function handleLoopStatusRead(deps: V9OpsHandlerDeps, input: {
    workspaceRoot?: string;
} | undefined): Promise<RuntimeOpsEnvelopeV9<LoopStatusResult>>;
export declare function dispatchV9OpsCommand(deps: V9OpsHandlerDeps, command: string, input: Record<string, unknown> | undefined): Promise<RuntimeOpsEnvelopeV9>;
