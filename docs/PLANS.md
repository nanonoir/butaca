# Execution Plans (ExecPlans)

This document defines how ExecPlans are written, tracked, and archived in the repository.

## What is an ExecPlan?

An ExecPlan is a living execution guide for non-trivial tasks (features, complex refactors, infrastructure changes, multi-step migrations). It provides context, scope, progressive task tracking, and records the final outcome.

## Directory Structure

- `docs/exec-plans/active/`: ExecPlans currently in progress.
- `docs/exec-plans/completed/`: ExecPlans whose execution and verification are finished.
- `docs/exec-plans/tech-debt-tracker.md`: Concrete unresolved technical debt identified during execution or maintenance.

## Lifecycle

1. **Creation**: When starting a complex task, create `docs/exec-plans/active/YYYY-MM-DD-<topic>.md`.
2. **Execution**:
   - Update checkboxes as steps complete.
   - Record decisions or deviations directly in the document.
   - Keep validation evidence (commands run and test results).
3. **Completion**:
   - Append the final outcome section with evidence.
   - Move the file to `docs/exec-plans/completed/YYYY-MM-DD-<topic>.md`.

## Standard ExecPlan Structure

Every ExecPlan should record:

1. **Objective**: Concrete goal and motivation.
2. **Context & References**: Relevant specs, design docs, existing code, and constraints.
3. **Scope**:
   - In-scope items.
   - Explicitly out-of-scope items.
4. **Execution Plan**: Structured phases and tasks with checkboxes (`- [ ]`).
5. **Decisions & Deviations**: Architectural or technical choices made during execution.
6. **Validation & Verification**: Exact commands run and observed outcomes.
7. **Implementation Outcome**: Final summary of delivered changes and handoff notes.
