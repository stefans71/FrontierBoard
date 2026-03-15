---
name: brief
description: Set the context for an upcoming review. Run when the user types /brief, describes something they want reviewed, or wants to change what the board is focused on. Also triggered automatically when the user asks the board to review something in plain language.
---

# Board of Governance — Brief

Prepare the board for a specific review. Read `docs/REVIEW-SOP.md` Section 5 (Brief Requirements) before composing any brief — it defines what agents need.

**Key principle:** Agents are ephemeral. They have zero memory of prior reviews, prior conversations, or anything not in their inbox. The brief is everything. If you don't give it to them, they don't have it.

---

## Step 1: Understand What's Being Reviewed

If `/brief` without context:

> What do you want the board to review? Describe it in plain language — a file, a decision, a proposal, a document, a question.

If triggered by plain language, confirm what you understood before proceeding.

---

## Step 2: Detect the Domain and Artifact Type

Identify domain (software, business, HR, finance, legal, etc.) from the user's description. Check `.board/board/{agent}/contexts/` for existing context files.

Also identify the **artifact type** — this determines what broader context agents need:

| Artifact Type | What Agents Need Beyond the Artifact |
|--------------|--------------------------------------|
| **Code diff** | Architecture of the system being changed, what the code does, why the change was made, what CLIs/tools are involved, deployment environment |
| **Plan / proposal** | Current state of the system, what exists today, what's changing, constraints, prior decisions |
| **Architecture** | Problem being solved, scale, team, existing infrastructure, deployment model |
| **Business decision** | Constraints, stakeholders, prior commitments, risk tolerance, timeline |
| **Document / policy** | Audience, enforcement mechanism, existing related docs |

If matching context exists: offer to use it or tailor further. If no match: tell the user you'll write one now and save it for future reviews.

---

## Step 3: Write or Activate Context

Existing context → read it. New context → write `.board/board/{agent}/contexts/{domain}.md` for each agent. A context file gives the agent a domain-specific lens — what to look for, what questions to ask. It does not change their identity. Write each one for that specific agent's angle applied to this domain.

---

## Step 4: Load Deferred Work

If `.board/board/DEFERRED_WORK.md` exists, read the FULL contents. Deferred items are **active evaluation targets** — agents must check whether the current review triggers any of them.

---

## Step 5: Gather Broader Context

Ask yourself: **what context would a knowledgeable new reviewer need to evaluate this artifact?** Agents can't look things up — they only know what's in the brief.

For code reviews, read the relevant source files and include key architecture details. For plans, describe the current state of the system. For business decisions, include constraints and stakeholder context.

Don't assume agents know:
- How the system works
- What tools, CLIs, or frameworks are involved
- What deployment environment exists
- What prior decisions were made and why
- What the user's constraints are

Include what they need. Err on the side of more context, not less.

---

## Step 6: Write the Review Brief

Round 1 (Blind Review) brief — same for all agents:

1. **Context** — what is this, why is it being reviewed, who's the audience
2. **The artifact** — full text, inline. Code diffs in full. Plans in full. Never summarize what agents can read themselves.
3. **Broader context** — system architecture, environment, constraints, prior decisions (from Step 5)
4. **Deferred items** — full contents of DEFERRED_WORK.md, framed as: "Evaluate whether your review triggers any of these deferred items. If a trigger condition is met, promote to FIX NOW with evidence."
5. **Evaluation criteria** — what to evaluate, specific questions if any
6. **Output format** — finding ID, severity (FIX NOW/DEFER/INFO/REJECT), location, finding, recommendation
7. **User concerns** — anything the user specifically flagged

If artifact exceeds ~50KB: executive summary + full text + section index. Over ~100KB: split into sessions.

---

## Step 7: Populate Inboxes

For each agent: copy context to `inbox/context.md`, brief to `inbox/brief.md`, clear previous `outbox/report.md`.

> Brief is ready in all inboxes. Want me to run the board now, or review the brief first?

---

## Round 2+ Briefs

The `/run` skill handles subsequent round briefs. If the user asks to re-brief between rounds (add a directive, change the question), this skill runs again. Always include: previous findings with positions, owner directives, deferred items, and the original artifact (ephemeral agents need it every round).
