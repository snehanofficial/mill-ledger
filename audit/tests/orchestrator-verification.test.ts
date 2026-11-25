import { describe, it, expect, vi, beforeEach } from 'vitest';
import { run, killTree, nextAction, computeTierFingerprint, getDbSnapshotCmd, blockedReason } from '../../orchestrate.mjs';
import { existsSync, writeFileSync, unlinkSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

describe('MillLedger Orchestrator v3 Verification Suite', () => {

  describe('1. Process Lifecycle & Inactivity Stall Detection', () => {
    it('executes a synchronous command cleanly with COMPLETED lifecycle state', async () => {
      const r = await run('echo "millledger-test-clean"', {
        timeout: 5000,
        stallTimeoutMs: 10000
      });
      expect(r.code).toBe(0);
      expect(r.out).toContain('millledger-test-clean');
      expect(r.terminationReason).toBe('COMPLETED');
    });

    it('detects an inactivity stall and safely terminates stalled process tree', async () => {
      // Command that sleeps without producing stdout/stderr
      const r = await run('sleep 30', {
        timeout: 20000,
        stallTimeoutMs: 800 // Trigger stall after 800ms of inactivity
      });
      expect(r.code).toBe(1);
      expect(r.terminationReason).toBe('STALLED');
      expect(r.out).toContain('inactivity stall');
    });

    it('tracks real-time streaming output without buffering', async () => {
      const lines: string[] = [];
      const r = await run('echo "line1" && sleep 0.1 && echo "line2"', {
        onLine: (l) => lines.push(l.trim()),
        timeout: 5000,
        stallTimeoutMs: 5000
      });
      expect(r.code).toBe(0);
      expect(lines).toContain('line1');
      expect(lines).toContain('line2');
    });
  });

  describe('2. Dependency-Graph Scheduling Invariants', () => {
    const mockItems = [
      { id: 'F-001', tier: 'T1', cluster: 'C1', status: 'OPEN', severity: 'P1', dependsOn: [] },
      { id: 'F-002', tier: 'T1', cluster: 'C1', status: 'OPEN', severity: 'P0', dependsOn: ['F-001'] },
      { id: 'F-003', tier: 'T1', cluster: 'C2', status: 'OPEN', severity: 'P2', dependsOn: [] }
    ];

    it('does NOT allow F-002 to be scheduled before prerequisite F-001 is VERIFIED, even in same cluster', () => {
      const act = nextAction(mockItems as any);
      expect(act.type).toBe('fix');
      // F-001 is ready, F-002 is NOT ready
      if (act.type === 'fix') {
        expect(act.cluster).toBe('C1');
        const ids = act.items.map((i: any) => i.id);
        expect(ids).toContain('F-001');
        expect(ids).not.toContain('F-002');
      }
    });

    it('schedules F-002 once F-001 becomes VERIFIED', () => {
      const updated = mockItems.map(i => i.id === 'F-001' ? { ...i, status: 'VERIFIED' } : i);
      const act = nextAction(updated as any);
      expect(act.type).toBe('fix');
      if (act.type === 'fix') {
        expect(act.cluster).toBe('C1');
        const ids = act.items.map((i: any) => i.id);
        expect(ids).toContain('F-002');
      }
    });

    it('reports accurate blocker reasons for dependent items', () => {
      const reason = blockedReason(mockItems[1] as any, mockItems as any);
      expect(reason).toContain('waits for F-001 [OPEN]');
    });
  });

  describe('3. Tier Gate Fingerprinting & Stale Gate Invalidation', () => {
    const tierItems = [
      { id: 'F-001', tier: 'T1', status: 'VERIFIED', fixCommit: 'abc1234' },
      { id: 'F-002', tier: 'T1', status: 'VERIFIED', fixCommit: 'def5678' }
    ];

    it('computes deterministic tier fingerprint', () => {
      const fp1 = computeTierFingerprint(tierItems as any, 1);
      const fp2 = computeTierFingerprint([...tierItems].reverse() as any, 1);
      expect(fp1).toBe(fp2);
      expect(fp1).toContain('F-001:VERIFIED:abc1234');
      expect(fp1).toContain('F-002:VERIFIED:def5678');
    });

    it('fingerprint changes if an item is reopened or commit changes', () => {
      const fpBefore = computeTierFingerprint(tierItems as any, 1);
      const reopened = tierItems.map(i => i.id === 'F-001' ? { ...i, status: 'REOPENED' } : i);
      const fpAfter = computeTierFingerprint(reopened as any, 1);
      expect(fpBefore).not.toBe(fpAfter);
    });
  });

  describe('4. Database Safety Snapshots', () => {
    it('generates a valid pg_dump command for local database URL', () => {
      const cmd = getDbSnapshotCmd('CLUSTER-01', 1);
      expect(cmd).toBeTruthy();
      expect(cmd).toContain('pg_dump');
      expect(cmd).toContain('mill_ledger_audit_throwaway');
    });
  });
});
