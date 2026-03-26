# Guidance Template Review Workflow

## Purpose

This workflow is the single human review entry for every guidance template that can enter the runtime guidance path.

It exists to keep one rule executable: templates may be implemented in code, but they are not treated as final runtime-approved assets until a human reviews them.

## Scope

The current review list covers:

- `src/guidance/templates/atmosphere/baseline.md`
- `src/guidance/templates/impulses/social.md`
- `src/guidance/templates/impulses/reply.md`
- `src/guidance/templates/impulses/outreach.md`
- `src/guidance/templates/impulses/quiet.md`
- `src/guidance/templates/persona-selection-policy.md`

## Review States

- `pending_human_review`: the template exists, but still needs human review before it can be treated as approved
- `approved`: human review completed and the template is accepted for runtime use
- `rejected`: human review completed and the template must be revised before reuse

## Review Entry Rules

Every guidance template must contain frontmatter with at least:

```md
---
review_status: pending_human_review
review_required: true
scope: ...
---
```

If a template is missing this metadata, it is treated as review-incomplete.

## Human Review Procedure

1. Open the checklist generated from `collectGuidanceReviewChecklist()`.
2. Review each template in the current manifest.
3. Check that the wording still matches the accepted guidance direction.
4. Mark the template as one of:
   - `approved`
   - `rejected`
   - leave as `pending_human_review` if the review is not complete yet
5. If rejected, revise the template content and return it to `pending_human_review` for the next human pass.

## Rejection Path

When a template is rejected:

- keep the template in the review manifest
- revise the content in code
- set or keep `review_status: pending_human_review`
- send it back through the same human review loop

Rejected templates do not skip the queue and do not become implicitly approved after edits.

## Validation

Automatic validation only checks workflow integrity:

- every required template is present in the manifest
- every required template has review metadata
- checklist generation stays serializable and stable

Automatic validation does not replace human approval.
