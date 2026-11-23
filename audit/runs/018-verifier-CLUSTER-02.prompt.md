ORCHESTRATOR CONTEXT (non-interactive run, role: VERIFIER)
- No human is available. You cannot ask questions. If a STOP CONDITION applies, write the reason to audit/runs/STOP-CLUSTER-02.md
  and exit without changing tracker statuses.
- Work ONLY on: CLUSTER-02 (items to verify: F-007, F-008)
- Follow the MASTER RULEBOOK in AGENTS.md. The orchestrator independently re-runs tests and checks; claims without
  evidence will be rejected.
- CRITICAL EXECUTION CONSTRAINTS:
  1. DO NOT launch long-running background servers, daemons, or watchers (e.g. NEVER run 'pnpm dev', 'pnpm dev:client', 'vite', 'tsx watch', or background listeners). All commands must terminate.
  2. For tests, execute targeted test files synchronously (e.g. 'npx vitest run <file>').
  3. Ensure commands execute cleanly and output verifiable results.
---
Follow the MASTER RULEBOOK. You are the VERIFIER, not the author. Assume the fix is WRONG until proven right.
You did not write this code and must not rely on the fixer's claims or summaries; use only what you observe.

Verify every item currently FIXED-UNVERIFIED in cluster CLUSTER-02.

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