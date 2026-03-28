#!/usr/bin/env node
/**
 * verify-lifecycle.cjs — Phase-aware tasks.json v2 schema validator
 *
 * Runs as:
 *   - Claude Code PostToolUse hook (on Write/Edit to tasks.json)
 *   - .githooks/pre-commit (when tasks.json is staged)
 *
 * Advisory, not security boundary — real enforcement is the board at T5 and T6.
 * Exit 0 = pass, Exit 1 = fail with violation list.
 */

const fs = require('fs');
const path = require('path');

// Find tasks.json — check argument first, then walk up from cwd
const filepath = process.argv[2];
if (filepath && !filepath.endsWith('tasks.json')) {
  // Hook fired for a non-tasks.json file — pass through silently
  process.exit(0);
}

let tasksPath;
if (filepath && fs.existsSync(filepath)) {
  tasksPath = path.resolve(filepath);
} else {
  // Walk up directories to find tasks.json
  let dir = process.cwd();
  while (dir !== path.dirname(dir)) {
    const candidate = path.join(dir, 'tasks.json');
    if (fs.existsSync(candidate)) { tasksPath = candidate; break; }
    dir = path.dirname(dir);
  }
}

if (!tasksPath) {
  // No tasks.json found — nothing to validate
  process.exit(0);
}

let data;
try {
  data = JSON.parse(fs.readFileSync(tasksPath, 'utf8'));
} catch (e) {
  console.error(`verify-lifecycle: Failed to parse ${tasksPath}: ${e.message}`);
  process.exit(1);
}

// Only validate v2 schemas
if (!data.meta || data.meta.version !== 2) {
  process.exit(0);
}

const violations = [];

// Validate meta
if (!data.meta.project) violations.push('meta.project is missing');
if (data.meta.current_phase == null) violations.push('meta.current_phase is missing');

// Validate phases
const phaseIds = new Set();
if (Array.isArray(data.phases)) {
  for (const phase of data.phases) {
    if (phaseIds.has(phase.id)) {
      violations.push(`Duplicate phase ID: ${phase.id}`);
    }
    phaseIds.add(phase.id);

    const validStates = ['planned', 'active', 'complete', 'blocked'];
    if (!validStates.includes(phase.status)) {
      violations.push(`Phase ${phase.id}: invalid status "${phase.status}"`);
    }
  }
}

// Validate tasks
const taskIds = new Set();
if (Array.isArray(data.tasks)) {
  for (const task of data.tasks) {
    if (taskIds.has(task.id)) {
      violations.push(`Duplicate task ID: ${task.id}`);
    }
    taskIds.add(task.id);

    // Phase reference check
    if (task.phase != null && !phaseIds.has(task.phase)) {
      violations.push(`Task ${task.id}: references non-existent phase ${task.phase}`);
    }

    const validStates = ['open', 'in-progress', 'closed', 'deferred'];
    if (!validStates.includes(task.status)) {
      violations.push(`Task ${task.id}: invalid status "${task.status}"`);
    }

    // Closed tasks must have verification
    if (task.status === 'closed') {
      const v = task.verification;
      if (!v) {
        violations.push(`Task ${task.id}: closed but missing verification`);
      } else {
        if (v.tests_passed == null) violations.push(`Task ${task.id}: missing verification.tests_passed`);
        if (!v.test_command) violations.push(`Task ${task.id}: missing verification.test_command`);
        if (!v.test_output_summary) violations.push(`Task ${task.id}: missing verification.test_output_summary`);
        if (!v.verified_at) violations.push(`Task ${task.id}: missing verification.verified_at`);

        // spec_coverage required ONLY when test_spec is non-null
        if (task.test_spec && !v.spec_coverage) {
          violations.push(`Task ${task.id}: has test_spec but missing verification.spec_coverage`);
        }
      }
    }

    // Deferred tasks must have a trigger
    if (task.status === 'deferred' && !task.trigger) {
      violations.push(`Task ${task.id}: deferred but missing trigger condition`);
    }
  }
}

if (violations.length > 0) {
  console.error('verify-lifecycle: tasks.json validation failed:');
  for (const v of violations) {
    console.error(`  - ${v}`);
  }
  process.exit(1);
}

process.exit(0);
