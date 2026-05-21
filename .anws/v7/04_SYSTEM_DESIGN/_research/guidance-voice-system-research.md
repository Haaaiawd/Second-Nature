# Guidance Voice System Research

## Research Findings for Relationship-Aware Message Generation and Channel Feedback

### 1. Relationship-Aware Message Generation (2025 State of the Art)

**Key Finding**: Modern AI agents are evolving toward multi-stage social reasoning frameworks that separate mental state inference from response generation.

**Relevant Research**:
- **ToMAgent (2025)**: Combines Theory-of-Mind (ToM) predictions with dialogue outcome prediction. Shows that explicit mental-state conditioning improves relationship modeling - agents generate utterances with better sensitivity to partner feelings.
- **MetaMind Framework**: Three-stage collaborative approach: (1) Theory-of-Mind Agent generates hypotheses about user mental states, (2) Moral Agent refines using cultural norms, (3) Response Agent generates contextually appropriate responses.
- **CogniPair**: Demonstrates that agents achieve human-like evolution patterns with 0.72 correlation for match patterns when using psychological and social realism metrics.

**Design Implications for Guidance Voice System**:
- Separate relationship context analysis from message drafting
- Use mental state inference (relationship memory) to inform phrasing strategy
- Apply cultural/ethical constraints before final output generation

### 2. Channel Feedback Loop Strategies

**Key Finding**: Intelligent communication channels can learn to interpret and transform signals, reducing communication complexity while maintaining agent independence.

**Relevant Research**:
- **Intelligent Facilitator (SAF)**: Stateful, Active Facilitator that learns to sift through and interpret signals. Agents are incentivized to reduce dependence on messages while still benefiting from coordination.
- **Implicit Channel Protocol (ICP)**: Agents exchange information through encoded scouting actions, forming implicit communication channels that must be discovered and learned.
- **Cheap Talk Discovery/Utilization**: Agents must discover communication channels and learn how to use them through mutual information maximization.

**Design Implications for Guidance Voice System**:
- Channel feedback should inform future strategy without creating dependency
- System should learn from delivery outcomes while maintaining agent autonomy
- Feedback loops should be stateful but not override agent decision-making

### 3. Evidence-Grounded Outreach Drafting

**Key Finding**: Production systems use multi-stage pipelines that separate research, synthesis, and drafting phases with explicit source citation.

**Relevant Research**:
- **Agentic AI Pipeline**: Multi-stage approach: plan → discover → reason → use tools → learn. Emphasizes cited briefings and tailored emails with tool-chaining.
- **GTM Agent Architecture**: Four-node workflow: Lead Enrichment → Research & Synthesis → Scoring → Drafting. Uses RAG approach for analyzing company news and pain points.
- **FoxReach Integration**: Research tools are separate from delivery tools. Emphasis on logging every tool call for observability.

**Design Implications for Guidance Voice System**:
- Maintain strict separation between evidence gathering and message drafting
- Every claim in draft must have traceable source references
- Implement comprehensive logging for audit trails
- Use scoring/evaluation before generating final drafts

### 4. Inner Guide Voice Principles

**Key Finding**: Effective AI companions balance emotional intelligence with authenticity, avoiding over-interpretation while maintaining warmth.

**Relevant Research**:
- **Context-Aware Conversational Models**: Demonstrate capabilities in adapting dynamically to user context, sentiment shifts, and roleplay settings while maintaining long-term memory.
- **Social Intelligence Benchmarks**: Evaluate agents on pursuit of social goals while safeguarding private information, balancing active engagement with passive respect.
- **Relationship Modeling**: Models that generate utterances without explicit mental-state conditioning perform significantly worse on relationship dimensions.

**Design Implications for Guidance Voice System**:
- Inner guide should use relationship context to inform tone and phrasing
- Avoid making claims without evidence backing
- Balance warmth with accuracy - "evidence-backed warmth > baseless enthusiasm"
- Maintain consistency with established relationship patterns

### 5. Source-Backed Communication

**Key Finding**: Modern systems emphasize verifiable sourcing and avoid hallucination in outreach contexts.

**Relevant Research**:
- **Research Outreach Agents**: Build compact, cited briefings before drafting emails
- **Evidence-Grounded Drafting**: Use RAG approaches to ensure all claims are backed by retrieved evidence
- **Audit Requirements**: Production systems require comprehensive logging of source references and decision processes

**Design Implications for Guidance Voice System**:
- Every draft must include source references
- System should validate source quality before using evidence
- Implement fallback strategies when evidence is insufficient
- Maintain audit trails for all drafting decisions

---

## Synthesis for Second Nature v7

The research confirms that the v7 approach of separating relationship memory, evidence gathering, and message drafting is aligned with 2025 best practices. The key insights are:

1. **Multi-stage architecture is essential**: Separate mental state inference, evidence gathering, and response generation
2. **Channel feedback should inform but not control**: Use feedback to learn strategies while maintaining agent autonomy  
3. **Source backing is non-negotiable**: Every claim must have traceable evidence
4. **Relationship awareness improves outcomes**: Explicit mental-state conditioning significantly improves relationship quality
5. **Observability is critical**: Comprehensive logging and audit trails are standard in production systems

This research validates the design direction in the PRD and Architecture Overview.