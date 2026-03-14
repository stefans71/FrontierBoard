---
name: new-agent
description: Add a new agent to the board. Run when the user types /new-agent or asks to add an agent, a new perspective, or a new board member.
---

# Board of Governance — New Agent

Add a new agent to the board. Same conversational approach as setup — ask what the user needs, build it for their situation.

---

## Step 1: Read the Board

Read `.board/board/BOARD.md` to understand the current board composition — who's on it, what CLIs are in use, whether a board user exists.

---

## Step 2: Describe the New Agent

Ask:

> Tell me about the new agent. What's their role on the board and what's their angle?

If the user isn't sure, remind them of the existing agents and ask what perspective is currently missing from the board.

Ask which CLI they want this agent to use. If the board already uses a particular CLI, mention that authentication is already handled and adding another agent on that same CLI is quick.

---

## Step 3: CLI Check

Check whether the CLI for this new agent is already installed and authenticated.

If it's already in use by another agent on this board, it's ready — no setup needed. Tell the user and move on.

If it's new to this board, offer to walk through installation and authentication. Follow the same approach as `/setup` Step 5 (CLI Setup) for that specific CLI.

If a board user exists, make sure the new CLI's credentials are also accessible to that user.

---

## Step 4: Build the Agent

Create the agent directory, settings bubble, CLAUDE.md, inbox, outbox, learnings, and contexts folder — following the same approach as `/setup` Step 6 (Build the Agents).

Write the CLAUDE.md from the user's description. Make it specific. This agent should sound distinct from the others already on the board.

For contexts: check what contexts already exist for the other agents. Write matching contexts for this new agent so they can participate in existing review domains. If the board has a software context and a business context, write both for the new agent.

---

## Step 5: Update BOARD.md

Add the new agent to `.board/board/BOARD.md` — their directory, CLI, model, role description, and invocation command.

Update the parallelism pattern to include the new agent.

---

## Step 6: Smoke Test

Run the same quick smoke test as setup — ask the agent to confirm identity and write a report. Confirm the report appears in their outbox before declaring success.

---

## Step 7: Done

Tell the user the new agent is ready and show them the updated board composition.
