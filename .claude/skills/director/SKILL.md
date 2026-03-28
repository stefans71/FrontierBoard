---
name: director
description: Launch the FrontierBoard Director — a planning consultant that helps you design reviews, interpret findings, and steer the board. Run when the user types /director or asks for help planning a review.
---

# FrontierBoard Director

The Director is a separate Claude session that acts as your planning consultant for board reviews. It runs from the board clone directory with its own identity and settings — completely isolated from the orchestrator.

---

## What to Tell the User

> **The Director helps you plan and steer board reviews.**
>
> To use it, open a new terminal and run:
> ```
> cd $BOARD/.board/director && claude
> ```
>
> The Director can help you:
> - **Plan reviews** — decide what to put in front of the board, frame the right questions
> - **Choose review depth** — Quick, Standard, or Custom based on what you're reviewing
> - **Draft briefs** — formulate evaluation criteria, context, and specific questions
> - **Interpret findings** — understand the synthesis, prioritize FIX NOW items
> - **Track deferred work** — review trigger conditions, recommend promotions
> - **Draft owner directives** — steer the board between rounds
>
> The Director reads your project and the board state but does **not** run agents — come back to this session for `/brief` and `/run`.

If `$BOARD/.board/director/CLAUDE.md` does not exist, tell the user: "Director not set up. Re-run /setup to create it."

---

## Notes

- The Director session runs in `$BOARD/.board/director/` — a separate directory with its own CLAUDE.md
- It has read-only access to the project and board state
- It does NOT interfere with the orchestrator session
- The `$BOARD` path is resolved to an absolute path during /setup (per C1 constraint)
