---
name: project-status
description: Show project lifecycle dashboard. Run when the user types /project status or asks about project progress.
---

# Project Status — Dashboard

Read-only view of project lifecycle state. No writes.

---

## Step 1: Read and Validate

Read `tasks.json`. If it doesn't exist or `meta.version` is not 2, stop:

> No lifecycle found. Run `/project init` to set one up.

---

## Step 2: Show Dashboard

Display:

### Phase Overview

```
Phase 0: Pre-flight .............. complete ✓  (tagged: lifecycle/phase-0-complete)
Phase 1: Core Architecture ....... active      (3/7 tasks closed)
Phase 2: API Integration ......... planned
Phase 3: Polish & Ship ........... planned
```

### Current Phase Detail

```
Phase 1: Core Architecture
Goal: {goal}
Started: {date}

Tasks:
  ✓ APP-001  Wire Supabase auth          closed   (verified 2026-03-28)
  ✓ APP-002  Database schema              closed   (verified 2026-03-28)
  → APP-003  API route handlers           in-progress
  ○ APP-004  Error handling middleware     open
  ○ APP-005  Input validation             open
  ⊘ APP-006  Rate limiting                deferred (trigger: >100 users)
```

### Diagnostics

Flag inconsistencies:
- Phase N active but Phase N-1 has unclosed tasks
- Closed tasks missing verification fields
- In-progress tasks with no recent activity (>7 days since status change)
- Deferred tasks without trigger conditions
- Active phase with all tasks closed but no phase exit review

---

## Step 3: Suggest Next Action

Based on state:

| State | Suggestion |
|-------|-----------|
| All tasks open, none picked | `/project next` to pick a task |
| In-progress tasks exist | Continue working, or `/project next` when done |
| All tasks closed, no exit review | `/project review` for Phase Exit (T5) |
| Phase exit approved | `/project next` to advance to next phase |
| All phases complete | `/project ship` to trigger final review |
| Verification gaps | Fill verification fields before requesting phase exit |
| Deferred items with met triggers | Promote deferred tasks — triggers appear to be met |
