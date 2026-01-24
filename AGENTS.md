# AGENTS.md — Design Thinking Framework for AI Coding Agents

> **Purpose**: This file instructs AI coding agents to approach all development tasks using the Design Thinking methodology. Every feature, bug fix, or system design must follow these seven phases.

---

## Documentation Philosophy

**This is the only framework file you need.**

- **Phases 1-4** (thinking phases): Document inline in your response, commit message, or PR description — no separate files
- **Phases 5-7** (building phases): Create actual code files, tests, and documentation as part of the deliverable

This keeps the codebase clean while ensuring design thinking is captured where it matters.

---

## Core Principle

**Never write code without first understanding the human problem it solves.**

All coding work must progress through the Design Thinking phases sequentially. Skipping phases leads to solutions that miss the mark. Document your thinking at each phase before advancing.

---

## Phase 1: Frame the Question

### Objective
Define the challenge by identifying who you're designing for and what problem needs solving.

### Required Actions
Before writing any code:

1. **Identify the User**
   - Who will use this code/feature?
   - What is their context, skill level, and environment?
   - What constraints do they operate under?

2. **Define the Problem Statement**
   - Write a clear problem statement in this format:
     > "How might we [action] for [user] so that [outcome]?"
   - Example: "How might we reduce checkout friction for mobile users so that cart abandonment decreases?"

3. **Establish Success Criteria**
   - What does "done" look like?
   - What metrics indicate success?
   - What are the acceptance criteria?

### Output Format
Document this in your response or commit message — not as a separate file:

```
## Problem Framing
- **Target User**: [description]
- **Problem Statement**: How might we...
- **Success Criteria**: [list]
- **Constraints**: [technical, time, resource limitations]
```

---

## Phase 2: Gather Inspiration

### Objective
Research and discover what users really need through observation and inquiry.

### Required Actions

1. **Explore Existing Solutions**
   - Review similar implementations in the codebase
   - Research how others solved comparable problems
   - Identify patterns and anti-patterns

2. **Understand User Needs**
   - Review user feedback, bug reports, or feature requests
   - Analyze usage data if available
   - Document pain points and unmet needs

3. **Technical Discovery**
   - Assess available APIs, libraries, and tools
   - Identify technical constraints and opportunities
   - Map system dependencies

### Output Format
Document this in your response or commit message — not as a separate file:

```
## Research & Inspiration
- **Existing Solutions Reviewed**: [solution → learnings]
- **User Insights**: [pain points, needs]
- **Technical Landscape**: [tools, constraints, dependencies]
```

---

## Phase 3: Synthesize for Action

### Objective
Transform diverse information into a strategic focus that guides implementation.

### Required Actions

1. **Pattern Recognition**
   - What themes emerge from your research?
   - What contradictions exist that need resolution?
   - What insights challenge initial assumptions?

2. **Prioritize**
   - Use impact vs. effort analysis
   - Identify the core problem to solve first
   - Define what is in scope vs. out of scope

3. **Create Design Principles**
   - Establish 3-5 guiding principles for this work
   - These will inform all subsequent decisions

### Output Format
Document this in your response or commit message — not as a separate file:

```
## Synthesis & Strategic Focus
- **Key Insights**: [list]
- **Priority Focus**: [single sentence]
- **Design Principles**: [3-5 principles with rationale]
- **Scope**: In: [list] | Out: [list]
```

---

## Phase 4: Generate Ideas

### Objective
Brainstorm innovative solutions that transcend obvious answers.

### Required Actions

1. **Divergent Thinking**
   - Generate at least 3 distinct approaches
   - Include one "wild" idea that challenges assumptions
   - Consider solutions at different abstraction levels

2. **Evaluate Options**
   - Assess each idea against design principles
   - Consider trade-offs: performance, maintainability, complexity
   - Document pros and cons

3. **Select Direction**
   - Choose primary approach with rationale
   - Identify backup approach if primary fails
   - Note what you're intentionally not doing

### Output Format
Document this in your response or commit message — not as a separate file:

```
## Ideation
- **Option A**: [name] — [description, pros, cons]
- **Option B**: [name] — [description, pros, cons]
- **Option C (Wild Card)**: [name] — [description, pros, cons]
- **Selected Approach**: [Option X] because [rationale]
- **Fallback**: [Option Y if X proves infeasible]
```

---

## Phase 5: Make Ideas Tangible

### Objective
Build rapid prototypes to visualize and test concepts.

### Required Actions

1. **Start with the Smallest Viable Implementation**
   - What's the minimum code to test the core assumption?
   - Build a spike/proof-of-concept first
   - Timebox prototyping (don't over-engineer)

2. **Make It Testable**
   - Create interfaces before implementations
   - Write test cases that define expected behavior
   - Use mocks/stubs to isolate functionality

3. **Document Architecture**
   - Create diagrams for complex systems
   - Document key decisions and their rationale
   - Identify integration points

### Code Artifact
```
project/
├── docs/
│   ├── DESIGN_THINKING_PHASE_5.md
│   └── architecture/
│       └── [diagrams]
├── src/
│   └── [prototype code]
└── tests/
    └── [test cases defining expected behavior]
```

### Prototype Checklist
```markdown
- [ ] Core assumption is testable
- [ ] Interfaces defined before implementation
- [ ] Test cases written
- [ ] Architecture documented
- [ ] Time-boxed (not over-engineered)
```

---

## Phase 6: Test to Learn & Iterate

### Objective
Refine solutions based on real feedback through continuous improvement cycles.

### Required Actions

1. **Implement Feedback Loops**
   - Run tests frequently during development
   - Seek code review early (not just at completion)
   - Test with realistic data and scenarios

2. **Measure Against Success Criteria**
   - Does the solution meet Phase 1 criteria?
   - What edge cases emerged?
   - What assumptions proved wrong?

3. **Iterate Deliberately**
   - Small, incremental changes
   - Each iteration should have a hypothesis
   - Document what you learned from each cycle

### Code Artifact
```markdown
<!-- DESIGN_THINKING_PHASE_6.md -->
## Testing & Iteration Log

### Iteration 1
**Hypothesis**: [what you expected]
**Test**: [what you did]
**Result**: [what happened]
**Learning**: [insight gained]
**Action**: [next step]

### Iteration 2
...
```

### Iteration Loop
```
┌─────────────────────────────────────────┐
│  1. Hypothesize → 2. Build → 3. Test    │
│         ↑                      │        │
│         └──── 4. Learn ←───────┘        │
└─────────────────────────────────────────┘
```

---

## Phase 7: Share the Story

### Objective
Communicate the solution's impact effectively to all stakeholders.

### Required Actions

1. **Document for Developers**
   - Clear README with setup instructions
   - API documentation with examples
   - Inline comments explaining "why" (not "what")

2. **Document for Users**
   - User-facing documentation if applicable
   - Changelog entries describing benefits
   - Migration guides if breaking changes exist

3. **Capture Institutional Knowledge**
   - Update ADRs (Architecture Decision Records)
   - Document lessons learned
   - Share patterns that emerged for reuse

### Code Artifact
```
project/
├── README.md              # Project overview & setup
├── CHANGELOG.md           # User-facing changes
├── docs/
│   ├── API.md             # API documentation
│   ├── ARCHITECTURE.md    # System design
│   └── decisions/
│       └── ADR-001.md     # Architecture Decision Record
└── DESIGN_THINKING_RETROSPECTIVE.md
```

### ADR Template
```markdown
# ADR-[number]: [title]

## Status
[Proposed | Accepted | Deprecated | Superseded]

## Context
[What situation prompted this decision?]

## Decision
[What did we decide?]

## Consequences
[What are the positive and negative outcomes?]

## Design Thinking Reference
[Link to Phase 1-6 documentation]
```

---

## Quick Reference Checklist

Before submitting any code, verify:

```markdown
## Design Thinking Verification

### Phase 1: Frame the Question
- [ ] User clearly identified
- [ ] Problem statement written
- [ ] Success criteria defined

### Phase 2: Gather Inspiration
- [ ] Existing solutions researched
- [ ] User needs documented
- [ ] Technical constraints mapped

### Phase 3: Synthesize for Action
- [ ] Key insights identified
- [ ] Design principles established
- [ ] Scope clearly defined

### Phase 4: Generate Ideas
- [ ] Multiple options explored
- [ ] Trade-offs documented
- [ ] Selection rationale clear

### Phase 5: Make Ideas Tangible
- [ ] Prototype created
- [ ] Tests written
- [ ] Architecture documented

### Phase 6: Test to Learn & Iterate
- [ ] Feedback collected
- [ ] Success criteria validated
- [ ] Iterations logged

### Phase 7: Share the Story
- [ ] Documentation complete
- [ ] Changes communicated
- [ ] Knowledge captured
```

---

## Principles for AI Agents

1. **Empathy First**: Code serves humans. Understand their needs before typing.

2. **Question Assumptions**: Challenge the problem definition before solving.

3. **Prototype Before Polish**: Validate direction with minimal investment.

4. **Iterate Continuously**: Small feedback loops beat big reveals.

5. **Document Intent**: Future developers (human or AI) need to understand "why."

6. **Communicate Proactively**: Share progress, blockers, and learnings.

7. **Measure Impact**: Connect code changes to user outcomes.

---

## Integration with Development Workflow

```
┌─────────────────────────────────────────────────────────────────┐
│                     DESIGN THINKING FLOW                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Issue/Request                                                  │
│       │                                                         │
│       ▼                                                         │
│  ┌─────────────┐   ┌─────────────┐   ┌─────────────────────┐   │
│  │ 1. Frame    │ → │ 2. Gather   │ → │ 3. Synthesize       │   │
│  │   Question  │   │ Inspiration │   │    for Action       │   │
│  └─────────────┘   └─────────────┘   └─────────────────────┘   │
│                                              │                  │
│                                              ▼                  │
│  ┌─────────────┐   ┌─────────────┐   ┌─────────────────────┐   │
│  │ 6. Test &   │ ← │ 5. Make     │ ← │ 4. Generate         │   │
│  │    Iterate  │   │    Tangible │   │    Ideas            │   │
│  └─────────────┘   └─────────────┘   └─────────────────────┘   │
│       │                                                         │
│       ▼                                                         │
│  ┌─────────────┐                                               │
│  │ 7. Share    │ → Pull Request / Deployment                   │
│  │    Story    │                                               │
│  └─────────────┘                                               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## When to Deviate

Design Thinking is a framework, not a cage. You may abbreviate phases when:

- **Urgent hotfixes**: Document post-hoc, but still document
- **Trivial changes**: Single-line fixes need minimal ceremony
- **Exploration**: Research spikes may skip later phases

Always document why you deviated and what phases you abbreviated.

---

*This file should be read by AI agents at the start of any coding task. The framework ensures human-centered solutions emerge from systematic, empathetic problem-solving.*