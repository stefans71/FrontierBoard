---
name: brief
description: Set the context for an upcoming review. Run when the user types /brief, describes something they want reviewed, or wants to change what the board is focused on. Also triggered automatically when the user asks the board to review something in plain language.
---

# Board of Governance — Brief

Prepare the board for a specific review. Either activate an existing context or write a new one, then populate each agent's inbox with a tailored brief for this question.

---

## Step 1: Understand What's Being Reviewed

If the user typed `/brief` without context, ask:

> What do you want the board to review? Describe it in plain language — a file, a decision, a proposal, a document, a question.

If this was triggered by a plain language request (e.g. "have the board look at this pricing model"), you already know. Confirm back what you understood before proceeding.

---

## Step 2: Detect the Domain

Based on what the user described, identify which domain this falls into — software, business, HR, finance, legal, or something else.

Check `board/{agent}/contexts/` for each agent to see what context files already exist.

If a matching context exists for all agents, tell the user:

> I have a [domain] context ready for all agents. Want me to use that, or tailor the brief more specifically to this particular question?

If no matching context exists, tell the user:

> I don't have a [domain] context yet. I'll write one now — it'll be saved for future reviews of this type.

---

## Step 3: Write or Activate Context

**If using an existing context:** Read it to understand the domain lens each agent will apply.

**If writing a new context:** For each agent, write a context file at `board/{agent}/contexts/{domain}.md`.

A context file gives the agent a domain-specific lens — what to look for in this type of question, what questions to ask, what a good finding looks like here. It does not change the agent's identity. It focuses their attention.

A software context for a skeptic asks different questions than a software context for a systems thinker. Write each one for that specific agent's angle applied to this domain.

---

## Step 4: Load Deferred Work

Check if `board/DEFERRED_WORK.md` exists. If it does, read it — these are items deferred from prior reviews that are still ACTIVE.

Deferred items must be included in the brief so agents know:
- What's already been flagged and intentionally deferred
- What trigger conditions exist
- Whether any trigger conditions may have been met by the artifact being reviewed

This prevents agents from re-raising known deferred items as new findings, and helps them spot when a deferred item's trigger has fired.

---

## Step 5: Write the Review Brief

Write a review brief for Round 1 (Blind Review). This is the same for all agents — independent review of the same question is the point.

The brief should cover:

1. **Context** — What is this artifact? Why does it exist? Who is the audience?
2. **The artifact itself** — Full text, inline. Agents are ephemeral — they cannot access external files. If the artifact is code, include the full source. If it's a document, include the full text. If it exceeds ~50KB, provide an executive summary + full text + section index.
3. **Evaluation criteria** — What specifically should the agent evaluate?
4. **Deferred items** — Include the contents of `board/DEFERRED_WORK.md` (if any) under a clearly marked section: "Previously deferred items — do not re-raise these unless a trigger condition has been met."
5. **Output format** — Finding ID, severity (FIX NOW / DEFER / INFO), section reference, issue, impact, fix. Use the format from `docs/REVIEW-SOP.md`.
6. **Any specific concerns** the user has flagged

---

## Step 6: Populate Inboxes

For each agent:
1. Copy the domain context file to `inbox/context.md`
2. Copy the brief to `inbox/brief.md`
3. Clear any previous `outbox/report.md`

Tell the user:

> Brief is ready in all inboxes. Want me to run the board now, or do you want to review the brief first?

If they want to run now, follow the `/run` skill. If they want to review first, show them the brief and wait.

---

## Step 7: Save the Context (If New)

If a new context was written, confirm it's saved in each agent's contexts folder. Tell the user:

> I've saved a [domain] context for your board. Next time you ask for a [domain] review, I'll use it automatically — or you can ask me to tailor it further.

---

## Round 2+ Briefs

When the `/run` skill needs briefs for subsequent rounds, it handles the brief writing itself (consolidation brief, deliberation brief, confirmation brief). However, if the user asks to re-brief between rounds — for example, to add a directive or change the question — this skill runs again.

For Round 2+ briefs, always include:
- Previous round's findings (consolidated items with agent positions)
- Owner directives clearly marked
- Deferred items from `board/DEFERRED_WORK.md`
- The original artifact (agents are ephemeral — they need it every round)
