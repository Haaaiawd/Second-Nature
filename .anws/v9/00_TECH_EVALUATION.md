# v9 Technical Evaluation — Step 3 Material

> This is Step 3 evaluation material, not an ADR. ADRs are written in Step 5 after system decomposition.

## Constraints

| Area | Constraint |
| --- | --- |
| Functional | Self continuity, emergent character/habit projection, procedural memory, tool routines, workspace connector automatic evolution, Claw context injection. |
| Non-functional | Source-backed, redacted, bounded, testable, rollback-capable, no raw private/credential exposure. |
| Team / Stack | Continue TypeScript / Node / OpenClaw plugin / SQLite/sql.js unless a decision requires otherwise. |
| Budget | No new major runtime dependency unless unavoidable. |
| Special | Automatic evolution is workspace-only; no core runtime self-modification; prompt/context must not claim authoritative Agent emotion. |

## Candidates

| Candidate | Description |
| --- | --- |
| A. In-place v8 evolution | Extend existing v8 stack with Continuity Projection, ToolRoutine Registry, and Workspace Connector Evolution gates. |
| B. External skill library | Keep Second Nature mostly unchanged and export procedural memory as portable agent skills. |
| C. Full runtime self-modification | Let Dream/Agent modify core runtime code automatically. |

## 12-Dimension Matrix

Scores: 1 low / 5 high. Equal weights.

| Dimension | A. In-place v8 | B. External skill library | C. Full self-modification |
| --- | ---: | ---: | ---: |
| Requirement fit | 5 | 3 | 4 |
| Scalability | 4 | 4 | 2 |
| Performance | 4 | 3 | 2 |
| Security | 4 | 3 | 1 |
| Team skill | 5 | 3 | 2 |
| Talent market | 4 | 4 | 2 |
| Development speed | 4 | 3 | 2 |
| TCO | 5 | 3 | 1 |
| Community ecosystem | 4 | 4 | 2 |
| Long-term maintenance | 5 | 3 | 1 |
| Integration ability | 5 | 2 | 2 |
| AI readiness | 4 | 4 | 3 |
| **Total** | **53** | **39** | **24** |

## ATAM Quality Scenario

**Scenario**: A Claw Agent starts with empty conversational context after 147 successful heartbeats. Within one context assembly, it must receive a bounded `SelfContinuityCard`, contestable `CharacterFrame`, active routines, and real-hand affordance posture without reading raw historical logs or being told what it must feel.

| Candidate | Support |
| --- | --- |
| A. In-place v8 | Strong: uses state, Dream projections, EmbodiedContext, and existing source refs. |
| B. External skill library | Partial: can inject skills, but weak runtime truth and rollback coupling. |
| C. Full self-modification | Risky: can mutate behavior but undermines predictable recovery and tests. |

## Trade-offs

- In-place v8 evolution preserves a simple operational shape but requires pruning over-heavy judgment semantics into `AttentionSignal`.
- External skills are portable but too detached from ToolExperience, closure, connector gates, and loop health.
- Full self-modification maximizes autonomy but violates recoverability and security boundaries.

## Risks

- `AttentionSignal` refactor could break v8 action closure if not staged behind compatibility adapters.
- `CharacterFrame` could become injected persona or false emotion claim unless prompt wording and validation keep it contestable.
- Connector evolution gates can become ceremony if not kept mechanical and deterministic.
- Routine generation can become prompt slop unless schema, source refs, and execution traces are mandatory.

## Recommended Decision Material

- Continue TypeScript / Node / OpenClaw / SQLite as the v9 runtime stack.
- Add no external procedural memory runtime dependency.
- Borrow concepts from SkillX, MemSearch, and Agent Artifacts, but implement them as native Second Nature contracts.
- Reject automatic core runtime self-modification.
- Require validation gates and rollback for all automatic workspace connector changes.
- Require CharacterFrame validation against trait scores, hard-control language, source-free claims, and authoritative emotion claims.

## Verification Strategy

- Unit tests: schema validation, permission gates, routine guard checks, continuity card redaction, CharacterFrame prompt-boundary validation.
- API tests: ops read models for continuity, routine registry, connector evolution ledger.
- Integration tests: repeated feed dedupe, Dream -> routine install, workspace connector evolution pass/fail, canary rollback.
- E2E/manual: Claw-facing context includes `SelfContinuityCard`, contestable `CharacterFrame`, and active routines after context reset.
