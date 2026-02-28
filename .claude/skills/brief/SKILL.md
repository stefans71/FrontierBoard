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

Based on what the user described, identify which domain this falls into — software, business, HR, finance, or something else.

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

## Step 4: Write the Review Brief

Write a review brief for this specific question. This goes in each agent's inbox.

The brief should cover:
- What is being reviewed — the actual content, file, document, or question
- The specific question the user wants answered
- Any context the agents need to know (background, constraints, what's already been decided)
- What a useful finding looks like for this question
- Any specific concerns the user has flagged

If the user provided a file or document, include its contents or path in the brief.

The brief is the same for all agents — independent review of the same question is the point. Each agent's identity and context shapes how they approach it differently.

---

## Step 5: Populate Inboxes

Write the review brief to each agent's inbox. Name it `REVIEW-{date}-{short-description}.md` — something recognisable.

Tell the user:

> Brief is ready in all inboxes. Want me to run the board now, or do you want to review the brief first?

If they want to run now, follow the `/run` skill. If they want to review first, show them the brief and wait.

---

## Step 6: Save the Context (If New)

If a new context was written, confirm it's saved in each agent's contexts folder. Tell the user:

> I've saved a [domain] context for your board. Next time you ask for a [domain] review, I'll use it automatically — or you can ask me to tailor it further.
