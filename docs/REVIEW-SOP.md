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

### Round 1: Blind Review
Independent analysis. Brief contains: full artifact inline, context, evaluation criteria, output format. Agent writes numbered findings with severity. Facilitator collects — does not share between agents.

### Round 2: Consolidation
Facilitator groups findings by theme, assigns IDs (C1, C2...), notes agreement/disagreement, applies owner directives, classifies each item. Brief to agents contains: consolidated items with anonymized positions, proposed classifications, owner directives. Agents respond: AGREE / DISAGREE (with rationale) / MODIFY (with alternative).

### Round 3: Deliberation (if needed)
Only for disputed items. Agent positions now visible with names. Agents state AGREE or BLOCK. Skip if Round 2 is unanimous.

### Round 4: Confirmation
Final brief: all items with classifications and resolution. Agents state SIGN OFF or BLOCK. Complete when all sign off, or owner overrides remaining blocks with rationale.

**Expedited:** If Round 2 is unanimous, skip Round 3 → go to Round 4.

---

## 5. Brief Requirements

The brief is everything. Agents are ephemeral — they know nothing except what's in the brief.

**Required:** Context (what, why, audience), full artifact inline, evaluation criteria, output format.

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

---

## 7. Owner Directives

Override agent positions. Issued between rounds, included in next brief. Must include rationale so agents can apply the spirit, not just the letter. Agents may note disagreement but must comply.

---

## 8. Anti-Patterns

| Anti-Pattern | Instead |
|-------------|---------|
| Skipping blind review | Always run Round 1 blind |
| DEFER as "won't do" | DEFER with trigger, track in DEFERRED_WORK.md |
| Briefs without full artifact | Inline everything |
| Sequential agent runs | Parallel per round |
| Override without rationale | Always explain why |
| More than 5 rounds | 3-4 is the sweet spot |
| Unanimous → more rounds | Skip to confirmation |

---

## Quick Reference

```
Minimum (3 rounds): Blind → Consolidation → Confirmation
Full (4 rounds):    Blind → Consolidation → Deliberation → Confirmation

Severity: Wrong/dangerous? → FIX NOW. Real but not now? → DEFER (trigger). Worth noting? → INFO.
Verdicts: R1: findings. R2: AGREE/DISAGREE/MODIFY. R3: AGREE/BLOCK. R4: SIGN OFF/BLOCK.
```
