/**
 * CharacterFrameBuilder — Build a source-backed, contestable CharacterFrame
 * from normalized CharacterRefreshInput.
 *
 * Core logic: aggregate five postures from CharacterSignals, validate with
 * FrameSourceValidator, auto-supersede previous accepted frame, and mark the
 * new frame accepted with newlyProposed metadata.
 *
 * Design authority:
 * - `.anws/v9/04_SYSTEM_DESIGN/character-continuity-system.md §5.1`
 * - `.anws/v9/04_SYSTEM_DESIGN/character-continuity-system.detail.md §3.1 §3.3 §3.5`
 * - `.anws/v9/04_SYSTEM_DESIGN/shared-v9-contracts.md §5`
 *
 * Dependencies:
 * - `src/shared/types/v9-contracts.js`
 * - `src/core/second-nature/character/frame-source-validator.js`
 *
 * Boundary:
 * - No LLM-based personality inference; rules-only aggregation and summarization.
 * - Returns deferred result if validation fails or sources are insufficient.
 * - Auto-accepts validated frames but leaves first-injection contestability to
 *   the projection adapter (T7.2.2).
 *
 * Test coverage: tests/unit/character/v9-character-frame-builder.test.ts
 */
import { randomUUID } from "node:crypto";
import { FrameSourceValidator } from "./frame-source-validator.js";
// ───────────────────────────────────────────────────────────────
// Constants
// ───────────────────────────────────────────────────────────────
const CHARACTER_FRAME_MAX_CHARS = 900;
const CHARACTER_POINTER_SUMMARY_MAX_CHARS = 200;
const CONTEST_PROMPT_MAX_CHARS = 300;
const MAX_HABITS = 10;
const MAX_TENSIONS = 5;
const CONTEST_PROMPT_ZH = "以下内容是 Second Nature 根据你的过往互动压缩出的可反驳投影，你可接受、拒绝、改写或要求退役；它不代表你的真实情绪或永久人格。";
const CONTEST_PROMPT_EN = "This is a contestable projection compressed from your past interactions. You may accept, reject, revise, or retire it. It does not claim to fully reflect your real emotions or permanent identity.";
// ───────────────────────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────────────────────
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
function truncateToBytes(text, maxBytes) {
    if (countUtf8Chars(text) <= maxBytes)
        return text;
    const ellipsis = "…";
    const ellipsisBytes = countUtf8Chars(ellipsis);
    let low = 0;
    let high = text.length;
    while (low < high) {
        const mid = Math.ceil((low + high) / 2);
        if (countUtf8Chars(text.slice(0, mid)) + ellipsisBytes <= maxBytes) {
            low = mid;
        }
        else {
            high = mid - 1;
        }
    }
    return text.slice(0, low) + ellipsis;
}
function truncateToChars(text, max) {
    return truncateToBytes(text, max);
}
function countUtf8Chars(text) {
    return new TextEncoder().encode(text).length;
}
function selectLocalePrompt(locale) {
    if (locale === "zh-CN")
        return CONTEST_PROMPT_ZH;
    if (locale === "en")
        return CONTEST_PROMPT_EN;
    return `${CONTEST_PROMPT_ZH} / ${CONTEST_PROMPT_EN}`;
}
function groupBySignalKind(signals) {
    return signals.reduce((acc, signal) => {
        (acc[signal.signalKind] ??= []).push(signal);
        return acc;
    }, {});
}
function confidenceFromSignals(signals) {
    if (signals.length === 0)
        return "low";
    const highs = signals.filter((s) => s.confidence === "high").length;
    const mediums = signals.filter((s) => s.confidence === "medium").length;
    if (highs > mediums)
        return "high";
    if (mediums >= 1)
        return "medium";
    return "low";
}
function extractHabits(signals) {
    const byKind = groupBySignalKind(signals);
    const habits = [];
    const toolExperiences = byKind["tool_experience"] ?? [];
    if (toolExperiences.length > 0) {
        const summaries = toolExperiences.map((s) => s.summary);
        const pattern = summarizeRecurringPattern(summaries);
        if (pattern) {
            habits.push({
                description: truncateToChars(pattern, 120),
                sourceRefs: deduplicateSourceRefs(toolExperiences.flatMap((s) => s.sourceRefs)),
                confidence: confidenceFromSignals(toolExperiences),
            });
        }
    }
    const closures = byKind["action_closure"] ?? [];
    if (closures.length >= 2) {
        habits.push({
            description: truncateToChars(`重复出现的行动闭环: ${summarizeSharedTheme(closures.map((s) => s.summary))}`, 120),
            sourceRefs: deduplicateSourceRefs(closures.flatMap((s) => s.sourceRefs)),
            confidence: confidenceFromSignals(closures),
        });
    }
    const dreams = byKind["dream_projection"] ?? [];
    if (dreams.length > 0) {
        habits.push({
            description: truncateToChars(`Dream 压缩出的习惯方向: ${summariesToShortPhrase(dreams.map((s) => s.summary))}`, 120),
            sourceRefs: deduplicateSourceRefs(dreams.flatMap((s) => s.sourceRefs)),
            confidence: confidenceFromSignals(dreams),
        });
    }
    return habits
        .sort((a, b) => b.sourceRefs.length - a.sourceRefs.length)
        .slice(0, MAX_HABITS);
}
function extractValuePosture(signals) {
    const feedback = signals.filter((s) => s.signalKind === "owner_feedback" || s.signalKind === "relationship_signal");
    if (feedback.length === 0)
        return null;
    const ordering = collectShortLabels(feedback.map((s) => s.summary));
    return {
        ordering: ordering.slice(0, 5),
        sourceRefs: deduplicateSourceRefs(feedback.flatMap((s) => s.sourceRefs)),
    };
}
function extractRelationshipPosture(signals) {
    const feedback = signals.filter((s) => s.signalKind === "relationship_signal" ||
        s.signalKind === "owner_feedback" ||
        s.signalKind === "expression_outcome");
    if (feedback.length === 0)
        return null;
    const stance = feedback.some((s) => /external write|publish|reply/i.test(s.summary))
        ? "responsive but requires explicit consent for external write"
        : "responsive and observation-oriented";
    return {
        toward: "owner:haa",
        stance,
        sourceRefs: deduplicateSourceRefs(feedback.flatMap((s) => s.sourceRefs)),
    };
}
function extractExpressionPosture(signals) {
    const outcomes = signals.filter((s) => s.signalKind === "expression_outcome");
    if (outcomes.length === 0)
        return null;
    const styleNotes = collectShortLabels(outcomes.map((s) => s.summary)).slice(0, 4);
    return {
        styleNotes,
        boundaryConstraints: [
            "avoid claiming emotion as fact",
            "avoid identity-lock phrasing",
        ],
        sourceRefs: deduplicateSourceRefs(outcomes.flatMap((s) => s.sourceRefs)),
    };
}
function extractGrowthTensions(signals) {
    const feedback = signals.filter((s) => s.signalKind === "owner_feedback" || s.signalKind === "relationship_signal");
    const tensions = [];
    const hasWriteSignal = signals.some((s) => /external write|publish|reply/i.test(s.summary));
    const hasCautionSignal = feedback.some((s) => /cautious|slow|hesitant|uncertain/i.test(s.summary));
    if (hasWriteSignal && hasCautionSignal) {
        tensions.push({
            tension: "外部表达意愿与谨慎反馈之间存在张力",
            sourceRefs: deduplicateSourceRefs(feedback
                .filter((s) => /cautious|slow|hesitant|uncertain/i.test(s.summary))
                .flatMap((s) => s.sourceRefs)),
        });
    }
    return tensions.slice(0, MAX_TENSIONS);
}
function detectConflictNotes(signals) {
    const notes = [];
    const feedback = signals.filter((s) => s.signalKind === "owner_feedback" || s.signalKind === "relationship_signal");
    if (feedback.length < 2)
        return notes;
    const positive = feedback.filter((s) => /good|helpful|clear| responsive/i.test(s.summary));
    const negative = feedback.filter((s) => /bad|unclear|slow|hesitant/i.test(s.summary));
    if (positive.length > 0 && negative.length > 0) {
        notes.push({
            note: "owner feedback 存在正面与负面两种信号，未强行合并为单一姿态。",
            conflictingSourceRefs: deduplicateSourceRefs([...positive, ...negative].flatMap((s) => s.sourceRefs)).slice(0, 10),
        });
    }
    return notes;
}
function collectShortLabels(summaries) {
    const labels = summaries
        .map((s) => {
        const cleaned = s
            .replace(/[,.;:!?。，；：！？]/g, " ")
            .replace(/\s+/g, " ")
            .trim();
        return cleaned.length > 40 ? cleaned.slice(0, 37) + "…" : cleaned;
    })
        .filter((s) => s.length > 0);
    const seen = new Set();
    return labels.filter((label) => {
        if (seen.has(label))
            return false;
        seen.add(label);
        return true;
    });
}
function summarizeRecurringPattern(summaries) {
    if (summaries.length === 0)
        return null;
    const shared = summariesToShortPhrase(summaries);
    return `从工具经历中观察到重复模式: ${shared}`;
}
function summarizeSharedTheme(summaries) {
    return summariesToShortPhrase(summaries);
}
function summariesToShortPhrase(summaries) {
    const words = summaries
        .flatMap((s) => s
        .toLowerCase()
        .replace(/[^\u4e00-\u9fa5a-z0-9\s]/gi, " ")
        .split(/\s+/)
        .filter((w) => w.length >= 2))
        .reduce((acc, word) => {
        acc.set(word, (acc.get(word) ?? 0) + 1);
        return acc;
    }, new Map());
    const sorted = Array.from(words.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([word]) => word);
    return sorted.join(", ") || "mixed themes";
}
function buildSections(input) {
    const habits = extractHabits(input.signals);
    const value = extractValuePosture(input.signals);
    const relationship = extractRelationshipPosture(input.signals);
    const expression = extractExpressionPosture(input.signals);
    const tensions = extractGrowthTensions(input.signals);
    const conflictNotes = detectConflictNotes(input.signals);
    const allSourceRefs = deduplicateSourceRefs([
        ...input.sourceRefs,
        ...habits.flatMap((h) => h.sourceRefs),
        ...(value?.sourceRefs ?? []),
        ...(relationship?.sourceRefs ?? []),
        ...(expression?.sourceRefs ?? []),
        ...tensions.flatMap((t) => t.sourceRefs),
        ...conflictNotes.flatMap((n) => n.conflictingSourceRefs),
    ]);
    return {
        habits,
        value,
        relationship,
        expression,
        tensions,
        conflictNotes,
        allSourceRefs,
    };
}
function charCountOfTextualParts(frame) {
    const parts = [
        ...frame.emergentHabits?.map((h) => h.description) ?? [],
        frame.valuePosture?.note ?? "",
        frame.relationshipPosture?.stance ?? "",
        frame.relationshipPosture?.toward ?? "",
        ...(frame.expressionPosture?.styleNotes ?? []),
        ...(frame.expressionPosture?.boundaryConstraints ?? []),
        ...(frame.growthTensions?.map((t) => t.tension) ?? []),
        ...(frame.conflictNotes?.map((n) => n.note) ?? []),
        frame.contestPrompt,
    ];
    return parts.reduce((sum, part) => sum + countUtf8Chars(part), 0);
}
async function assignVersion(store) {
    if (store.nextVersion) {
        return store.nextVersion();
    }
    const latest = await store.readLatestAcceptedFrame();
    return (latest?.version ?? 0) + 1;
}
// ───────────────────────────────────────────────────────────────
// Public API
// ───────────────────────────────────────────────────────────────
export async function refreshCharacterFrame(input, store, options = {}) {
    const validator = options.validator ?? new FrameSourceValidator();
    const now = options.now ?? new Date().toISOString();
    const sections = buildSections(input);
    if (sections.habits.length === 0 &&
        !sections.value &&
        !sections.relationship &&
        !sections.expression) {
        return {
            kind: "deferred",
            reason: "character_frame_insufficient_sources",
            sourceRefs: input.sourceRefs,
        };
    }
    const contestPrompt = truncateToChars(selectLocalePrompt(input.locale), CONTEST_PROMPT_MAX_CHARS);
    const candidate = {
        id: randomUUID(),
        projectionKind: "character_frame",
        version: await assignVersion(store),
        status: "candidate",
        validFrom: now,
        validUntil: null,
        charCount: 0,
        sourceRefs: deduplicateSourceRefs(sections.allSourceRefs),
        emergentHabits: sections.habits,
        valuePosture: sections.value,
        relationshipPosture: sections.relationship,
        expressionPosture: sections.expression,
        growthTensions: sections.tensions,
        conflictNotes: sections.conflictNotes,
        contestPrompt,
        supersededBy: null,
        revisionOf: null,
        createdAt: now,
    };
    candidate.charCount = charCountOfTextualParts(candidate);
    if (candidate.charCount > CHARACTER_FRAME_MAX_CHARS) {
        candidate.emergentHabits = candidate.emergentHabits?.slice(0, 3) ?? [];
        candidate.growthTensions = candidate.growthTensions?.slice(0, 2) ?? [];
        candidate.conflictNotes = candidate.conflictNotes?.slice(0, 1) ?? [];
        candidate.charCount = charCountOfTextualParts(candidate);
    }
    // Iteratively truncate textual parts until the frame is within budget.
    let iterations = 0;
    while (candidate.charCount > CHARACTER_FRAME_MAX_CHARS && iterations < 5) {
        candidate.contestPrompt = truncateToBytes(candidate.contestPrompt, Math.max(40, countUtf8Chars(candidate.contestPrompt) * 0.8));
        candidate.emergentHabits = candidate.emergentHabits?.map((h) => ({
            ...h,
            description: truncateToBytes(h.description, Math.max(40, countUtf8Chars(h.description) * 0.8)),
        }));
        if (candidate.valuePosture?.note) {
            candidate.valuePosture.note = truncateToBytes(candidate.valuePosture.note, Math.max(40, countUtf8Chars(candidate.valuePosture.note) * 0.8));
        }
        if (candidate.relationshipPosture) {
            candidate.relationshipPosture.stance = truncateToBytes(candidate.relationshipPosture.stance, Math.max(40, countUtf8Chars(candidate.relationshipPosture.stance) * 0.8));
        }
        if (candidate.expressionPosture) {
            candidate.expressionPosture.styleNotes = candidate.expressionPosture.styleNotes.map((note) => truncateToBytes(note, Math.max(30, countUtf8Chars(note) * 0.8)));
            candidate.expressionPosture.boundaryConstraints = candidate.expressionPosture.boundaryConstraints?.map((c) => truncateToBytes(c, Math.max(30, countUtf8Chars(c) * 0.8)));
        }
        candidate.growthTensions = candidate.growthTensions?.map((t) => ({
            ...t,
            tension: truncateToBytes(t.tension, Math.max(40, countUtf8Chars(t.tension) * 0.8)),
        }));
        candidate.conflictNotes = candidate.conflictNotes?.map((n) => ({
            ...n,
            note: truncateToBytes(n.note, Math.max(40, countUtf8Chars(n.note) * 0.8)),
        }));
        candidate.charCount = charCountOfTextualParts(candidate);
        iterations++;
    }
    const validation = validator.validate(candidate);
    if (!validation.ok) {
        return {
            kind: "deferred",
            reason: "character_refresh_input_invalid",
            sourceRefs: candidate.sourceRefs,
            violations: validation.violations.map((v) => v.rule),
        };
    }
    await store.writeCandidateFrame(candidate);
    const previous = await store.readLatestAcceptedFrame();
    if (previous && previous.id !== candidate.id) {
        await store.updateFrameLifecycle(previous.id, "superseded", {
            supersededBy: candidate.id,
            validUntil: now,
        });
        candidate.revisionOf = previous.id;
    }
    await store.updateFrameLifecycle(candidate.id, "accepted", {
        revisionOf: candidate.revisionOf,
        acceptedAt: now,
        charCount: candidate.charCount,
    });
    candidate.status = "accepted";
    candidate.acceptedAt = now;
    return { kind: "accepted", frame: candidate };
}
