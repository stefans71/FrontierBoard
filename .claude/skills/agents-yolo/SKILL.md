---
name: agents-yolo
description: Toggle YOLO mode on/off for all board agents. Run when the user types /agents-yolo or asks to change agent permissions, enable/disable YOLO, or switch between autonomous and supervised mode.
---

# Toggle YOLO Mode

Switch all board agents between YOLO (full autonomy) and supervised (permission prompts) mode.

---

## Steps

1. **Find BOARD.md** — Look in `$BOARD/.board/board/BOARD.md` (standard) or `$BOARD/.board/projects/{project}/BOARD.md` (global). If no BOARD.md exists, tell the user to run `/setup` first.

2. **Read current mode** — Find the `yolo_mode:` and `isolation:` fields in BOARD.md. If `yolo_mode` is missing, infer from invocation commands.

3. **Show current state and offer toggle:**

   If currently **YOLO**:
   > Agents are in **YOLO mode** — full autonomy, no permission prompts.
   > Switch to **supervised mode**? Agents will pause before file writes, bash commands, and browser actions.

   If currently **supervised**:
   > Agents are in **supervised mode** — they pause before actions.
   > Switch to **YOLO mode**? Full autonomy: read/write/bash with no prompts. Agents can use browser tools, run commands, explore freely. Recommended for trusted environments.

4. **Apply the toggle** (after user confirms):

   **To YOLO:**
   - Set `yolo_mode: true` in BOARD.md
   - Add `--dangerously-skip-permissions` to all Claude Code invocation commands
   - Add `--dangerously-bypass-approvals-and-sandbox` to all Codex invocation commands
   - Qwen: set sandbox mode to off in agent's `.qwen/settings.json` if applicable

   **To supervised:**
   - Set `yolo_mode: false` in BOARD.md
   - Remove `--dangerously-skip-permissions` from all Claude Code invocation commands
   - Remove `--dangerously-bypass-approvals-and-sandbox` from all Codex invocation commands
   - Qwen: re-enable sandbox if applicable

5. **Confirm** — Show the updated invocation commands so the user can verify.

---

## Notes

- This toggles ALL agents at once. Individual agent permissions aren't supported — it's all or nothing.
- In bare mode running as root with a board user, the permission flags are on the inner command (after `sudo -u`), not the outer shell.
- Integration bridge scripts (`run-review.sh`) may also need updating if they hardcode flags.
