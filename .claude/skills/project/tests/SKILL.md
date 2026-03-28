---
name: project-tests
description: Generate test specs (Skeptic writes) and verify test code (Skeptic reviews). Two modes — /project tests for specs, /project tests --verify for code review.
---

# Project Tests — Specs & Verification

Two modes that implement Touchpoints 3 and 4. The adversarial verification fix — Skeptic writes test specs, implementing Claude writes test code, Skeptic reviews the code against its own specs.

---

## Mode 1: Write Test Specs (`/project tests` — Touchpoint 3)

### Step 1: Gather Test Criteria

Read `tasks.json` v2. For each task in the active phase:
- Extract `test_criteria` and `done_when`
- Read relevant `SPEC.md` sections

### Step 2: Write Skeptic's Inbox

Compose a brief for Skeptic only:

**inbox/brief.md:**
> You are reviewing test criteria for Phase {N}: {phase name}.
>
> For each task below, write test specifications as structured prose. Cover:
> - Happy path scenarios
> - Edge cases and boundary conditions
> - Error conditions and failure modes
> - Integration points (if applicable)
>
> Format each spec with the task ID as a header. Be specific — "test error handling" is not a spec. "Verify that a 401 response returns JSON `{error: 'unauthorized'}` and does not leak stack traces" is.
>
> Tasks:
> {task list with test_criteria and done_when}

### Step 3: Run Skeptic (Quick mode)

Write inbox, invoke `/run` in Quick mode with Skeptic only. 1 round.

### Step 4: Save Specs

After Skeptic produces specs:
1. Create `docs/test-specs/` directory if it doesn't exist
2. Save each task's spec to `docs/test-specs/{task-id}.md`
3. Update each task's `test_spec` field in `tasks.json` to point to the spec file

> Test specs written by Skeptic:
> - `docs/test-specs/APP-001.md` — 6 test scenarios
> - `docs/test-specs/APP-002.md` — 4 test scenarios
>
> Now implement the tests. When ready, run `/project tests --verify` for Skeptic to review your test code.

---

## Mode 2: Verify Test Code (`/project tests --verify` — Touchpoint 4)

This is the adversarial verification. The implementing Claude cannot self-grade — Skeptic checks the homework.

### Step 1: Gather Test Code + Specs

For each task in the active phase with a `test_spec`:
1. Read the spec from `docs/test-specs/{task-id}.md`
2. Find and read the implemented test files (check `verification.test_command` for hints, or scan common test directories)

If no test specs exist:

> No test specs found. Run `/project tests` first to have Skeptic write specifications.

If no test code exists:

> Test specs exist but no test code found. Write the tests first, then run `/project tests --verify`.

### Step 2: Write Skeptic's Inbox

**inbox/brief.md:**
> You previously wrote test specifications for Phase {N}. Now review the actual test code against your specs.
>
> For each task, compare the implemented tests against the specification. Flag:
> - **Missing scenarios** — specs you wrote that have no corresponding test
> - **Weak assertions** — tests that pass trivially (e.g., `expect(true).toBe(true)`, `assert response.status`)
> - **Wrong coverage** — tests that test something other than what the spec describes
> - **Missing edge cases** — edge cases in your spec that aren't tested
>
> Use FIX NOW for missing or trivially-passing tests. Use INFO for style preferences.
>
> {For each task: spec content + test code content}

### Step 3: Run Skeptic (Quick mode)

Write inbox, invoke `/run` in Quick mode with Skeptic only. 1 round.

### Step 4: Process Results

Read Skeptic's report. For each FIX NOW finding:
1. Reopen the relevant task (`status: "open"`, clear `verification`)
2. Add finding details to the task description
3. Set `source: "board-review-T4"`

> Skeptic reviewed your test code against specs:
> - APP-001: PASS — all 6 scenarios covered
> - APP-002: FIX NOW — 2 missing edge cases, 1 weak assertion
>
> APP-002 reopened. Fix the tests, then run `/project tests --verify` again.

If all pass:

> All test code verified against Skeptic's specs. Tests are good.
> Run `/project next` to continue.
