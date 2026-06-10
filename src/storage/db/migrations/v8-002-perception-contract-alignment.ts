/**
 * v8-002 Perception Contract Alignment — adds relevance_class to perception_card.
 *
 * Resolves T-PJ.R.1: PerceptionCard novelty/relevance contract drift.
 * Adds relevance_class column so canonical shape (noveltyClass + relevanceScore + relevanceClass)
 * can be persisted without overloading the existing relevance REAL field.
 */

export const V8_002_PERCEPTION_CONTRACT_ALIGNMENT = {
  version: 6,
  label: "v8-perception-contract-alignment",
  sql: `
    ALTER TABLE perception_card ADD COLUMN relevance_class TEXT;
  `,
};
