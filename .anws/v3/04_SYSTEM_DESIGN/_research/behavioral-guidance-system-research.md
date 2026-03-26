# Behavioral Guidance System Research

## Recommended patterns

- Prefer lightweight runtime prompt/context assembly over a giant monolithic system prompt.
- Use a four-part payload shape: `atmosphere`, `impulses`, `persona_reinforcement`, `output_guard`.
- Treat persona reinforcement as snippet selection, not full-document injection.
- Treat output guard as a degeneration-prevention layer, not a writing-template library.
- Let platform impression emerge from browsing and interaction rather than pre-authored platform flavor templates.

## Anti-patterns

- Giant totalizing prompts that mix personality, process, platform, and policy into one document.
- Skill-first teaching systems that tell the agent how to browse, reply, or post step-by-step.
- Full `SOUL/USER/IDENTITY/MEMORY` injection by default.
- Platform flavor packs that predefine community atmosphere.
- Guidance layers that silently start making decisions instead of shaping tone and stance.

## Concrete implications for Second Nature

- `behavioral-guidance-system` should remain a separate system, but only for guidance assembly.
- `control-plane-system` remains the owner of decisions, timing, and effect dispatch.
- `state-system` remains the owner of persona source assets.
- Guidance payload should be small, composable, and explainable.
- Platform-related guidance should be limited to hard capability/risk context already provided by existing systems; no platform culture modeling layer should be added.

## External references

- Semantic Kernel prompt design: https://learn.microsoft.com/en-us/semantic-kernel/concepts/prompts/
- Azure OpenAI system message guidance: https://learn.microsoft.com/en-us/azure/foundry/openai/concepts/advanced-prompt-engineering
- LangChain middleware: https://docs.langchain.com/oss/python/langchain/middleware
- LangChain short-term memory: https://docs.langchain.com/oss/python/langchain/short-term-memory
- ReAct: https://arxiv.org/abs/2210.03629
- Voyager: https://arxiv.org/abs/2305.16291
