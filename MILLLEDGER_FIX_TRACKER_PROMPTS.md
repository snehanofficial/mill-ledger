# MillLedger: Fix Tracker and Verified Remediation Prompt Pack

This continues from the audit pack. Your `/audit/` folder (findings, evidence, traceability matrix, final report) is the input.

## The workflow in one picture

```
Prompt 1  Safety net + Tracker build        (once)
Prompt 2  Owner decisions                   (once, you answer, agent records)
   ┌───────────────────────────────────────────────────────────────┐
   │ Per tier (T1 to T11), repeat:                                  │
   │   Prompt 3  FIX one cluster             (session A)            │
   │   Prompt 4  VERIFY it independently     (fresh session B)      │
   │   REJECTED? back to Prompt 3.  VERIFIED? next cluster.         │
   │ End of tier:                                                   │
   │   Prompt 5  TIER GATE                   (fresh session)        │
   └───────────────────────────────────────────────────────────────┘
Prompt 6  Missing-feature vertical slice    (used inside T5 for every missing CRUD, flow or UI)
Prompt 7  Final re-audit and README rewrite (once, fresh sessions)
```

## Rules of the road (read once)

1. **One cluster per session.** A cluster is one root cause and all its siblings. Never "fix everything".
2. **The tracker file is the source of truth**, not the chat. Every session starts by reading it and ends by updating it.
3. **The fixer never closes its own work.** Fixed items become `FIXED-UNVERIFIED`. Only the verification prompt, run in a fresh session (ideally a different model or a different tool), can move an item to `VERIFIED`. Self-review by the same session that wrote the fix is weak evidence.
4. **Build new things right the first time.** Missing features (suppliers CRUD and so on) are built as vertical slices that already meet the accessibility, i18n, performance, validation and audit requirements. The later UI and accessibility tiers then become verification, not retrofitting.
5. **You spot check.** After every tier gate, open 3 random `VERIFIED` items, repeat the repro yourself, and read the diff. If one is wrong, reopen the whole tier.
6. **Schema, permission and public API changes need your approval** before they are applied. The prompts enforce a stop.

---

# PROMPT 1: Safety net and tracker build (run once)

```text
Follow the MASTER RULEBOOK (evidence rules E1 to E11 still apply in full; the AUDIT ONLY restriction is lifted
only for the files this prompt names). Goal: prepare a safe, trackable remediation, and change NO product behavior.

INPUT: /audit/findings/*.md, /audit/99-final-report.md, /audit/02-traceability-matrix.csv,
       /audit/evidence/capability-matrix.csv, /audit/coverage.md

STEP 1. Safety net (create branch `remediation/main`, never work on main)
  a. Confirm a clean working tree. Tag the starting point `audit-baseline`.
  b. Record baseline results (raw output) of: typecheck, lint, test, benchmark, test:e2e, build with bundle sizes,
     and the Phase 2 invariants script. Save to /audit/baseline/. These numbers are the "before".
  c. Make the test harness trustworthy BEFORE fixing anything: tests must run against a real PostgreSQL
     (Testcontainers or a documented docker compose), be repeatable, and not depend on order or leftover data.
     If any baseline test is flaky, list it and quarantine it with a tracked finding. Do not delete it.
  d. Add a minimal CI workflow (typecheck, lint, test, build) if none exists. Do not change application code.
  e. Create a migration policy note: forward-only, one migration per finding, named F-###, never edit an applied migration.

STEP 2. Build the tracker in /audit/tracker/
  - tracker.json  (SOURCE OF TRUTH, one object per work item)
  - tracker.md    (GENERATED view, never hand-edited)
  - check-tracker.mjs  (validator script you must write and run; see rules below)
  - clusters.md   (root-cause groups and dependency graph)
  - owner-decisions.md (open questions that block work)

  Work item fields:
    id (F-### or CLUSTER-##), title, severity (P0..P3), category, tier (T0..T11), cluster, dependsOn[],
    blocks[], relatedFindings[], standardsRefs[], files[], effort (S/M/L), owner (agent/you),
    status, statusHistory[{status, date, commit, evidenceLink}],
    reproCommand, regressionTest (path), fixCommit, verifyEvidence[], siblingSweep (done/not, query used, hits),
    needsApproval (schema/permission/API/none), notes.

  Status state machine (only these, only these transitions):
    OPEN -> IN-PROGRESS -> FIXED-UNVERIFIED -> VERIFIED
    FIXED-UNVERIFIED -> REJECTED -> IN-PROGRESS (verifier found a problem)
    VERIFIED -> REOPENED -> IN-PROGRESS (regression later)
    OPEN/IN-PROGRESS -> BLOCKED (needs dependency or owner decision, name it)
    OPEN -> WONT-FIX (owner-approved only, reason required)
  VERIFIED requires: a regression test that fails without the fix and passes with it, repro evidence before and
  after, a completed siblingSweep, and a verifier identity different from the fixer session.

  check-tracker.mjs must FAIL (non-zero exit) if: an item skips a state, VERIFIED lacks any required field,
  a dependsOn item is not VERIFIED while its dependent is IN-PROGRESS or later, a P0/P1 is WONT-FIX without
  an owner approval note, IDs are duplicated, or tracker.md is out of date with tracker.json.
  Wire it into CI and run it now.

STEP 3. Cluster and order (linear queue)
  - Group findings by ROOT CAUSE (for example "money handled as JS number" is one cluster covering many
    findings, "no central permission layer" is one cluster). Show each finding's cluster with evidence (file:line).
  - Build the dependency graph. A fix that others depend on goes first. Produce a topological order with no cycles
    (report any cycle as a design decision for the owner).
  - Assign tiers, in this default order (justify and show any deviation):
      T0  Safety net (done by Step 1)
      T1  Data integrity: Decimal types, DB constraints, immutability, negative stock, concurrency, invoice numbering
      T2  Authorization foundation: permission model, central policy layer, middleware order, super admin, sessions
      T3  Validation, error envelope, request ID, API log, audit log
      T4  Remaining security findings (OWASP mapped), secrets, headers, rate limits, uploads, exports
      T5  Missing and broken features as vertical slices (Prompt 6), then the end-to-end journeys
      T6  UI/UX findings (NN/g and HIG-adapted), states, forms, tables, ordering screen
      T7  Accessibility and motion findings that remain after T5 and T6 (WCAG 2.2 AA, reduced motion)
      T8  Performance, lazy loading, images, image hash, bundle budgets, DB indexes
      T9  i18n (Tamil) and offline sync
      T10 SEO and public surface
      T11 Code cleanup, test integrity (mutation score), ops, docs
  - For every cluster list the siblings: other places in the codebase with the same pattern, found by a search you
    ran (record the search command). A cluster is not complete if siblings are not listed.

STEP 4. Owner decisions
  - List every open question (for example the meaning of "image hash", GST rate source, which roles exist,
    which scopes (own, team, region, all) apply to which entities, super admin bootstrap method).
  - For each: the options, the consequence of each, and what the agent will assume if no answer (clearly marked
    as an ASSUMPTION that must be confirmed). Items depending on a decision become BLOCKED.

STEP 5. Report
  - Print counts by tier, severity, status; the first 10 items in the queue; every BLOCKED item and what unblocks it.
  - Run check-tracker.mjs and show its output.
  - Do NOT start fixing anything.
```

---

# PROMPT 2: Owner decisions (run once, after you answer)

```text
Follow the MASTER RULEBOOK. I will answer the questions in /audit/tracker/owner-decisions.md below.
Record each answer verbatim in that file with today's date. For each answer:
  - Update every affected work item (unblock, re-scope, or mark WONT-FIX with my approval note).
  - Re-run the dependency ordering and check-tracker.mjs.
  - If an answer contradicts a requirement in /audit/01-expected-spec.md, update the spec, mark the change, and
    list which findings are now invalid or new.
  - If anything I wrote is ambiguous, ask me again. Do not choose for me.

My answers:
<paste your answers here>
```

---

# PROMPT 3: Fix one cluster (the loop; new session each time)

```text
Follow the MASTER RULEBOOK. You are the FIXER. Fix exactly ONE cluster: <CLUSTER-ID or next in queue>.

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
```

---

# PROMPT 4: Independent verification (fresh session; ideally another model or tool)

```text
Follow the MASTER RULEBOOK. You are the VERIFIER, not the author. Assume the fix is WRONG until proven right.
You did not write this code and must not rely on the fixer's claims or summaries; use only what you observe.

Verify every item currently FIXED-UNVERIFIED in cluster <CLUSTER-ID>.

For EACH item run all of these, saving raw output to /audit/evidence/verify/F-###/:
  1. Fresh environment: check out the fix commit into a clean directory, install from the lockfile, fresh database,
     run migrations from zero. If it fails, REJECT.
  2. Original repro: re-run /audit/findings/F-###.md repro steps exactly. The defect must be gone.
  3. Test validity (the important one): temporarily revert ONLY the fix (not the test) in a scratch worktree and
     confirm the regression test FAILS. Then restore it and confirm it passes. A test that passes both ways proves
     nothing: REJECT.
  4. Mutation check: apply one or two deliberate mutations to the fixed logic (flip a comparison, remove a guard,
     change a rounding mode) and confirm the test suite catches each. Report the mutants that survive.
  5. Adversarial probes the fixer may not have thought of, chosen for the finding's category:
       money: boundary values, very large and very small amounts, repeating decimals, rounding ties, negative, zero
       stock/concurrency: 50 parallel requests, retry storms, partial failure mid-transaction
       authz: every role, no role, a stale or revoked session, direct object IDs, mass-assignment, a different
              region's or user's data, direct URL access in the browser
       validation: type confusion, oversize input, unicode, injection strings, replay of the same request
       UI: keyboard only, screen reader announcement, 320 px, 200% zoom, Tamil, reduced motion, offline, slow 3G,
           failure of the API mid-action
  6. Sibling sweep audit: run your OWN search for the same pattern (do not reuse the fixer's queries) and compare
     with the recorded hits. Any missed sibling means REJECT with the hit list.
  7. Regression radius: run the full suite, role x endpoint matrix, role x route matrix, invariants script, and the
     benchmark. Compare to the last green numbers. Compare bundle size, Lighthouse, and query counts with baseline
     for the touched routes. Any regression means REJECT.
  8. Diff review: read the entire diff. Report scope creep, leftover debug code, swallowed errors, `any`, casts,
     disabled lint rules, commented-out code, hardcoded values, magic numbers, new TODOs, copy that is untranslated
     or placeholder, and changes unrelated to the finding.
  9. Standards check for UI items: cite the exact WCAG 2.2 SC, NN/g heuristic, and HIG-adapted principle, and show
     the test or observation proving each. Do not accept "axe has no violations" as sufficient for accessibility.
 10. Expected vs actual: restate the original Expected (with its source), then the Actual you observed, then the Delta.

VERDICT per item: VERIFIED or REJECTED.
  - VERIFIED only if every step above passed with evidence. Update the tracker (status, verifier note, evidence
    links) and run check-tracker.mjs.
  - REJECTED: set REJECTED with the precise failing step, the evidence, and what is expected to change.
  Do not fix anything yourself. Do not edit product code. You may only add verification scripts under
  /audit/scripts/verify and update the tracker.

Final output: table of item | verdict | strongest evidence | surviving mutants | new issues found
(new issues become new tracker items with the correct tier).
```

---

# PROMPT 5: Tier gate (fresh session, end of each tier)

```text
Follow the MASTER RULEBOOK. You are the GATEKEEPER for tier <T#>. Do not fix; only measure and judge.

1. Tracker integrity: run check-tracker.mjs. List every item in this tier by status. The tier passes only if
   every P0/P1/P2 item is VERIFIED or has an owner-approved WONT-FIX. P3 may carry over with a recorded reason.
2. Full clean-room run from the branch tip: fresh clone, install, migrate, seed (dev only), build, typecheck, lint,
   unit and integration with real Postgres, E2E, benchmark, invariants script, check-tracker. Raw output.
3. Re-run the earlier phase checks that this tier could have affected, using the ORIGINAL audit scripts:
     T1: Phase 2 invariants and concurrency tests, ledger reconciliation on 100k+ movements
     T2/T3: role x endpoint matrix and role x UI route matrix (full regenerate, diff against the last), fuzz run,
            log redaction test, middleware order introspection
     T4: semgrep, gitleaks, ZAP baseline, pnpm audit, security header check, CSV injection test
     T5/T6: capability matrix regenerated by clicking through every route for every role, all eight journeys J1..J8,
            dead-button sweep
     T7: axe on every route and role, keyboard walkthrough of the key routes, reduced-motion emulation
     T8: Lighthouse CI against the budgets, bundle analysis, lazy-load scroll proof, EXPLAIN on top queries, k6 run
     T9: i18n untranslated-string scan plus Tamil screenshots, offline replay scenarios
     T10: curl and rendered-DOM checks, sitemap and structured data validation
     T11: knip, depcheck, mutation score, no `any` in the domain layer, README steps re-run from scratch
4. Compare every metric with /audit/baseline and the previous gate. Any metric that got worse is a new finding.
5. Drift check: README and docs vs reality. Update nothing; list every false statement.
6. Report: PASS or FAIL for the tier with a table: check | expected | actual | evidence. List new findings added
   to the tracker. If FAIL, list exactly which items must be reopened.
```

---

# PROMPT 6: Missing feature as a vertical slice (used inside T5)

```text
Follow the MASTER RULEBOOK. Build the missing capability: <ENTITY or FLOW, for example "Suppliers management">.
This is new feature work, so it uses a spec-first process. Fixer rules from PROMPT 3 apply (branch, one commit per
step, tracker updates, no self-verification).

STEP 1. Spec (write to /audit/specs/<slug>.md and STOP for my review if anything is ambiguous)
  - Purpose, users, scopes (which roles, own/team/region/all), permissions as resource:action.
  - Data model (fields, types, Decimal precision, unique and FK constraints, soft delete or archive rules).
  - API (routes, request and response schemas, error codes, idempotency, pagination, filters, sort).
  - UI (routes, screens, states, forms, tables, mobile layout), content in English and Tamil.
  - Audit events and API log fields produced.
  - Acceptance criteria, each testable, each linked to a REQ ID.

STEP 2. Definition of Done: every box must be proven with evidence, not asserted.
  Data and domain
   [ ] Migration forward-only, constraints in the database, indexes for the real queries (EXPLAIN shown)
   [ ] Money and quantities are Decimal end to end; no float math
  API
   [ ] Shared validation schema (client and server), unknown fields rejected, consistent error envelope with requestId
   [ ] Permission checked in the central policy layer AND scoped in the SQL query (IDOR tests added to the matrix)
   [ ] Pagination capped, rate limiting applied, request logged, audit event written with before and after
   [ ] OpenAPI updated from the schemas
  UI and UX
   [ ] List (search, filter, sort, server pagination, empty state), create, view, update, archive/restore
   [ ] Loading skeleton, error with request ID, offline behavior, permission-denied state, success feedback
   [ ] Form: visible labels, units, correct input modes, inline and summary errors, data kept on failure,
       unsaved-changes guard, confirmation for destructive actions that states the consequence
   [ ] Navigation entry shown only to roles with permission; direct URL without permission shows a 403 page
   [ ] Mobile 320 px layout works, touch targets at least 44x44 px, primary action thumb-reachable
  Accessibility (WCAG 2.2 AA, built in now, not later)
   [ ] Keyboard complete, visible focus not obscured, correct names, roles and states, labelled tables
   [ ] Errors announced, focus managed on route change and dialogs, status messages via live regions
   [ ] Contrast verified, no text inside images, reduced motion respected
  Images (if any)
   [ ] Product or supplier images paired with real visible text, alt text correct, width and height set,
       below-the-fold lazy loaded, content-hash filename and placeholder per the owner's decision
  Performance
   [ ] Route is lazy loaded, bundle delta recorded, no N+1 (query count shown)
  i18n
   [ ] Every string in English and Tamil through the translation layer; Tamil layout checked
  Tests
   [ ] Unit and property tests for domain rules, integration tests on real Postgres, Playwright journey for each
       permitted role, role x endpoint rows, axe, and a keyboard-path test
  Docs
   [ ] Permission reference and data dictionary updated

STEP 3. Implement in this order, committing at each: migration -> domain -> API -> permissions -> validation ->
UI -> i18n -> tests -> docs. After each step run the full suite.

STEP 4. Update the tracker to FIXED-UNVERIFIED with the evidence for every DoD line. Do not set VERIFIED.
Verification then goes through PROMPT 4 with the DoD as the Expected.
```

---

# PROMPT 7: Final re-audit and honest README (fresh sessions, once)

```text
Follow the MASTER RULEBOOK. Final re-audit.

1. Run PHASES 0 to 15 again from the original audit pack, each in a fresh session, on the tip of
   remediation/main. Write results to /audit/final/ and keep the original /audit/ untouched for comparison.
2. Delta report: for every original finding, state its final status with evidence. List every NEW finding that
   appeared (regressions introduced by the fixes count as the most serious class). Compare every metric with
   /audit/baseline (tests, bundle sizes, Lighthouse, a11y violations, role matrix, query counts, p95 latency).
3. Exit criteria, each marked VERIFIED-PASS or not with evidence:
     [ ] Zero open P0 and P1; all P2 either VERIFIED or owner-approved WONT-FIX
     [ ] Capability matrix 100% (List, Create, View, Update, Archive, Permission, Audit, i18n, States)
     [ ] Role x endpoint and role x route matrices match the intended model exactly
     [ ] Ledger invariants pass after a randomized stress run; reports reconcile to the ledger
     [ ] Performance budgets pass in CI; lazy loading proven by network waterfall
     [ ] WCAG 2.2 AA: automated plus manual keyboard and screen reader passes recorded; untested SC listed
     [ ] OWASP: no open Top 10:2021 or API Top 10:2023 findings at P0/P1; ZAP, semgrep, gitleaks clean or triaged
     [ ] Backup restore performed and timed; rollback documented
     [ ] A new developer can run the project from the README in 15 minutes (do it in a clean container and time it)
4. Rewrite README.md from VERIFIED FACTS ONLY. Every statement must trace to a passing test, a command output, or
   a file. Remove the benchmark table unless it is regenerated by `pnpm benchmark` on a clean database during this
   run. Add the correct stack description (fix typos), seed warning (dev only), super admin bootstrap steps, role and
   permission reference, env var reference, architecture note, operations runbook, and known limitations
   (every UNVERIFIED item and every WONT-FIX).
5. Final report /audit/final/FINAL.md: what changed, what was proven, what remains unproven and why, what a human
   (accountant for GST, security reviewer, accessibility user testing) must still confirm before go-live.
```

---

## Practical tips

- **Session length.** If an agent starts skimming or claiming things without output, end the session and start a new one. The tracker keeps continuity.
- **Which model for which prompt.** Use your strongest model for Prompts 3 and 6 (fixing and building) and a different model or tool for Prompt 4 (verification) so the same blind spots are not repeated.
- **Cadence.** Per cluster: Prompt 3, then Prompt 4. Per tier: Prompt 5, then you spot check 3 items. Do not skip the gate.
- **Keep the pace honest.** If Prompt 4 rejects more than about a third of the fixes in a tier, stop and fix the process (smaller clusters, better tests) before continuing.
- **Never let the agent "fix the tracker".** If `check-tracker.mjs` fails, the work is wrong, not the validator. Edits to the validator need your approval.
- **Before go-live.** Have a real accountant review the GST output and invoice numbering, have at least one person who uses a screen reader try the key flows, and do a staging dry run with production-like data.
