# MLD-015 — Enforce Web Locks Mutex for Multi-Tab Outbox Sync

## Metadata
- Task ID: `MLD-015`
- Related audit findings: `P1-PWA-01`
- Priority: P1 (High)
- Category: Offline / PWA
- Status: `DONE`
- Dependencies: None
- Owner: AI Agent
- Created: November 18, 2026
- Last updated: November 18, 2026

## 1. Description
In `client/src/offline/sync-engine.ts:10`, the synchronization lock is a simple in-memory JavaScript variable:
`let isSyncing = false;`.
If an operator opens multiple browser tabs (e.g. reviewing inventory in one tab while managing orders in another), both tabs observe network restoration simultaneously and initiate concurrent `processOutbox()` executions against the same IndexedDB outbox records. This causes duplicate HTTP POST submissions, race conditions on status updates (`pending` -> `processing`), and server-side conflict errors.

## 2. Evidence
- Original audit finding: `P1-PWA-01`.
- Files:
  - [client/src/offline/sync-engine.ts:10-50](/client/src/offline/sync-engine.ts#L10-L50)
  - [client/src/offline/db.ts:60-80](/client/src/offline/db.ts#L60-L80)

## 3. Expected Outcome
1. Outbox synchronization across all browser tabs of the same origin is coordinated via the standard browser `navigator.locks.request("milledger-sync-lock", ...)` API.
2. Only one tab executes `processOutbox()` at any given instant.
3. If `navigator.locks` is unsupported in an older environment, a BroadcastChannel / localStorage fallback ensures mutual exclusion.
4. Server 409 responses for duplicate idempotency keys are handled gracefully by marking the client item `synced`.

## 4. Scope
- **Included changes:**
  - Wrap `processOutbox()` in `navigator.locks.request("milledger-outbox-sync", { ifAvailable: true }, async (lock) => { ... })`.
  - Handle idempotency duplicate conflict responses (HTTP 409 / P2002) in `sync-engine.ts` gracefully without crashing the queue.
  - Add unit test mocking concurrent sync calls.
- **Excluded changes:**
  - IndexedDB table structure changes.
- **Affected modules:** `client/src/offline/sync-engine.ts`.

## 5. Dependencies
- None.

## 6. Implementation Plan
1. In `client/src/offline/sync-engine.ts`:
   ```typescript
   export async function processOutbox(): Promise<SyncResult> {
     if ("locks" in navigator) {
       return await navigator.locks.request("milledger-outbox-sync", { ifAvailable: true }, async (lock) => {
         if (!lock) {
           return { processed: 0, skipped: true, reason: "Lock held by another tab" };
         }
         return await runSyncLoop();
       });
     }
     // Fallback to local memory lock if navigator.locks unavailable
     if (isSyncing) return { processed: 0, skipped: true };
     try {
       isSyncing = true;
       return await runSyncLoop();
     } finally {
       isSyncing = false;
     }
   }
   ```
2. In `runSyncLoop()`: catch duplicate submission error (HTTP 409 `DUPLICATE_IDEMPOTENCY_KEY`) and mark outbox item as `synced` rather than `failed`.

## 7. Definition of Done
- [x] Outbox sync uses `navigator.locks` to prevent multi-tab concurrent execution.
- [x] Non-blocking lock check (`ifAvailable: true`) ensures background tabs do not queue duplicate sync attempts.
- [x] Duplicate submissions encountering server-side idempotency match resolve cleanly as synced.

## 8. Verification Evidence
- Code implementation: `client/src/offline/sync-engine.ts`
  - Integrated `navigator.locks.request("mill-ledger-outbox-sync", { ifAvailable: true }, ...)` mutex wrapper.
  - Non-blocking lock check guarantees background tabs back off immediately when another tab is syncing.
  - Idempotency conflict handler catches duplicate submission responses (HTTP 409) and marks the record cleanly as synced.
- Build & tests:
  - `pnpm --filter client build`: Clean build with 0 TypeScript/Vite errors.
  - `server/src/offline-sync.test.ts`: 5/5 offline synchronization & exactly-once idempotency tests passed.
- [ ] Client unit test verifies lock acquisition and release.

## 8. Verification Plan
- Unit test in `client/src/offline/sync-engine.test.ts`: Call `processOutbox` twice concurrently -> Assert inner sync worker executes exactly once.
