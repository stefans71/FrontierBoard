---
name: brief
description: Set the context for an upcoming review. Run when the user types /brief, describes something they want reviewed, or wants to change what the board is focused on. Also triggered automatically when the user asks the board to review something in plain language.
---

# Board of Governance — Brief

Prepare the board for a specific review. Activate an existing context or write a new one, then populate each agent's inbox.

---

## Step 1: Understand What's Being Reviewed

If `/brief` without context:

> What do you want the board to review? Describe it in plain language — a file, a decision, a proposal, a document, a question.

If triggered by plain language, confirm what you understood before proceeding.

---

## Step 2: Detect the Domain

Identify domain (software, business, HR, finance, legal, etc.) from the user's description. Check `.board/board/{agent}/contexts/` for existing context files.

If matching context exists: offer to use it or tailor further. If no match: tell the user you'll write one now and save it for future reviews.

---

## Step 3: Write or Activate Context

Existing context → read it. New context → write `.board/board/{agent}/contexts/{domain}.md` for each agent. A context file gives the agent a domain-specific lens — what to look for, what questions to ask. It does not change their identity. Write each one for that specific agent's angle applied to this domain.

---

## Step 4: Load Deferred Work

If `.board/board/DEFERRED_WORK.md` exists, read it. Include in the brief so agents know what's already been flagged, what triggers exist, and whether any triggers may have fired.

---

## Step 5: Write the Review Brief

Round 1 (Blind Review) brief — same for all agents:

1. **Context** — what is this, why, who's the audience
2. **The artifact** — full text, inline (agents are ephemeral)
3. **Evaluation criteria** — what to evaluate
4. **Deferred items** — from DEFERRED_WORK.md, clearly marked: "do not re-raise unless trigger met"
5. **Output format** — finding ID, severity (FIX NOW/DEFER/INFO), section, issue, impact, fix
6. **User concerns** — anything the user specifically flagged

If artifact exceeds ~50KB: executive summary + full text + section index. Over ~100KB: split into sessions.

---

## Step 6: Populate Inboxes

For each agent: copy context to `inbox/context.md`, brief to `inbox/brief.md`, clear previous `outbox/report.md`.

> Brief is ready in all inboxes. Want me to run the board now, or review the brief first?

---

## Round 2+ Briefs

The `/run` skill handles subsequent round briefs. If the user asks to re-brief between rounds (add a directive, change the question), this skill runs again. Always include: previous findings with positions, owner directives, deferred items, and the original artifact (ephemeral agents need it every round).
