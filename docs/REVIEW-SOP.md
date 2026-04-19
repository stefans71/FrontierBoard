# FrontierBoard Review SOP

Standard operating procedure for multi-agent board reviews. Applicable to any artifact type: code, legal documents, financial analysis, business plans, technical writing, contracts, policies.

---

## 1. Core Principles

- **Blind first.** Agents never see each other's initial analysis.
- **Converge, don't vote.** Consensus on what to fix/defer/accept — not majority rule.
- **Owner authority.** Human owner can override any agent position with a directive. Directives are binding.
- **DEFER ≠ cut.** Deferred items have trigger conditions. They remain visible and actionable.
- **Agents are ephemeral.** Each round is a fresh session. All context must be in the brief.

---

## 2. Roles

**Board Agents** — minimum 3 with complementary lenses. Recommended archetypes:

| Role | Lens | Asks |
|------|------|------|
| **Skeptic** | Risk, failure modes, attack surfaces | What breaks? What assumption is wrong? |
| **Systems Thinker** | Integration, data flow, downstream effects | How do parts connect? What's the blast radius? |
| **Simplicity Advocate** | Complexity cost, maintainability | Is this earning its keep? Simpler way? |

These archetypes work across domains — code, legal, financial, documents, policy. The lens stays stable; the domain context changes per review.

**Owner** — provides the artifact, issues directives, decides when consensus is sufficient.

**Facilitator** — writes briefs, runs agents, consolidates findings, applies directives.

---

## 3. Severity Classifications

| Severity | Meaning | Action |
|----------|---------|--------|
| **FIX NOW** | Must address before shipping | Block until fixed |
| **DEFER** | Real issue, not blocking. Has a trigger condition | Document trigger, monitor |
| **INFO** | Observation. No action required | Record |
| **REJECT** | Proposed change that should not be made | Document rationale, close |

Every DEFER must have: trigger condition, visibility in tracked location, proposed fix.

---

## 4. Round Structure

### Pre-Round Validation

**Minimum agent count:** Standard reviews require at least 3 agents with reports before proceeding to consolidation. Quick mode (1 agent, 1 round) is an explicit exception — the user opts into reduced coverage.

Before starting Round 1, verify the board has the required agents. If fewer than 3 are configured, warn the owner and get explicit approval to proceed with reduced coverage.

### Round 1: Blind Review
Independent analysis. Brief contains: full artifact inline, context, evaluation criteria, output format. Agent writes numbered findings with severity. Facilitator collects — does not share between agents.

**Failed agents must be re-run.** If an agent fails to produce a report (timeout, crash, auth error), the facilitator must retry it at least once before proceeding. With the minimum 3-agent board, losing one agent means insufficient perspective diversity for meaningful consensus. Only proceed with fewer agents if the retry also fails AND the owner explicitly approves continuing with reduced coverage.

### Round 2: Consolidation
Facilitator groups findings by theme, assigns IDs (C1, C2...), notes agreement/disagreement, applies owner directives, classifies each item. Brief to agents contains: consolidated items with anonymized positions, proposed classifications, owner directives. Agents respond: AGREE / DISAGREE (with rationale) / MODIFY (with alternative).

**Classification disagreements:** When agents assign different severities to the same finding during consolidation:
1. If 2 of 3 agree on severity → use the majority classification, note the dissent
2. If all 3 disagree → use the highest severity proposed, flag for deliberation in Round 3
3. If the disagreement is between FIX NOW and DEFER → classify as FIX NOW (err on the side of caution) and let deliberation resolve it
4. Owner directives override any classification

### Round 3: Deliberation (if needed)
Only for disputed items. Agent positions now visible with names. Agents state AGREE or BLOCK. Skip if Round 2 is unanimous.

### Round 4: Confirmation
Final brief: all items with classifications and resolution. Agents state SIGN OFF or BLOCK. Complete when all sign off, or owner overrides remaining blocks with rationale.

### Post-Confirmation: Fix Artifact Authoring (when FIX NOW items exist)

After confirmation sign-off, agents author concrete fix artifacts for each FIX NOW item. This converts abstract findings into precise, mechanically-applicable changes.

**Format per item:**
- **Location**: exact file, section, paragraph, or clause
- **Current text**: verbatim excerpt with 3+ lines of surrounding context for anchoring (copy-paste, not paraphrased)
- **Replacement text**: complete replacement with same surrounding context (not descriptions or pseudocode)
- **Rationale**: one sentence explaining why
- **Dependencies**: other items that must be applied first

Line numbers are informational only. The current-text block with anchored context is the canonical match target.

**Rules:**
- Agents must read the actual artifact to produce current-text blocks — do not guess
- Each fix is self-contained
- Cross-cutting dependencies noted explicitly
- Multiple agents may produce competing fixes; facilitator reconciles (prefer most specific fix, prefer fewest files touched, prefer root-cause fix over symptom fix)
- Fix artifacts are authored by agents but **applied manually by the owner or facilitator** unless automated application has been explicitly designed with single-writer semantics

**Skip when:** Zero FIX NOW items.

**Expedited:** If Round 2 is unanimous, skip Round 3 → go to Round 4.

### Pre-Archive Gate: Dissent Audit (MANDATORY)

Before moving a completed review from active scratch (e.g., `.board-review-temp/<topic>/`) to its canonical archive location (e.g., `docs/External-Board-Reviews/<MMDDYY>-<topic>/`), the facilitator MUST produce a full dissent audit.

**What the audit must enumerate:**

- Every FIX NOW, DEFER, INFO, blind spot, meta-dissent, and non-trivial nuance raised in R1
- Every ADJUST, new FIX NOW, withdrawn position, and explicit non-escalation raised in R2 (and R3 if R4 occurred)
- For each item: source (agent + round), R2 vehicle (FN/D/I ID, consolidated-finding ID, or "author-withdrawn"/"explicitly absorbed"), and final-round resolution (CONFIRM / SECOND / applied-via-A-N / carry-forward / explicit drop with rationale)

**Pass criterion: ZERO silent drops.**

A "silent drop" is any dissent item that appears in an R1 or R2 response but does not appear in the final-round applied set AND has no explicit disposition (author withdrawal, non-escalation with agent acknowledgement, or rationale-documented drop). Silent drops fail the gate.

**Placement:** The dissent audit lives in the `CONSOLIDATION.md` as its own section, separate from the verdict matrix and the applied-set description. It must be readable standalone.

**Why this gate exists:**

- R2 briefs must include all dissent items for stateless agents to vote on them. Without a pre-archive audit, items dropped at R1→R2 handoff can reach the archive without the owner noticing.
- Archives are the canonical record of governance. Incomplete archives erode the trust the process earns.
- The audit itself is cheap — 5-15 minutes for a 3-round review. Running it before archival catches handoff regressions at their cheapest point.

**Skip only when:** Zero dissent items raised across all rounds (extremely rare; record "No dissents raised" as the audit result).

**Anti-pattern flagged below as well:** "Archiving without dissent audit" → Run the audit; zero silent drops is the pass criterion.

---

## 5. Brief Requirements

The brief is everything. Agents are ephemeral — they know nothing except what's in the brief. They have zero memory of prior reviews, prior rounds in previous sessions, or any context not explicitly provided. If you don't give it to them, they don't have it.

### What goes in every brief

**Required:**
- Context (what, why, audience)
- Full artifact inline — code, diff, document, plan. Never summarize what agents can read themselves.
- Evaluation criteria
- Output format
- **Deferred items** (see below)
- **Broader context** when the artifact touches systems or decisions beyond its own scope — architecture, upstream dependencies, deployment environment, user constraints, prior decisions

### Deferred items are active context

Include all deferred items in every brief. Sources: tasks with `"status": "deferred"` in `tasks.json` (primary), and `DEFERRED_WORK.md` (legacy). Frame deferred items as evaluation targets, not exclusions:

> "Evaluate whether your review triggers any of these deferred items. If a trigger condition is met by the artifact under review, promote to FIX NOW with evidence."

Never say "do not re-raise unless triggered" — agents interpret this as "ignore." The whole point of carrying deferred items forward is that agents check whether the current work triggers them.

### Broader context

Agents reviewing a diff need to understand what the diff is changing and why. Agents reviewing a plan need to understand the system the plan operates in. Always ask: what context would a knowledgeable new reviewer need to evaluate this artifact? Include it.

Examples:
- Reviewing an auth change? Include how credentials reach agents, what CLIs are involved.
- Reviewing a deployment plan? Include the current state, what exists, what's changing, what's staying.
- Reviewing a business decision? Include the constraints, stakeholders, prior commitments.

### Size limits

If artifact exceeds ~50KB: executive summary + full text + section index. Over ~100KB: split into focused sessions.

---

## 6. Finding Format

**Agent report:**
```
## Finding [N]: [Title]
- **ID**: [Domain]-[Round]-[Number]
- **Severity**: FIX NOW / DEFER / INFO
- **Section**: [Which part]
- **Issue**: [2-3 sentences]
- **Impact**: [What happens if not addressed]
- **Fix**: [Specific recommendation]
```

**Consolidation:**
```
### C[N]: [Title]
**Agents:** [Who raised it]  **Severity consensus:** [agree/split]
**Issue:** [Merged]  **Fix:** [Best from all agents]
**Trigger:** [For DEFER only]
```

**Fix Artifact (post-confirmation):**
```
### C[N]: [Title]
**Location:** [exact file/section/clause]
**Current:** [verbatim text with 3+ lines surrounding context]
**Replacement:** [exact replacement with same context]
**Rationale:** [one sentence]
**Dependencies:** [other C-items to apply first, if any]
```

---

## 7. Owner Directives

Override agent positions. Issued between rounds, included in next brief. Must include rationale so agents can apply the spirit, not just the letter. Agents may note disagreement but must comply.

---

## 8. Anti-Patterns

| Anti-Pattern | Instead |
|-------------|---------|
| Skipping blind review | Always run Round 1 blind |
| DEFER as "won't do" | DEFER with trigger, track in tasks.json (status=deferred) |
| "Do not re-raise deferred items" | Include full deferred list as active evaluation targets |
| Briefs without full artifact | Inline everything — agents can't read what isn't there |
| Briefs without broader context | Include architecture, environment, constraints agents need |
| Assuming agents remember prior rounds | Every round is a fresh session — provide ALL context |
| Continuing after agent failure without retry | Retry failed agents — 3-agent minimum needs all 3 |
| Running standard review with fewer than 3 agents | Validate agent count before Round 1 — warn and get approval |
| Ignoring severity disagreements in consolidation | Apply tiebreaking rules (Section 4, Round 2) |
| Sequential agent runs | Parallel per round |
| Override without rationale | Always explain why |
| More than 5 rounds | 3-4 is the sweet spot |
| Unanimous → more rounds | Skip to confirmation |
| Abstract "fix" descriptions in FIX NOW items | Author concrete BEFORE/AFTER fix artifacts post-confirmation |
| Applying fixes without verifying current text | Verify current-text blocks match artifact before replacing |
| Automated fix application without single-writer design | Fix artifacts are manual-only until single-writer semantics are designed |
| R2 brief containing only FIX NOW convergence | Include ALL R1 dissent items (FIX NOW + DEFER + INFO + blind spots). Stateless agents can't vote on what they can't see. |
| Archiving without dissent audit | Run the dissent audit (see Section 4 Pre-Archive Gate). Zero silent drops is the pass criterion. |

---

## Quick Reference

```
Minimum (3 rounds): Blind → Consolidation → Confirmation [→ Fix Artifacts if FIX NOW] → Dissent Audit → Archive
Full (4 rounds):    Blind → Consolidation → Deliberation → Confirmation [→ Fix Artifacts if FIX NOW] → Dissent Audit → Archive

Severity: Wrong/dangerous? → FIX NOW. Real but not now? → DEFER (trigger). Worth noting? → INFO.
Verdicts: R1: findings. R2: AGREE/DISAGREE/MODIFY. R3: AGREE/BLOCK. R4: SIGN OFF/BLOCK.
Pre-archive: Dissent audit mandatory. Zero silent drops = pass.
```
