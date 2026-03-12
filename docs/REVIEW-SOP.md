# FrontierBoard Review SOP

Standard operating procedure for multi-agent board reviews. Applicable to any artifact type: code, legal documents, financial analysis, business plans, technical writing, contracts, policies, etc.

---

## 1. Concepts

### What is a FrontierBoard Review?

A structured process where multiple AI agents independently evaluate an artifact, then converge on a consensus through controlled rounds. Each agent brings a distinct analytical lens. No agent sees another's work until the deliberation phase. This prevents groupthink and surfaces concerns that a single reviewer would miss.

### Core Principles

- **Blind first.** Agents never see each other's initial analysis. Independent thinking produces diverse findings.
- **Converge, don't vote.** The goal is consensus on what to fix, defer, or accept — not majority rule.
- **Owner authority.** The human owner can override any agent position with a directive. Directives are binding on all subsequent rounds.
- **DEFER ≠ cut.** Deferred items are planned future work with explicit trigger conditions. They remain visible and actionable. Only REJECT removes items.
- **Agents are ephemeral.** Each round starts a fresh session. Agents have no memory between rounds. All context must be in the brief.

---

## 2. Roles

### Board Agents

A minimum of 3 agents with complementary lenses. Recommended archetypes:

| Role | Lens | Asks |
|------|------|------|
| **The Skeptic** | Risk, failure modes, attack surfaces | What breaks? What's the worst case? What assumption is wrong? |
| **The Systems Thinker** | Integration, data flow, downstream effects | How do parts connect? What breaks downstream? What's the blast radius? |
| **The Simplicity Advocate** | Complexity cost, unnecessary scope, maintainability | Is this earning its keep? Is there a simpler way? What can wait? |

These archetypes work across domains:

| Domain | Skeptic Focus | Systems Focus | Simplicity Focus |
|--------|--------------|---------------|-----------------|
| Code | Security, bugs, edge cases | Architecture, contracts, data flow | Over-engineering, premature abstraction |
| Legal | Liability, loopholes, enforceability | Cross-clause dependencies, jurisdiction conflicts | Unnecessary clauses, plain language |
| Financial | Fraud risk, hidden assumptions, stress scenarios | Cash flow dependencies, systemic exposure | Over-complex instruments, reporting burden |
| Documents | Factual errors, misleading claims, gaps | Narrative coherence, audience alignment | Verbosity, redundant sections |
| Policy | Unintended consequences, gaming vectors | Cross-policy conflicts, enforcement gaps | Bureaucratic overhead, unclear rules |

### Owner

The human who commissioned the review. The owner:
- Provides the artifact and context
- Issues directives that override agent positions
- Accepts or rejects agent modifications
- Decides when consensus is sufficient to proceed

### Facilitator

The process that runs the board (human or automated). The facilitator:
- Writes briefs for each round
- Copies briefs to agent inboxes
- Runs agents and collects reports
- Consolidates findings between rounds
- Applies owner directives
- Tracks round history

---

## 3. Severity Classifications

Every finding gets a severity and an action:

| Severity | Meaning | Action |
|----------|---------|--------|
| **FIX NOW** | Must be addressed before the artifact ships/executes | Block until fixed |
| **DEFER** | Real issue, but not blocking. Has a trigger condition for when it becomes FIX NOW | Document trigger, monitor |
| **INFO** | Observation worth noting. No action required | Record for awareness |
| **REJECT** | Proposed change that should not be made | Document rationale, close |

### DEFER Requirements

Every DEFER item MUST have:
1. **Trigger condition** — a specific, observable event that promotes it to FIX NOW
2. **Visibility** — listed in a tracked location (not buried in review notes)
3. **Proposed fix** — what to do when triggered (even if rough)

---

## 4. Round Structure

### Round 1: Blind Review

**Purpose:** Independent analysis. Each agent reviews the artifact without seeing other agents' work.

**Brief contents:**
- The artifact (full text — agents are ephemeral, they can't access external files)
- Context (what this is, why it matters, what to evaluate)
- Evaluation criteria (domain-specific questions)
- Output format (finding ID, severity, issue, fix)

**Agent output:** A report with numbered findings, each classified by severity.

**Facilitator action:** Collect all reports. Do not share between agents yet.

### Round 2: Consolidation

**Purpose:** Merge overlapping findings, resolve conflicts, apply owner directives.

**The facilitator:**
1. Groups findings by theme across all agents
2. Assigns consolidated IDs (C1, C2, ...)
3. Notes where agents agree, disagree, or have unique findings
4. Applies owner directives (overrides, clarifications, scope decisions)
5. Classifies each consolidated item: FIX NOW / DEFER / INFO / REJECT

**Brief contents:**
- Consolidated findings with all agent positions shown (anonymized)
- Owner directives clearly marked
- Each item's proposed classification

**Agent output:** For each item: AGREE, DISAGREE (with rationale), or MODIFY (with alternative).

### Round 3: Deliberation (if needed)

**Purpose:** Resolve remaining disagreements from Round 2.

**When to run:** When Round 2 has items where agents disagree on severity or approach. Skip if Round 2 reaches consensus.

**Brief contents:**
- Only the disputed items
- Each agent's Round 2 position (now visible to all — deliberation is not blind)
- Owner's position if stated

**Agent output:** Final position on disputed items. Must state AGREE or BLOCK.

### Round 4: Confirmation

**Purpose:** Final sign-off.

**Brief contents:**
- Complete final list: all FIX NOW items, all DEFER items with triggers, all INFO/REJECT items
- Implementation notes from prior rounds
- Phase 3 deferred items status (if applicable)

**Agent output:** SIGN OFF or BLOCK (with specific concern).

**Completion criteria:** All agents SIGN OFF, or owner overrides remaining BLOCKs with documented rationale.

### Expedited Path

If Round 2 produces unanimous agreement on all items, skip Round 3 and go directly to Round 4 (confirmation). This is the common case for well-prepared artifacts.

---

## 5. Artifact Preparation

### What Makes a Good Brief

The brief is everything. Agents are ephemeral — they know nothing except what's in the brief. A bad brief produces bad reviews.

**Required sections:**
1. **Context** — What is this artifact? Why does it exist? Who is the audience?
2. **The artifact itself** — Full text, inline. Do not reference external files.
3. **Evaluation criteria** — What specifically should the agent evaluate?
4. **Output format** — How to structure findings (ID, severity, issue, fix)

**Domain-specific guidance:**

| Domain | Include in brief | Don't include |
|--------|-----------------|---------------|
| Code | Full source, architecture context, test coverage, dependency list | Unrelated modules, git history |
| Legal | Full document, jurisdiction, parties, governing law, related agreements | Privileged communications |
| Financial | Full analysis, assumptions, market data sources, time horizon | Raw market data dumps |
| Documents | Full text, target audience, purpose, style guide | Earlier unrelated drafts |
| Policy | Full policy text, affected stakeholders, existing related policies | Internal deliberations |

### Brief Size Management

If the artifact exceeds ~50KB, provide:
- Executive summary (1 page)
- Full artifact
- Index of sections with line numbers

If the artifact exceeds ~100KB, split into focused review sessions by section.

---

## 6. Facilitator Playbook

### Before Round 1

```
1. Write the brief with full artifact inline
2. Copy brief to each agent's inbox/brief.md
3. Verify context.md is appropriate for the domain
4. Clear previous outbox/report.md files
5. Refresh agent credentials if needed
```

### Running Agents

```
Run all agents in parallel. Each agent:
1. Reads its CLAUDE.md (role definition)
2. Reads inbox/context.md (domain lens)
3. Reads inbox/brief.md (the task + artifact)
4. Writes outbox/report.md (findings)
```

### Between Rounds

```
1. Read all agent reports
2. Consolidate findings by theme
3. Apply owner directives
4. Write next round's brief
5. Copy to all inboxes, clear outboxes
6. Run agents
```

### After Final Round

```
1. Append review history to the artifact document
2. Update project memory/tracking
3. Create DEFERRED_WORK.md if deferred items exist
4. Proceed to implementation/execution
```

---

## 7. Finding Format

### Agent Report Format

```markdown
## Finding [N]: [Title]
- **ID**: [Domain]-[Round]-[Number] (e.g., P4-01, LEGAL-R1-03, FIN-R1-07)
- **Severity**: FIX NOW / DEFER / INFO
- **Section**: [Which part of the artifact]
- **Issue**: [What's wrong — 2-3 sentences max]
- **Impact**: [What happens if not addressed]
- **Fix**: [What to do instead — be specific]
```

### Consolidation Format

```markdown
### C[N]: [Title]
**Agents:** [Who raised it]
**Severity consensus:** [FIX NOW / DEFER / split]
**Section:** [Which part]
**Issue:** [Merged description]
**Proposed fix:** [Best fix from all agents]
**Trigger condition:** [For DEFER items only]
```

---

## 8. Owner Directives

Owner directives override agent positions. They are issued between rounds and included in the next brief.

### Format

```markdown
**Owner directive:** [Statement]
**Rationale:** [Why — agents need context to apply it correctly]
**Scope:** [Which findings this affects]
```

### Examples

- "ElevenLabs is a production requirement. Do not recommend cutting it." → Rejects any finding that proposes removing ElevenLabs
- "Deferred items must remain visible to downstream consumers." → Adds a requirement to all DEFER items
- "Accept the Systems Thinker's modification on C9." → Promotes a specific agent's position

### Rules

- Directives are binding on all agents in subsequent rounds
- Agents may note disagreement but must comply
- Directives should include rationale so agents understand the context
- Directives do not require agent consensus — they are owner authority

---

## 9. Completion Criteria

The review is complete when:

1. All agents have SIGNED OFF, **or**
2. The owner has overridden remaining BLOCKs with documented rationale

### Deliverables

After completion, the artifact document should be updated with:

1. **Review history section** — rounds, findings, verdicts
2. **FIX NOW table** — items to apply during implementation
3. **DEFER table** — items with trigger conditions
4. **Implementation notes** — key decisions from deliberation

### Tracking Deferred Items

Create or update a `DEFERRED_WORK.md` file:

```markdown
# Deferred Work

## [Project/Phase Name]

| ID | Item | Trigger Condition | Origin |
|----|------|-------------------|--------|
| C8 | [Description] | [When this becomes FIX NOW] | Phase 4 R28 |
| C10 | [Description] | [Observable event] | Phase 4 R28 |
```

This file is the single source of truth for deferred work. Downstream consumers (agents, developers, reviewers) check this file to know what's planned but not yet implemented.

---

## 10. Anti-Patterns

| Anti-Pattern | Why It Fails | Instead |
|-------------|--------------|---------|
| Skipping blind review | Anchoring bias — agents converge on first opinion | Always run Round 1 blind |
| Treating DEFER as "won't do" | Loses planned work, creates invisible gaps | DEFER with trigger, track in DEFERRED_WORK.md |
| Briefs without full artifact | Agents hallucinate missing content | Inline everything — agents are ephemeral |
| Running agents sequentially | Anchoring if one report influences brief revisions | Run all agents in parallel per round |
| Owner override without rationale | Agents can't apply the spirit of the directive | Always explain why |
| More than 5 rounds | Diminishing returns, agent fatigue (repetition) | 3-4 rounds is the sweet spot |
| Ignoring unanimous agreement | Wastes rounds on settled items | If Round 2 is unanimous, skip to confirmation |
| Letting Simplicity cut production features | Simplest implementation ≠ smallest scope | Clarify: simplify HOW, not WHETHER |

---

## Appendix A: Quick Reference

### Minimum Viable Review (3 rounds)

```
Round 1 (Blind)         → 3 independent reports
Round 2 (Consolidation) → Merged findings, agent positions
Round 3 (Confirmation)  → SIGN OFF / BLOCK
```

### Full Review (4 rounds)

```
Round 1 (Blind)         → 3 independent reports
Round 2 (Consolidation) → Merged findings, agent positions
Round 3 (Deliberation)  → Resolve disagreements
Round 4 (Confirmation)  → SIGN OFF / BLOCK
```

### Severity Decision Tree

```
Is it wrong/dangerous/broken?
  Yes → FIX NOW
  No  → Is it a real issue that will matter eventually?
    Yes → DEFER (define trigger)
    No  → Is it worth noting?
      Yes → INFO
      No  → Don't file it
```

### Agent Verdict Options

```
Round 1: Report findings (no verdict required)
Round 2: AGREE / DISAGREE / MODIFY (per item)
         APPROVE / APPROVE WITH FIXES / REQUEST CHANGES (overall)
Round 3: AGREE / BLOCK (per disputed item)
Round 4: SIGN OFF / BLOCK (overall)
```
