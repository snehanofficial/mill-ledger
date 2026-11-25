ORCHESTRATOR CONTEXT (non-interactive run, role: FIXER)
- No human is available. You cannot ask questions. If a STOP CONDITION applies, write the reason to audit/runs/STOP-CLUSTER-01.md
  and exit without changing tracker statuses.
- Work ONLY on: CLUSTER-01, findings F-010 ONLY (leave other findings in this cluster untouched; they are blocked, parked or not yet due)
- Follow the MASTER RULEBOOK in AGENTS.md. The orchestrator independently re-runs tests and checks; claims without
  evidence will be rejected.
- CRITICAL EXECUTION CONSTRAINTS:
  1. DO NOT launch long-running background servers, daemons, or watchers (e.g. NEVER run 'pnpm dev', 'pnpm dev:client', 'vite', 'tsx watch', or background listeners). All commands must terminate.
  2. For tests, execute targeted test files synchronously (e.g. 'npx vitest run <file>').
  3. Ensure commands execute cleanly and output verifiable results.
---
Follow the MASTER RULEBOOK. You are the FIXER. Fix exactly ONE cluster: CLUSTER-01.

PREFLIGHT (stop and report if any fails)
  1. Read /audit/tracker/tracker.json and /audit/tracker/clusters.md. Confirm every dependsOn item is VERIFIED.
  2. `git status` clean, on branch remediation/main. Run typecheck, lint, test and the invariants script. Compare with
     /audit/baseline. If something is already red that was not red at baseline, STOP and report; do not build on a
     broken base.
  3. If the cluster is marked needsApproval (schema, permission model, or public API), present the exact plan and
     the migration or interface diff, then STOP and wait for my "approved".

FIX PROCEDURE (for each finding in the cluster, in order; one commit per finding, message "F-###: <title>")
  A. Re-reproduce on the current tree. Save before-evidence (output, screenshot, trace). If it no longer reproduces,
     say so with evidence; do not "fix" it.
  B. Find the ROOT CAUSE. Write down file:line and why it happens. Never patch a symptom.
  C. SIBLING SWEEP: search the whole codebase (server, client, scripts, seed, tests) for the same pattern using at
     least two different search methods (text search and AST or type-based). Record the commands and every hit.
     Fix every true sibling in this cluster, or create a new tracker item for any you will not fix now.
  D. Write the regression test FIRST. Run it and show it FAILING on the unfixed code. For domain logic include a
     property-based test where it makes sense. For permissions add the rows to the role x endpoint matrix test.
     For UI add a Playwright test with an axe check and a keyboard-path check.
  E. Implement the smallest correct fix. Rules:
       - Database rules belong in the database (constraints, triggers, grants), not only in application code.
       - Use Decimal for all money and quantities end to end. No Number() on money.
       - Validate with one shared schema used by client and server.
       - No new dependency unless verified to exist (`pnpm view`), maintained, and necessary; state the check.
       - No unrelated refactors, renames, or formatting changes. No TODO comments; if work remains, add a tracker item.
       - No placeholder copy, mock data, or silent try/catch that hides errors.
       - Library usage must be checked against the installed version's docs or types (E4).
  F. Verify locally: the new test passes; run the full test suite, typecheck, lint, the invariants script, and
     check-tracker.mjs. Show raw output. Re-run the original repro and save after-evidence.
  G. If the change touches any UI: run axe on the changed routes, do a keyboard-only pass, check at 320 px, check
     Tamil, emulate prefers-reduced-motion, and confirm no new layout shift. Save the evidence.
  H. Update the tracker item to FIXED-UNVERIFIED with commit, test path, evidence links, sibling sweep record.
     You may NOT set VERIFIED.

DIFF DISCIPLINE
  - If the diff for one finding exceeds roughly 400 changed lines, stop and split it into smaller tracker items.
  - Print `git diff --stat` and a plain-language summary of what changed and why per finding.

STOP CONDITIONS (stop and ask me)
  - A required decision is missing; the fix needs a schema, permission, or public API change not yet approved;
    a test you need cannot be made deterministic; fixing this would break another cluster's assumption.

END OF SESSION REPORT
  - Table: finding | status now | commit | test | sibling hits fixed | new items created.
  - Anything you could not verify, labeled UNVERIFIED with the human steps.

AUTONOMOUS APPROVAL: the schema, permission or public API change for F-010 is pre-approved. Do not stop to ask. Keep migrations forward-only, additive where possible, with a data-safe backfill, and prove them on a fresh database AND on seeded data.


ORCHESTRATOR FEEDBACK FROM THE PREVIOUS ATTEMPT (address this first). For any item already at FIXED-UNVERIFIED, record FIXED-UNVERIFIED -> REJECTED -> IN-PROGRESS in statusHistory with the note "orchestrator check failed", then fix:
The agent made no commits. A fix must be committed (one commit per finding, with its regression test).

No item reached FIXED-UNVERIFIED (current: F-010=OPEN). Fix, commit, add the regression test, record fixCommit and regressionTest in the tracker, and set FIXED-UNVERIFIED.

Uncommitted changes remain after the fix:
?? server/src/invoice-rounding.test.ts

CHECK_CMD failed:
$ pnpm -r run typecheck
Scope: 3 of 4 workspace projects
shared typecheck$ tsc --noEmit
shared typecheck: Done
client typecheck$ tsc -b --noEmit
server typecheck$ tsc --noEmit
client typecheck: Done
server typecheck: src/invoice-rounding.test.ts(6,1): error TS6133: 'Prisma' is declared but its value is never read.
server typecheck: src/invoice-rounding.test.ts(113,19): error TS18047: 'invoice' is possibly 'null'.
server typecheck: src/invoice-rounding.test.ts(114,19): error TS18047: 'invoice' is possibly 'null'.
server typecheck: src/invoice-rounding.test.ts(115,19): error TS18047: 'invoice' is possibly 'null'.
server typecheck: src/invoice-rounding.test.ts(116,19): error TS18047: 'invoice' is possibly 'null'.
server typecheck: src/invoice-rounding.test.ts(117,19): error TS18047: 'invoice' is possibly 'null'.
server typecheck: src/invoice-rounding.test.ts(118,19): error TS18047: 'invoice' is possibly 'null'.
server typecheck: src/invoice-rounding.test.ts(120,18): error TS18047: 'invoice' is possibly 'null'.
server typecheck: src/invoice-rounding.test.ts(231,19): error TS18047: 'invoice' is possibly 'null'.
server typecheck: src/invoice-rounding.test.ts(232,19): error TS18047: 'invoice' is possibly 'null'.
server typecheck: src/invoice-rounding.test.ts(233,19): error TS18047: 'invoice' is possibly 'null'.
server typecheck: src/invoice-rounding.test.ts(234,19): error TS18047: 'invoice' is possibly 'null'.
server typecheck: src/invoice-rounding.test.ts(235,19): error TS18047: 'invoice' is possibly 'null'.
server typecheck: src/invoice-rounding.test.ts(236,19): error TS18047: 'invoice' is possibly 'null'.
server typecheck: src/invoice-rounding.test.ts(239,26): error TS18047: 'invoice' is possibly 'null'.
server typecheck: src/invoice-rounding.test.ts(240,26): error TS18047: 'invoice' is possibly 'null'.
server typecheck: src/invoice-rounding.test.ts(241,25): error TS18047: 'invoice' is possibly 'null'.
server typecheck: src/invoice-rounding.test.ts(242,27): error TS18047: 'invoice' is possibly 'null'.
server typecheck: src/invoice-rounding.test.ts(366,19): error TS18047: 'invoice' is possibly 'null'.
server typecheck: src/invoice-rounding.test.ts(367,19): error TS18047: 'invoice' is possibly 'null'.
server typecheck: src/invoice-rounding.test.ts(368,19): error TS18047: 'invoice' is possibly 'null'.
server typecheck: src/invoice-rounding.test.ts(369,19): error TS18047: 'invoice' is possibly 'null'.
server typecheck: src/invoice-rounding.test.ts(370,19): error TS18047: 'invoice' is possibly 'null'.
server typecheck: src/invoice-rounding.test.ts(371,19): error TS18047: 'invoice' is possibly 'null'.
server typecheck: Failed
[ELIFECYCLE] Command failed with exit code 2.
Error: ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL

  × "pnpm recursive run" failed in /home/snehan/projects/web/mill-ledger/
  │ server

[ELIFECYCLE] Command failed with exit code 1.

