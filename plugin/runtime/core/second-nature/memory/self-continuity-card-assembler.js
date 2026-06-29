/**
 * SelfContinuityCardAssembler — Build bounded `SelfContinuityCard` from active
 * memory projections, procedural projections, routines, and CharacterFrame pointer.
 *
 * Core logic:
 * - Read active projections/routines and accepted CharacterFrame pointer.
 * - Assemble canonical section ordering per shared-v9-contracts.md §4.
 * - Serialize to bounded `cardText` (≤1200 UTF-8 bytes), preserving summary
 *   and characterFramePointer under truncation.
 * - Persist the card via `writeSelfContinuityCard` and return runtime shape.
 *
 * Design authority:
 * - `.anws/v9/04_SYSTEM_DESIGN/memory-continuity-system.md §5.1`
 * - `.anws/v9/04_SYSTEM_DESIGN/memory-continuity-system.detail.md §3.7`
 * - `.anws/v9/04_SYSTEM_DESIGN/shared-v9-contracts.md §4`
 * - `.anws/v9/04_SYSTEM_DESIGN/control-context-system.detail.md §2.2 / §3.4`
 *
 * Dependencies:
 * - `src/shared/types/v9-contracts.js`
 * - `src/storage/v9-state-stores.js` (procedural/tool_routine/self_continuity_card)
 * - `src/storage/v8-state-stores.js` (memory projections)
 * - `src/core/second-nature/character/character-frame-lifecycle.js` (pointer loader)
 *
 * Boundary:
 * - Rules-only assembly; no LLM summarization.
 * - Returns `continuity_unavailable` degraded result when no active data.
 * - CharacterFrame full projection is NOT included; only short pointer.
 * - All source refs deduplicated and carried for traceability.
 *
 * Test coverage:
 * - `tests/unit/memory/v9-self-continuity-card.test.ts`
 * - `tests/integration/v9/self-continuity-card-read.test.ts`
 */
import { randomUUID } from "node:crypto";
import { redactPayload } from "../../../observability/redaction/policy.js";
import { readToolRoutinesByStatus, readProceduralProjectionsByStatus, readLatestSelfContinuityCard, writeSelfContinuityCard, readCharacterFrameById, readLatestAcceptedCharacterFrame, readCharacterFrameRevisionCandidates, updateCharacterFrameStatus, } from "../../../storage/v9-state-stores.js";
import { readMemoryProjectionsByStatus } from "../../../storage/v8-state-stores.js";
import { loadActiveCharacterFrame, } from "../character/character-frame-lifecycle.js";
// ───────────────────────────────────────────────────────────────
// Constants
// ───────────────────────────────────────────────────────────────
const SELF_CONTINUITY_CARD_MAX_CHARS = 1200;
const SUMMARY_MAX_CHARS = 120;
const BODY_INTUITION_MAX_CHARS = 200;
const POSTURE_MAX_CHARS = 200;
const HABIT_MAX_CHARS = 120;
const SELF_CONTINUITY_CARD_MAX_BYTES = 4000; // hard ceiling for raw storage
const SENSITIVE_VALUE_PATTERNS = [
    {
        pattern: /[A-Za-z0-9_\-]{32,}/g, // long API keys / tokens
        shouldRedact: (match) => !UUID_PATTERN.test(match),
    },
    {
        pattern: /\b(sk|pk|bearer)\s*[=_:\s]+\s*[^\s\n]{8,}/gi, // sk-xxx / bearer xxx
        shouldRedact: () => true,
    },
    {
        pattern: /\b(password|secret|token)\s*[=_:\s]+\s*[^\s\n]{4,}/gi,
        shouldRedact: () => true,
    },
    {
        pattern: /sk-[A-Za-z0-9]{16,}/g, // openai-style secret key
        shouldRedact: () => true,
    },
];
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function scanForSensitiveValues(text) {
    return SENSITIVE_VALUE_PATTERNS.some(({ pattern, shouldRedact }) => {
        pattern.lastIndex = 0;
        let match;
        while ((match = pattern.exec(text)) !== null) {
            if (shouldRedact(match[0]))
                return true;
        }
        return false;
    });
}
function redactSensitiveInline(text) {
    let redacted = text;
    for (const { pattern, shouldRedact } of SENSITIVE_VALUE_PATTERNS) {
        pattern.lastIndex = 0;
        redacted = redacted.replace(pattern, (match) => {
            if (!shouldRedact(match))
                return match;
            const visible = Math.min(4, Math.floor(match.length / 4));
            return match.slice(0, visible) + "…[REDACTED]";
        });
    }
    return redacted;
}
const CANONICAL_SECTION_ORDER = [
    "summary",
    "bodyIntuition",
    "relationshipPosture",
    "valuePosture",
    "behaviorHabits",
    "activeRoutinePointers",
    "currentProhibitions",
];
// ───────────────────────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────────────────────
function countUtf8Bytes(text) {
    return new TextEncoder().encode(text).length;
}
export function countChars(text) {
    // Conservative character count using Array.from to handle surrogate pairs.
    return Array.from(text).length;
}
export function truncateToChars(text, maxChars) {
    if (countChars(text) <= maxChars)
        return text;
    const chars = Array.from(text);
    const ellipsis = "…";
    // Reserve room for ellipsis if maxChars allows; otherwise truncate without it.
    if (maxChars <= ellipsis.length)
        return chars.slice(0, maxChars).join("");
    return chars.slice(0, maxChars - Array.from(ellipsis).length).join("") + ellipsis;
}
function deduplicateSourceRefs(refs) {
    const seen = new Set();
    return refs.filter((ref) => {
        const key = `${ref.family}:${ref.id}`;
        if (seen.has(key))
            return false;
        seen.add(key);
        return true;
    });
}
function toRoutinePointer(routine) {
    return {
        routineId: routine.routineId,
        capabilityPattern: routine.capabilityPattern,
        version: routine.version,
        sourceRefs: routine.sourceRefs,
    };
}
function toMemoryProjection(row) {
    return {
        id: row.id,
        kind: "memory",
        sourceRefs: parseSourceRefs(row.sourceRefsJson),
    };
}
function toProceduralProjection(row) {
    return {
        id: row.id,
        kind: "procedural",
        sourceRefs: parseSourceRefs(row.sourceRefsJson),
    };
}
function parseSourceRefs(json) {
    if (!json)
        return [];
    try {
        const parsed = JSON.parse(json);
        if (Array.isArray(parsed))
            return parsed;
        return [];
    }
    catch {
        return [];
    }
}
function makeDegraded(reason, operatorNextAction) {
    return {
        status: "unavailable",
        reason: reason,
        ownerStage: "projection",
        sourceRefs: [],
        operatorNextAction,
        retryable: true,
    };
}
function toToolRoutine(row) {
    const payload = row.payloadJson ? JSON.parse(row.payloadJson) : {};
    return {
        id: row.id,
        routineId: row.id,
        name: row.name,
        version: row.version,
        capabilityPattern: row.capabilityPattern,
        triggerCapabilities: [],
        triggerConditionsJson: JSON.stringify(payload.triggerConditions ?? {}),
        stepsJson: JSON.stringify(payload.steps ?? []),
        guardSchemaJson: row.guardRefsJson ?? "{}",
        rollbackRef: row.rollbackRef ?? "",
        status: row.status,
        sourceRefs: parseSourceRefs(row.sourceRefsJson),
        createdAt: row.createdAt,
        activatedAt: row.activatedAt ?? undefined,
        retiredAt: row.retiredAt ?? undefined,
    };
}
function toRoutinePointerFromRecord(row) {
    return {
        routineId: row.id,
        capabilityPattern: row.capabilityPattern,
        version: row.version,
        sourceRefs: parseSourceRefs(row.sourceRefsJson),
    };
}
// ───────────────────────────────────────────────────────────────
// Section builders
// ───────────────────────────────────────────────────────────────
function buildSummary(memories) {
    if (memories.length === 0)
        return "continuity summary: no active memory projections";
    return `continuity summary: ${memories.length} active memory projection(s)`;
}
function buildBodyIntuition(memories, procedurals) {
    const parts = [];
    if (memories.length > 0)
        parts.push("memory patterns available");
    if (procedurals.length > 0)
        parts.push(`${procedurals.length} procedural routine pattern(s)`);
    if (parts.length === 0)
        return "body intuition: no learned patterns yet";
    return `body intuition: ${parts.join("; ")}`;
}
function buildRelationshipPosture(memories) {
    if (memories.length === 0)
        return "relationship posture: observation-oriented, awaiting owner signals";
    return "relationship posture: responsive and observation-oriented";
}
function buildValuePosture(memories) {
    if (memories.length === 0)
        return "value posture: continuity over assertion";
    return "value posture: source-backed, contestable";
}
function buildBehaviorHabits(routines) {
    if (routines.length === 0)
        return ["behavior habits: no active routines"];
    return routines.slice(0, 5).map((r) => truncateToChars(`${r.capabilityPattern} (${r.status})`, HABIT_MAX_CHARS));
}
function buildCurrentProhibitions() {
    return [
        "do not claim emotion as fact",
        "do not execute external write without owner consent",
    ];
}
function buildCardSections(memories, procedurals, routines, characterPointer) {
    return {
        summary: truncateToChars(buildSummary(memories), SUMMARY_MAX_CHARS),
        bodyIntuition: truncateToChars(buildBodyIntuition(memories, procedurals), BODY_INTUITION_MAX_CHARS),
        relationshipPosture: truncateToChars(buildRelationshipPosture(memories), POSTURE_MAX_CHARS),
        valuePosture: truncateToChars(buildValuePosture(memories), POSTURE_MAX_CHARS),
        behaviorHabits: buildBehaviorHabits(routines),
        activeRoutinePointers: routines.map(toRoutinePointer),
        currentProhibitions: buildCurrentProhibitions(),
    };
}
function serializeCardSections(sections) {
    const lines = [];
    lines.push(`Summary: ${sections.summary}`);
    lines.push(`Body intuition: ${sections.bodyIntuition}`);
    lines.push(`Relationship: ${sections.relationshipPosture}`);
    lines.push(`Values: ${sections.valuePosture}`);
    lines.push(`Habits:`);
    for (const habit of sections.behaviorHabits) {
        lines.push(`  - ${habit}`);
    }
    if (sections.activeRoutinePointers.length > 0) {
        lines.push(`Active routines:`);
        for (const r of sections.activeRoutinePointers) {
            lines.push(`  - ${r.routineId}: ${r.capabilityPattern}@${r.version}`);
        }
    }
    if (sections.currentProhibitions.length > 0) {
        lines.push(`Prohibitions:`);
        for (const p of sections.currentProhibitions) {
            lines.push(`  - ${p}`);
        }
    }
    return lines.join("\n");
}
function applyCardBudget(sections, characterPointer, maxChars, maxBytes) {
    const pointerJson = JSON.stringify(characterPointer);
    const pointerPrefix = `[character frame pointer]\n`;
    const pointerChars = countChars(pointerPrefix) + countChars(pointerJson);
    const pointerBytes = countUtf8Bytes(pointerPrefix) + countUtf8Bytes(pointerJson);
    let fullText = serializeCardSections(sections);
    const fullChars = countChars(fullText) + pointerChars;
    const fullBytes = countUtf8Bytes(fullText) + pointerBytes;
    if (fullChars <= maxChars && fullBytes <= maxBytes) {
        return { cardText: fullText + "\n" + pointerPrefix + pointerJson, sections };
    }
    // Truncate lower-priority sections while preserving summary and pointer.
    const charBudget = maxChars - countChars(pointerPrefix) - countChars(pointerJson);
    const trimmed = {
        ...sections,
        behaviorHabits: sections.behaviorHabits.slice(0, 3).map((h) => truncateToChars(h, HABIT_MAX_CHARS)),
        activeRoutinePointers: sections.activeRoutinePointers.slice(0, 3),
        currentProhibitions: sections.currentProhibitions.slice(0, 1),
    };
    let trimmedText = serializeCardSections(trimmed);
    if (countChars(trimmedText) > charBudget) {
        trimmedText = truncateToChars(trimmedText, charBudget);
    }
    return { cardText: trimmedText + "\n" + pointerPrefix + pointerJson, sections: trimmed };
}
function collectSourceRefs(memories, procedurals, routines, characterPointer) {
    return deduplicateSourceRefs([
        ...memories.flatMap((m) => m.sourceRefs),
        ...procedurals.flatMap((p) => p.sourceRefs),
        ...routines.flatMap((r) => r.sourceRefs),
        ...characterPointer.sourceRefs,
    ]);
}
// ───────────────────────────────────────────────────────────────
// CharacterFrame store adapter
// ───────────────────────────────────────────────────────────────
export function createCharacterFrameStoreAdapter(db) {
    return {
        async readFrameById(id) {
            const row = await readCharacterFrameById(db, id);
            return row ? rowToFrame(row) : null;
        },
        async readLatestAcceptedFrame() {
            const result = await readLatestAcceptedCharacterFrame(db);
            return result.row ? rowToFrame(result.row) : null;
        },
        async readPendingRevisionFor(frameId) {
            const result = await readCharacterFrameRevisionCandidates(db, frameId);
            return result.rows[0] ? rowToFrame(result.rows[0]) : null;
        },
        async writeCandidateFrame() {
            throw new Error("character_frame_write_not_allowed_in_continuity_assembly");
        },
        async updateFrameLifecycle(frameId, status, opts) {
            await updateCharacterFrameStatus(db, frameId, status, opts);
        },
    };
}
function rowToFrame(row) {
    const sections = JSON.parse(row.sectionsJson);
    return {
        ...row,
        status: row.status,
        acceptedAt: row.acceptedAt ?? undefined,
        projectionKind: "character_frame",
        sourceRefs: parseSourceRefs(row.sourceRefsJson),
        emergentHabits: sections.emergentHabits,
        valuePosture: sections.valuePosture,
        relationshipPosture: sections.relationshipPosture,
        expressionPosture: sections.expressionPosture,
        growthTensions: sections.growthTensions,
        conflictNotes: sections.conflictNotes,
        payloadJson: row.payloadJson ?? undefined,
    };
}
export async function assembleSelfContinuityCard(db, scope) {
    const now = scope.now ?? new Date().toISOString();
    const maxChars = SELF_CONTINUITY_CARD_MAX_CHARS;
    const maxBytes = SELF_CONTINUITY_CARD_MAX_BYTES;
    const [memoryRead, proceduralRead, routineRead] = await Promise.all([
        readMemoryProjectionsByStatus(db, "active"),
        readProceduralProjectionsByStatus(db, "installed"),
        readToolRoutinesByStatus(db, "active"),
    ]);
    if (memoryRead.degraded)
        return memoryRead.degraded;
    if (proceduralRead.degraded)
        return proceduralRead.degraded;
    if (routineRead.degraded)
        return routineRead.degraded;
    const memories = memoryRead.rows.map(toMemoryProjection);
    const procedurals = proceduralRead.rows.map(toProceduralProjection);
    const routines = routineRead.rows.map(toToolRoutine);
    const characterStore = await createCharacterFrameStoreAdapter(db);
    const characterResult = await loadActiveCharacterFrame(characterStore, { now, isFirstInjection: false });
    // If no active data at all, return unavailable.
    if (memories.length === 0 &&
        procedurals.length === 0 &&
        routines.length === 0 &&
        !characterResult.frame) {
        return makeDegraded("continuity_unavailable", "No active continuity projections or routines");
    }
    const deferredPointer = {
        frameId: "deferred",
        summary: "character frame deferred",
        contestPrompt: "",
        sourceRefs: [],
        status: "deferred",
    };
    const characterPointer = characterResult.pointer ?? deferredPointer;
    const sections = buildCardSections(memories, procedurals, routines, characterPointer);
    const { cardText, sections: budgetedSections } = applyCardBudget(sections, characterPointer, maxChars, maxBytes);
    const sourceRefs = collectSourceRefs(memories, procedurals, routines, characterPointer);
    const cardId = randomUUID();
    const redactedCardText = redactSensitiveInline(cardText);
    const hasSensitiveValues = scanForSensitiveValues(cardText);
    const redactedSectionsJson = JSON.stringify(redactPayload(budgetedSections).payload);
    const persisted = await writeSelfContinuityCard(db, {
        id: cardId,
        createdAt: now,
        cardText: redactedCardText,
        sectionsJson: typeof redactedSectionsJson === "string" ? redactedSectionsJson : JSON.stringify(budgetedSections),
        sourceRefs,
        characterFramePointerJson: JSON.stringify(characterPointer),
        status: "active",
        redactionClass: hasSensitiveValues ? "redacted" : "none",
    });
    if (!persisted) {
        return makeDegraded("state_unreadable", "Failed to persist SelfContinuityCard");
    }
    const card = {
        id: cardId,
        summary: budgetedSections.summary,
        bodyIntuition: budgetedSections.bodyIntuition,
        relationshipPosture: budgetedSections.relationshipPosture,
        valuePosture: budgetedSections.valuePosture,
        behaviorHabits: budgetedSections.behaviorHabits,
        activeRoutinePointers: budgetedSections.activeRoutinePointers,
        currentProhibitions: budgetedSections.currentProhibitions,
        characterFramePointer: characterPointer,
        sourceRefs,
        acceptedAt: now,
        status: "active",
        redactionClass: hasSensitiveValues ? "redacted" : "none",
    };
    return { card, persistedId: cardId };
}
// ───────────────────────────────────────────────────────────────
// ContinuityReadPort implementation
// ───────────────────────────────────────────────────────────────
export function createContinuityReadPort(db) {
    return {
        async loadSelfContinuityCard(scope) {
            const latest = await readLatestSelfContinuityCard(db);
            if (latest.degraded)
                return latest.degraded;
            if (!latest.row || latest.row.status !== "active") {
                const assembled = await assembleSelfContinuityCard(db, scope);
                if ("card" in assembled)
                    return assembled.card;
                return assembled;
            }
            return rowToCard(latest.row);
        },
        async loadRoutineList(filters) {
            const status = filters.status ?? ["installed"];
            // Map ops status to registry status.
            const registryStatuses = status.flatMap((s) => {
                if (s === "installed")
                    return ["active"];
                if (s === "disabled")
                    return ["candidate", "validated"];
                if (s === "rollback")
                    return ["retired"];
                return [];
            });
            const all = [];
            for (const st of registryStatuses) {
                const { rows, degraded } = await readToolRoutinesByStatus(db, st);
                if (degraded)
                    return { routines: [], degraded };
                if (filters.capabilityPattern) {
                    all.push(...rows.filter((r) => r.capabilityPattern === filters.capabilityPattern));
                }
                else {
                    all.push(...rows);
                }
            }
            const routines = all.map((r) => ({
                routineId: r.id,
                capabilityPattern: r.capabilityPattern,
                status: mapRoutineStatus(r.status),
                version: r.version,
                sourceRefs: parseSourceRefs(r.sourceRefsJson),
                rollbackRef: r.rollbackRef ? { family: "routine", id: r.rollbackRef } : undefined,
            }));
            return { routines };
        },
        async loadActiveMemoryProjections() {
            const { rows, degraded } = await readMemoryProjectionsByStatus(db, "active");
            if (degraded)
                return { projections: [], degraded };
            return { projections: rows.map(toMemoryProjection) };
        },
        async loadActiveProceduralProjections() {
            const { rows, degraded } = await readProceduralProjectionsByStatus(db, "installed");
            if (degraded)
                return { projections: [], degraded };
            return { projections: rows.map(toProceduralProjection) };
        },
        async loadActiveCharacterFramePointer(scope) {
            const characterStore = await createCharacterFrameStoreAdapter(db);
            const result = await loadActiveCharacterFrame(characterStore, { now: scope.now, isFirstInjection: false });
            return { pointer: result.pointer };
        },
    };
}
function rowToCard(row) {
    const sections = JSON.parse(row.sectionsJson);
    return {
        id: row.id,
        summary: sections.summary,
        bodyIntuition: sections.bodyIntuition,
        relationshipPosture: sections.relationshipPosture,
        valuePosture: sections.valuePosture,
        behaviorHabits: sections.behaviorHabits,
        activeRoutinePointers: sections.activeRoutinePointers,
        currentProhibitions: sections.currentProhibitions,
        characterFramePointer: JSON.parse(row.characterFramePointerJson),
        sourceRefs: parseSourceRefs(row.sourceRefsJson),
        acceptedAt: row.createdAt,
        status: row.status,
        redactionClass: row.redactionClass ?? "none",
    };
}
function mapRoutineStatus(status) {
    if (status === "active")
        return "installed";
    if (status === "retired")
        return "rollback";
    return "disabled";
}
