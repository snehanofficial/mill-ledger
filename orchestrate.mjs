#!/usr/bin/env node
/**
 * MillLedger remediation orchestrator v3 (supervised or AUTONOMOUS).
 *
 * Robust, production-grade autonomous orchestrator with:
 * - Real-time stream-json parsing and tool activity tracking
 * - Active process lifecycle management (STARTING, RUNNING, REASONING, WAITING_FOR_SUBAGENT, STALLED, COMPLETED, FAILED)
 * - Inactivity and stall detection with diagnostic capture and safe tree termination
 * - Real-time log streaming directly to disk (never lost on SIGINT)
 * - Strict dependency-graph resolution (never bypasses dependencies within same cluster)
 * - Scratch worktree isolation with .env copying and Prisma client generation for independent revert-checks
 * - Automated PostgreSQL snapshotting (pg_dump) before schema/permission/API modifications
 * - Stale tier-gate invalidation using tracker state and commit fingerprints
 * - Enforced quality gates and verified final reporting
 *
 * Usage:
 *   node orchestrate.mjs --plan      # inspect current queue and eligible next actions
 *   node orchestrate.mjs --why       # detailed blocker reasons for all open findings
 *   node orchestrate.mjs --approve F-009,CLUSTER-02   # record manual approvals
 *   node orchestrate.mjs             # execute remediation
 */
import { spawn, spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync, appendFileSync, statSync, copyFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const ROOT = process.cwd();
const A = (...p) => join(ROOT, 'audit', ...p);
const env = process.env;
const AUTONOMOUS = env.AUTONOMOUS === '1';
const PROMPTS_FILE = env.PROMPTS_FILE ?? join(ROOT, 'MILLLEDGER_FIX_TRACKER_PROMPTS.md');
const AUDIT_PROMPTS_FILE = env.AUDIT_PROMPTS_FILE ?? join(ROOT, 'MILLLEDGER_AUDIT_PROMPTS.md');

// Standard CLI defaults using official stream-json output and bounded turn timeouts
const DEFAULT_FIXER_CMD = 'agy -p "Read {promptFile} and carry out every instruction in it exactly." --model gemini-3.8-flash-medium --dangerously-skip-permissions --output-format stream-json --print-timeout 30m';
const DEFAULT_VERIFIER_CMD = 'agy -p "Read {promptFile} and carry out every instruction in it exactly." --model gemini-3.8-flash-high --dangerously-skip-permissions --output-format stream-json --print-timeout 30m';
const DEFAULT_ESCALATE_CMD = 'agy -p "Read {promptFile} and carry out every instruction in it exactly." --model gemini-3.8-flash-high --dangerously-skip-permissions --output-format stream-json --print-timeout 30m';

let FIXER_CMD = env.FIXER_CMD ?? DEFAULT_FIXER_CMD;
// Normalize --output-format json to stream-json to prevent buffering hangs
if (FIXER_CMD.includes('--output-format json')) {
  FIXER_CMD = FIXER_CMD.replace('--output-format json', '--output-format stream-json');
}

let VERIFIER_CMD = env.VERIFIER_CMD ?? DEFAULT_VERIFIER_CMD;
if (VERIFIER_CMD.includes('--output-format json')) {
  VERIFIER_CMD = VERIFIER_CMD.replace('--output-format json', '--output-format stream-json');
}

let GATE_CMD = env.GATE_CMD ?? VERIFIER_CMD;
let ESCALATE_CMD = env.ESCALATE_CMD ?? DEFAULT_ESCALATE_CMD;
if (ESCALATE_CMD.includes('--output-format json')) {
  ESCALATE_CMD = ESCALATE_CMD.replace('--output-format json', '--output-format stream-json');
}

const TEST_FILE_CMD = env.TEST_FILE_CMD ?? 'pnpm vitest run {file}';
const E2E_FILE_CMD = env.E2E_FILE_CMD ?? 'pnpm playwright test {file}';
const INSTALL_CMD = env.INSTALL_CMD ?? 'pnpm install --frozen-lockfile';
const CHECK_CMD = env.CHECK_CMD ?? 'pnpm typecheck && pnpm lint && pnpm test';
const GATE_CHECK_CMD = env.GATE_CHECK_CMD ?? `${CHECK_CMD} && pnpm build && pnpm test:e2e && pnpm benchmark`;
const DB_SNAPSHOT_CMD = env.DB_SNAPSHOT_CMD;

const MAX_ATTEMPTS = Number(env.MAX_ATTEMPTS ?? (AUTONOMOUS ? 6 : 4));
const MAX_RUNS = Number(env.MAX_RUNS ?? (AUTONOMOUS ? 800 : 200));
const MAX_HOURS = Number(env.MAX_HOURS ?? 72);
const MAX_GATE_ATTEMPTS = Number(env.MAX_GATE_ATTEMPTS ?? 3);
const MAX_UNBLOCK_PASSES = Number(env.MAX_UNBLOCK_PASSES ?? 2);
const MAX_FINAL_CYCLES = Number(env.MAX_FINAL_CYCLES ?? 2);
const AGENT_TIMEOUT_MIN = Number(env.AGENT_TIMEOUT_MIN ?? 30);
const STALL_TIMEOUT_SEC = Number(env.STALL_TIMEOUT_SEC ?? 180); // Inactivity threshold (seconds)
const PAUSE_AFTER_TIER = !AUTONOMOUS && env.PAUSE_AFTER_TIER !== '0';
const PLAN_ONLY = process.argv.includes('--plan');
const VERBOSE = Number(env.VERBOSE ?? 2);
const HEARTBEAT_MS = Number(env.HEARTBEAT_SEC ?? 30) * 1000;
const START = Date.now();

mkdirSync(A('runs'), { recursive: true });
mkdirSync(A('gates'), { recursive: true });
mkdirSync(A('final'), { recursive: true });

const LOG_FILE = A('runs', 'orchestrator.log');
const ts = () => new Date().toTimeString().slice(0, 8);
const now = () => new Date().toISOString();
const tail = (s, n = 3000) => (s.length > n ? '...' + s.slice(-n) : s);
const clip = (s, n = 200) => { s = String(s); return s.length > n ? s.slice(0, n) + '…' : s; };
const dur = (ms) => {
  const s = Math.round(ms / 1000);
  return s >= 3600 ? `${Math.floor(s / 3600)}h${Math.floor((s % 3600) / 60)}m` : s >= 60 ? `${Math.floor(s / 60)}m${s % 60}s` : `${s}s`;
};

/** Log message to central file and console */
function log(msg = '', lvl = 1) {
  const text = String(msg).split('\n').map((l) => `${ts()} ${l}`).join('\n');
  try { appendFileSync(LOG_FILE, text + '\n'); } catch { /* ignore */ }
  if (VERBOSE >= lvl) console.log(text);
}
const done = (msg, code = 0) => { log(msg, 0); process.exit(code); };
const die = (msg, code = 2) => { log('\nSTOP: ' + msg, 0); process.exit(code); };

/** Quick synchronous command execution */
function sh(cmd, { cwd = ROOT, input, timeout } = {}) {
  const r = spawnSync(cmd, { cwd, shell: true, input, encoding: 'utf8', maxBuffer: 1 << 28, timeout, killSignal: 'SIGKILL' });
  const timedOut = r.error && r.error.code === 'ETIMEDOUT';
  return { code: r.status ?? 1, out: (r.stdout ?? '') + (r.stderr ?? '') + (timedOut ? `\n[orchestrator] killed after ${timeout} ms timeout` : '') };
}

const ACTIVE_CHILDREN = new Set();
process.on('SIGINT', () => {
  log('\nInterrupted (Ctrl+C). Terminating child processes and saving state...', 0);
  for (const c of ACTIVE_CHILDREN) killTree(c);
  process.exit(130);
});

function killTree(child) {
  try {
    if (process.platform === 'win32') {
      child.kill('SIGKILL');
    } else {
      process.kill(-child.pid, 'SIGKILL');
    }
  } catch {
    try { child.kill('SIGKILL'); } catch { /* process already exited */ }
  }
}

/** Async command runner with real-time streaming, stall detection, heartbeat, and timeout */
function run(cmd, { cwd = ROOT, input, timeout, onLine, heartbeat, heartbeatMs = HEARTBEAT_MS, stallTimeoutMs = STALL_TIMEOUT_SEC * 1000, streamLogFile } = {}) {
  return new Promise((resolve) => {
    const t0 = Date.now();
    let lastActivity = t0;
    let out = '';
    let buf = '';
    let last = '';
    let timedOut = false;
    let stalled = false;

    const child = spawn(cmd, { cwd, shell: true, detached: process.platform !== 'win32', stdio: ['pipe', 'pipe', 'pipe'] });
    ACTIVE_CHILDREN.add(child);

    const feed = (d) => {
      lastActivity = Date.now();
      const s = d.toString();
      out += s;
      buf += s;

      if (streamLogFile) {
        try { appendFileSync(streamLogFile, s); } catch {}
      }

      let i;
      while ((i = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, i);
        buf = buf.slice(i + 1);
        if (line.trim()) {
          last = line;
          onLine?.(line);
        }
      }
    };

    child.stdout.on('data', feed);
    child.stderr.on('data', feed);
    child.stdin.on('error', () => {});
    child.stdin.end(input ?? '');

    // Periodic stall / inactivity detector
    const stallInterval = stallTimeoutMs ? setInterval(() => {
      const idleMs = Date.now() - lastActivity;
      if (idleMs > stallTimeoutMs) {
        stalled = true;
        log(`\n⚠ INACTIVITY STALL DETECTED: No activity on child PID ${child.pid} for ${dur(idleMs)} (threshold: ${dur(stallTimeoutMs)}).`, 0);
        log(`  Capturing process diagnostics and terminating stalled process tree...`, 0);
        
        // Diagnostic capture
        const diag = sh(`ps -T -p ${child.pid} -o pid,ppid,spid,stat,wchan:20,cmd 2>/dev/null || ps aux | grep ${child.pid}`);
        log(`  Process tree snapshot:\n${tail(diag.out, 600)}`, 1);
        
        killTree(child);
      }
    }, Math.min(10000, stallTimeoutMs / 2)) : null;

    const hb = heartbeat ? setInterval(() => heartbeat({ elapsed: Date.now() - t0, bytes: out.length, last, idle: Date.now() - lastActivity }), heartbeatMs) : null;
    const to = timeout ? setTimeout(() => { timedOut = true; killTree(child); }, timeout) : null;

    const finish = (code) => {
      clearInterval(hb);
      if (stallInterval) clearInterval(stallInterval);
      clearTimeout(to);
      ACTIVE_CHILDREN.delete(child);

      if (buf.trim()) {
        last = buf;
        onLine?.(buf);
      }

      const terminationReason = timedOut ? 'TIMED_OUT' : stalled ? 'STALLED' : code === 0 ? 'COMPLETED' : 'FAILED';
      resolve({
        code: (timedOut || stalled) ? 1 : code ?? 1,
        out: out + (timedOut ? `\n[orchestrator] killed after ${timeout} ms timeout` : '') + (stalled ? `\n[orchestrator] killed after ${stallTimeoutMs} ms inactivity stall` : ''),
        ms: Date.now() - t0,
        terminationReason,
        childPid: child.pid
      });
    };

    child.on('close', finish);
    child.on('error', (e) => {
      out += String(e);
      finish(1);
    });
  });
}

/** Execute a visible, timed verification step */
async function step(label, cmd, { expectFail = false, ...opts } = {}) {
  log(`▶ ${label}: ${clip(cmd, 160)}`);
  const r = await run(cmd, { ...opts, onLine: (l) => log(`    │ ${clip(l)}`, 2), heartbeat: (h) => log(`  … ${label} still running (${dur(h.elapsed)}); last: ${clip(h.last, 100)}`) });
  const good = expectFail ? r.code !== 0 : r.code === 0;
  log(`${good ? '✔' : '✘'} ${label} (${dur(r.ms)}, exit ${r.code}${expectFail ? ', a failure was expected' : ''})`);
  if (!good) log(tail(r.out, 1500).split('\n').map((l) => '    ! ' + clip(l, 220)).join('\n'));
  return r;
}

// ---------- state ----------
const STATE_FILE = A('runs', 'state.json');
const state = Object.assign(
  { runs: 0, attempts: {}, feedback: {}, parked: {}, contradicted: {}, tokens: { in: 0, out: 0, total: 0 }, agentMs: 0, gateAttempts: {}, gateWaived: {}, unblock: {}, skippedRevert: {}, finalCycles: 0, finalDone: false },
  existsSync(STATE_FILE) ? JSON.parse(readFileSync(STATE_FILE, 'utf8')) : {},
);
const saveState = () => writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));

// ---------- tracker ----------
function loadItems() {
  const f = A('tracker', 'tracker.json');
  if (!existsSync(f)) die('audit/tracker/tracker.json not found. Run Prompt 1 first.');
  const t = JSON.parse(readFileSync(f, 'utf8'));
  return Array.isArray(t) ? t : t.items ?? t.workItems ?? die('Unrecognised tracker.json shape; adjust loadItems().');
}
const readApprovals = () => (existsSync(A('tracker', 'approvals.json')) ? JSON.parse(readFileSync(A('tracker', 'approvals.json'), 'utf8')) : []);
const isDone = (s) => s === 'VERIFIED' || s === 'WONT-FIX';
const ACTIVE = new Set(['OPEN', 'REJECTED', 'REOPENED', 'IN-PROGRESS']);
const isFinding = (i) => /^F-/.test(i.id);
const tierNum = (i) => parseInt(String(i.tier).replace(/\D/g, ''), 10);
const needsApproval = (i) => i.needsApproval && i.needsApproval !== 'none';
const isApproved = (i, ap) => AUTONOMOUS || !needsApproval(i) || ap.includes(i.id) || ap.includes(i.cluster);

// Items in a parked cluster, plus anything that transitively depends on a parked item, are set aside
function parkedSet(items) {
  const open = items.filter((i) => isFinding(i) && !isDone(i.status));
  const P = new Set(open.filter((i) => state.parked[i.cluster]).map((i) => i.id));
  for (let ch = true; ch;) {
    ch = false;
    for (const i of open) if (!P.has(i.id) && (i.dependsOn ?? []).some((d) => P.has(d))) { P.add(i.id); ch = true; }
  }
  return P;
}

function computeTierFingerprint(items, t) {
  return items
    .filter((i) => isFinding(i) && tierNum(i) === t)
    .map((i) => `${i.id}:${i.status}:${i.fixCommit ?? 'none'}`)
    .sort()
    .join('|');
}

function nextAction(items) {
  const findings = items.filter((i) => isFinding(i) && tierNum(i) >= 1);
  const byId = new Map(items.map((i) => [i.id, i]));
  const ap = readApprovals();
  const P = parkedSet(items);
  const settled = (i) => isDone(i.status) || P.has(i.id);
  const tiers = [...new Set(findings.map(tierNum))].sort((a, b) => a - b);

  for (const t of tiers) {
    const inTier = findings.filter((i) => tierNum(i) === t);
    if (inTier.every(settled)) {
      if (state.gateWaived[t]) continue;
      const g = A('gates', `T${t}.json`);
      let ok = false;
      try {
        if (existsSync(g)) {
          const gateData = JSON.parse(readFileSync(g, 'utf8'));
          if (gateData.result === 'PASS') {
            const currentFp = computeTierFingerprint(items, t);
            if (!gateData.fingerprint || gateData.fingerprint === currentFp) {
              ok = true;
            } else {
              log(`Tier T${t} gate is STALE (tracker items changed since gate). Invalidating gate...`);
              sh(`node -e "try{require('fs').unlinkSync(process.argv[1])}catch(e){}" "${g}"`);
              ok = false;
            }
          }
        }
      } catch {
        ok = false;
      }
      if (!ok) return { type: 'gate', tier: t };
      if (PAUSE_AFTER_TIER && !existsSync(A('gates', `T${t}.accepted`))) return { type: 'pause', tier: t };
      continue;
    }

    const live = inTier.filter((i) => !P.has(i.id));
    const clusters = [...new Set(live.map((i) => i.cluster))];

    // Priority 1: Verify any finding that reached FIXED-UNVERIFIED
    for (const c of clusters) {
      const unver = live.filter((i) => i.cluster === c && i.status === 'FIXED-UNVERIFIED');
      if (unver.length) return { type: 'verify', cluster: c, items: unver };
    }

    // Strict dependency check: ALL prerequisites in dependsOn must be VERIFIED or WONT-FIX
    // Never bypass unfinished prerequisites merely because they reside in the same cluster
    const depsMet = (i) => (i.dependsOn ?? []).every((d) => {
      const dep = byId.get(d);
      return !dep || isDone(dep.status);
    });

    const eligible = clusters
      .map((c) => ({ c, ready: live.filter((i) => i.cluster === c && ACTIVE.has(i.status) && isApproved(i, ap) && depsMet(i)) }))
      .filter((x) => x.ready.length);

    if (eligible.length) {
      const sevNum = (i) => {
        const n = parseInt(String(i.severity).replace(/\D/g, ''), 10);
        return Number.isNaN(n) ? 9 : n; // P0 is highest priority (0 < 1 < 2 < 3)
      };
      const sev = (x) => Math.min(...x.ready.map(sevNum));
      eligible.sort((a, b) => sev(a) - sev(b) || String(a.c).localeCompare(String(b.c)));
      const top = eligible[0];
      const others = eligible.slice(1).map((x) => x.c).join(', ') || 'none';
      const waiting = live.filter((i) => i.cluster === top.c && ACTIVE.has(i.status) && !top.ready.includes(i)).map((i) => `${i.id} (${blockedReason(i, items)})`).join('; ');
      return {
        type: 'fix',
        cluster: top.c,
        items: top.ready,
        reason: `worst severity P${sev(top)} among ${eligible.length} ready cluster(s); other ready clusters: ${others}${waiting ? '; same-cluster items still waiting: ' + waiting : ''}`
      };
    }
    return { type: 'stuck', tier: t, items: live.filter((i) => !isDone(i.status)) };
  }
  return { type: 'done' };
}

function blockedReason(i, items) {
  const byId = new Map(items.map((x) => [x.id, x]));
  const ap = readApprovals();
  const why = [];
  if (state.parked[i.cluster]) why.push(`PARKED: ${state.parked[i.cluster]}`);
  if (i.status === 'BLOCKED') why.push('status BLOCKED (owner decision or dependency)');
  if (needsApproval(i) && !isApproved(i, ap)) why.push(`needs approval (${i.needsApproval}) -> add "${i.id}" to approvals`);
  for (const d of i.dependsOn ?? []) {
    const dep = byId.get(d);
    if (dep && !isDone(dep.status)) {
      why.push(`waits for ${d} [${dep.status}${needsApproval(dep) && !isApproved(dep, ap) ? ', needs approval' : ''}]`);
    }
  }
  return why.length ? why.join('; ') : 'ready';
}

// ---------- prompts ----------
function extract(file, re, required, label) {
  if (!existsSync(file)) { if (required.length) die(`${label} not found: ${file}`); return null; }
  const md = readFileSync(file, 'utf8');
  const out = {};
  let m;
  while ((m = re.exec(md))) out[m[1]] = m[2];
  for (const n of required) if (!out[n]) die(`${label}: item ${n} not found in ${file}`);
  return out;
}
const loadPrompts = () => extract(PROMPTS_FILE, /^# PROMPT (\d+)[^\n]*\n[\s\S]*?```text\n([\s\S]*?)\n```/gm, ['3', '4', '5'], 'Fix prompts');
const loadAuditPrompts = () => extract(AUDIT_PROMPTS_FILE, /^## Phase (\d+)[^\n]*\n\s*```text\n([\s\S]*?)\n```/gm, [], 'Audit prompts');

const ctx = (role, tag, target) =>
  `ORCHESTRATOR CONTEXT (non-interactive run, role: ${role})
- No human is available. You cannot ask questions. If a STOP CONDITION applies, write the reason to audit/runs/STOP-${tag}.md
  and exit without changing tracker statuses.
- Work ONLY on: ${target}
- Follow the MASTER RULEBOOK in AGENTS.md. The orchestrator independently re-runs tests and checks; claims without
  evidence will be rejected.
- CRITICAL EXECUTION CONSTRAINTS:
  1. DO NOT launch long-running background servers, daemons, or watchers (e.g. NEVER run 'pnpm dev', 'pnpm dev:client', 'vite', 'tsx watch', or background listeners). All commands must terminate.
  2. For tests, execute targeted test files synchronously (e.g. 'npx vitest run <file>').
  3. Ensure commands execute cleanly and output verifiable results.
---
`;

// ---------- agent runner ----------
async function runAgent(cmd, role, tag, prompt) {
  if (!cmd) die(`No command set for the ${role} role (set FIXER_CMD / VERIFIER_CMD / GATE_CMD).`);
  if (++state.runs > MAX_RUNS) { saveState(); die(`MAX_RUNS (${MAX_RUNS}) reached. Raise it and re-run to continue.`, 3); }

  const base = A('runs', `${String(state.runs).padStart(3, '0')}-${role}-${tag}`);
  writeFileSync(base + '.prompt.md', prompt);
  // Ensure log file exists from the start and truncate any prior file
  writeFileSync(base + '.log', '');

  let before = new Map();
  try { before = new Map(loadItems().map((i) => [i.id, i.status])); } catch { /* tracker unreadable */ }

  const viaFile = cmd.includes('{promptFile}');
  const full = viaFile ? cmd.replaceAll('{promptFile}', base + '.prompt.md') : cmd;

  log(`┌─ AGENT RUN #${state.runs}: ${role} / ${tag}`);
  log(`│  prompt ${prompt.length} chars -> ${base}.prompt.md | output -> ${base}.log | timeout ${AGENT_TIMEOUT_MIN} min | stall timeout ${STALL_TIMEOUT_SEC}s`);
  log(`│  command: ${clip(full, 240)}`, 2);

  const ag = { text: '', tools: 0, result: null, state: 'STARTING' };

  const onLine = (line) => {
    let o;
    try {
      o = JSON.parse(line);
    } catch {
      if (/root agent idle/i.test(line)) {
        ag.state = 'WAITING_FOR_SUBAGENT';
        log(`│  ⏳ agent waiting: ${clip(line)}`, 2);
      } else {
        log(`│    ${clip(line)}`, 2);
      }
      return;
    }

    if (o.event === 'init') {
      ag.state = 'RUNNING';
      log(`│  ⚙ session started (permission_mode=${o.init?.permission_mode ?? '?'}${o.init?.model ? ', model=' + o.init.model : ''})`, 2);
    } else if (o.event === 'step_update') {
      const s2 = o.step_update ?? {};
      if (s2.step_type === 'tool' && s2.state === 'DONE') {
        ag.tools++;
        ag.state = 'RUNNING';
        const ti = s2.tool_info ?? {};
        const p = ti.parameters ?? {};
        const arg = p.CommandLine ?? p.TargetFile ?? p.AbsolutePath ?? p.Path ?? JSON.stringify(p);
        log(`│  🔧 ${s2.tool_name ?? ti.name}: ${clip(String(arg).replace(/\s+/g, ' '), 170)}${ti.error ? '   ✘ ' + clip(ti.error.message ?? '', 120) : ''}`, 2);
      } else if (s2.step_type === 'agent_response') {
        ag.state = 'REASONING';
        if (s2.text_delta) ag.text += s2.text_delta;
      }
    } else if (o.event === 'result') {
      ag.state = 'COMPLETED';
      ag.result = o.result;
    } else if ('response' in o || 'status' in o) {
      ag.result = o;
    } else {
      log(`│    ${clip(line)}`, 2);
    }
  };

  const r = await run(full, {
    input: viaFile ? undefined : prompt,
    timeout: AGENT_TIMEOUT_MIN * 60000,
    stallTimeoutMs: STALL_TIMEOUT_SEC * 1000,
    streamLogFile: base + '.log',
    onLine,
    heartbeat: (h) => log(`│  … ${role}/${tag} [${ag.state}]: ${dur(h.elapsed)} elapsed, ${ag.tools} tool calls, ${(h.bytes / 1024).toFixed(1)} KB output; last: ${clip(h.last, 90)}`),
  });

  state.agentMs += r.ms;
  const res = ag.result;

  if (res) {
    const u = res.usage;
    if (u) {
      state.tokens.in += u.input_tokens || 0;
      state.tokens.out += u.output_tokens || 0;
      state.tokens.total += u.total_tokens || 0;
    }
    log(`│  ◂ finished: status=${res.status ?? '?'} turns=${res.num_turns ?? '?'} tool calls=${ag.tools} tokens=${u?.total_tokens ?? '?'} (run total ${state.tokens.total})`);
    const resp = String(res.response ?? ag.text ?? '').replace(/\s+/g, ' ').trim();
    if (resp) log(`│  ◂ agent says: ${clip(resp, 900)}`);
    if (res.error) log(`│  ◂ agent error: ${clip(res.error, 400)}`);
  } else {
    log(`│  ◂ no structured result from agent (lifecycle: ${r.terminationReason}, exit ${r.code}). Last output: ${clip(tail(r.out, 700).replace(/\s+/g, ' '), 500)}`);
  }

  try {
    const diff = [];
    const after = loadItems();
    for (const i of after) {
      const b = before.get(i.id);
      if (b === undefined) diff.push(`+ NEW ${i.id} [${i.status}] ${i.severity ?? ''} T${tierNum(i)} ${clip(i.title ?? '', 80)}`);
      else if (b !== i.status) diff.push(`~ ${i.id}: ${b} -> ${i.status}`);
    }
    log(diff.length ? `│  tracker changes by this run:\n${diff.map((d) => '│    ' + d).join('\n')}` : '│  tracker changes by this run: none');
  } catch {
    log('│  tracker unreadable after this run', 1);
  }

  log(`└─ ${role}/${tag} ended in ${dur(r.ms)} (${r.terminationReason}, exit ${r.code})`);
  saveState();

  const stop = A('runs', `STOP-${tag}.md`);
  if (existsSync(stop)) {
    const why = readFileSync(stop, 'utf8');
    log(`⚠ The agent wrote ${stop}:\n${why.slice(0, 1200).split('\n').map((l) => '    ' + l).join('\n')}`, 0);
    if (!AUTONOMOUS) die(`The agent asked for a human decision: ${stop}`, 3);
    appendFileSync(A('runs', 'agent-stops.log'), `${now()} ${tag}: ${why.slice(0, 1500)}\n---\n`);
    writeFileSync(stop + '.seen', why);
    sh(`node -e "require('fs').unlinkSync(process.argv[1])" "${stop}"`);
    log('  (autonomous mode: logged to agent-stops.log and continuing)');
  }
  return r;
}

// ---------- independent checks ----------
function trackerValid() {
  const f = A('tracker', 'check-tracker.mjs');
  if (!existsSync(f)) { log('✘ tracker validator missing (audit/tracker/check-tracker.mjs)'); return { ok: false, why: 'check-tracker.mjs missing' }; }
  const r = sh(`node "${f}"`);
  log(`${r.code === 0 ? '✔' : '✘'} tracker validator ${r.code === 0 ? 'passed' : 'FAILED:\n' + tail(r.out, 800)}`);
  return { ok: r.code === 0, why: tail(r.out) };
}

const EXCLUDES = '":(exclude)audit" ":(exclude)orchestrate.mjs" ":(exclude)MILLLEDGER_FIX_TRACKER_PROMPTS.md" ":(exclude)MILLLEDGER_AUDIT_PROMPTS.md" ":(exclude)AGENTS.md" ":(exclude).backup-remediation-baseline"';
function treeState() {
  const branch = sh('git rev-parse --abbrev-ref HEAD').out.trim();
  const dirty = sh(`git status --porcelain -- . ${EXCLUDES}`).out.trim();
  return { branch, dirty };
}

const isE2E = (f) => /(\.spec\.|[\\/]e2e[\\/]|playwright)/i.test(f);
function cmdFor(files) {
  if (files.every(isE2E)) return E2E_FILE_CMD;
  if (files.every((f) => !isE2E(f))) return TEST_FILE_CMD;
  return undefined;
}

/** Independent revert-check proving regression test fails before fix and passes with fix */
async function revertCheck(item) {
  const files = [].concat(item.regressionTest ?? []);
  if (!item.fixCommit || !files.length) return { ok: false, why: `${item.id}: tracker lacks fixCommit or regressionTest` };
  const base = cmdFor(files);
  if (!base) {
    state.skippedRevert[item.id] = 'no TEST_FILE_CMD/E2E_FILE_CMD for this test type';
    saveState();
    log(`⟲ ${item.id}: independent revert-check SKIPPED (no command for ${files.join(', ')})`);
    return { ok: true, skipped: true };
  }

  log(`⟲ independent revert-check ${item.id}: fix commit ${item.fixCommit.slice(0, 8)}, test(s) ${files.join(', ')}`);
  log('   method: check out the commit BEFORE the fix, add only the new test, it must FAIL; then check out the fix, it must PASS');

  const wt = join(tmpdir(), `ml-verify-${item.id}-${Date.now()}`);
  try {
    const w = sh(`git worktree add --detach "${wt}" ${item.fixCommit}^`);
    if (w.code) return { ok: false, why: `${item.id}: could not create worktree: ${w.out}` };

    // Copy .env into scratch worktree so environment configs and database credentials exist
    if (existsSync(join(ROOT, '.env'))) {
      try { copyFileSync(join(ROOT, '.env'), join(wt, '.env')); } catch {}
    }

    const inst = await step(`${item.id} install in scratch worktree`, INSTALL_CMD, { cwd: wt });
    if (inst.code) return { ok: false, why: `${item.id}: install failed in scratch worktree: ${tail(inst.out)}` };

    // Generate Prisma client in scratch worktree for database-backed tests
    await step(`${item.id} prisma generate in scratch worktree`, 'pnpm --filter @mill-ledger/server prisma generate', { cwd: wt });

    sh(`git checkout ${item.fixCommit} -- ${files.map((f) => `"${f}"`).join(' ')}`, { cwd: wt });
    const cmd = base.replaceAll('{file}', files.join(' '));

    const without = await step(`${item.id} test WITHOUT the fix (must FAIL)`, cmd, { cwd: wt, expectFail: true });
    writeFileSync(A('runs', `revert-${item.id}-without-fix.log`), without.out);
    if (without.code === 0) return { ok: false, why: `${item.id}: regression test PASSES without the fix, so it proves nothing` };

    sh(`git checkout -f --detach ${item.fixCommit}`, { cwd: wt });
    const withFix = await step(`${item.id} test WITH the fix (must PASS)`, cmd, { cwd: wt });
    writeFileSync(A('runs', `revert-${item.id}-with-fix.log`), withFix.out);
    if (withFix.code !== 0) return { ok: false, why: `${item.id}: regression test FAILS with the fix:\n${tail(withFix.out)}` };

    log(`✔ ${item.id}: proven. The test fails without the fix and passes with it.`);
    return { ok: true };
  } finally {
    sh(`git worktree remove --force "${wt}"`);
  }
}

/** Construct a safe pg_dump snapshot command before risky changes */
function getDbSnapshotCmd(c, n) {
  if (DB_SNAPSHOT_CMD) return DB_SNAPSHOT_CMD;
  const dbUrl = env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/mill_ledger_audit_throwaway?schema=public';
  try {
    const u = new URL(dbUrl);
    const dbName = u.pathname.replace(/^\//, '');
    const snapPath = A('runs', `db-snapshot-${c}-a${n}-${Date.now()}.sql`);
    const pass = u.password ? `PGPASSWORD="${u.password}" ` : '';
    return `${pass}pg_dump -h "${u.hostname}" -p "${u.port || 5432}" -U "${u.username || 'postgres'}" "${dbName}" > "${snapPath}"`;
  } catch {
    return null;
  }
}

const park = (cluster, reason) => { state.parked[cluster] = reason; saveState(); log(`⛔ PARKED ${cluster}: ${reason}`, 0); };
const describe = (i) => `  • ${i.id} [${i.severity}] ${clip(i.title ?? '', 90)} | effort ${i.effort ?? '?'} | files: ${(i.files ?? []).slice(0, 4).join(', ') || '?'} | refs: ${(i.standardsRefs ?? []).slice(0, 3).join(', ') || '-'} | approval: ${i.needsApproval ?? 'none'}`;

// ---------- actions ----------
async function doFix(prompts, act) {
  const c = act.cluster;
  state.attempts[c] = (state.attempts[c] ?? 0) + 1;
  const n = state.attempts[c];
  log(`Cluster ${c}: attempt ${n} of ${MAX_ATTEMPTS}. Why now: ${act.reason ?? 'next in queue'}`);
  for (const i of act.items) log(describe(i));

  if (n > MAX_ATTEMPTS) {
    saveState();
    if (!AUTONOMOUS) die(`${c}: ${MAX_ATTEMPTS} fixer attempts used. Human review needed.`, 3);
    return park(c, `${MAX_ATTEMPTS} fixer attempts used. Last feedback: ${tail(state.feedback[c] || 'none', 500)}`);
  }

  const t = treeState();
  log(`  git: branch ${t.branch}, working tree ${t.dirty ? 'DIRTY' : 'clean'}`);
  if (/^(main|master)$/.test(t.branch)) die('Refusing to run on main/master. Use the remediation branch.');

  if (t.dirty) {
    if (!AUTONOMOUS) die(`Working tree is not clean before fixing ${c}:\n${t.dirty}`);
    sh(`git stash push -u -m "orchestrator-leftover-${c}-${Date.now()}" -- . ${EXCLUDES}`);
    appendFileSync(A('runs', 'leftovers.log'), `${now()} stashed leftovers before ${c}:\n${t.dirty}\n`);
    log(`  ⚠ stashed leftover uncommitted changes from an earlier run (recover with git stash list):\n${t.dirty.split('\n').map((l) => '      ' + l).join('\n')}`);
  }

  const risky = act.items.filter(needsApproval);
  if (risky.length) {
    appendFileSync(A('runs', 'auto-approvals.log'), `${now()} ${c} attempt ${n}: auto-approved ${risky.map((i) => `${i.id}(${i.needsApproval})`).join(', ')}\n`);
    log(`  ⚠ AUTO-APPROVED change class: ${risky.map((i) => `${i.id} (${i.needsApproval})`).join(', ')} (logged to auto-approvals.log)`);

    const snapCmd = getDbSnapshotCmd(c, n);
    if (snapCmd) {
      const snapRes = await step('database snapshot before risky change', snapCmd);
      if (snapRes.code !== 0) {
        die(`Database snapshot failed before risky change on ${c}: ${snapRes.out}`);
      }
    }
  }

  const tag = `pre-${c}-a${n}`;
  sh(`git tag -f ${tag}`);
  log(`  git: tagged ${tag} (roll back with: git reset --hard ${tag})`);

  const useEscalate = AUTONOMOUS && ESCALATE_CMD && n > 2;
  if (useEscalate) log('  ↑ using ESCALATE_CMD (stronger agent) because earlier attempts failed');

  const ids = act.items.map((i) => i.id).join(', ');
  let prompt = ctx('FIXER', c, `${c}, findings ${ids} ONLY (leave other findings in this cluster untouched; they are blocked, parked or not yet due)`) + prompts['3'].replace('<CLUSTER-ID or next in queue>', c);

  if (AUTONOMOUS && risky.length) {
    prompt += `\n\nAUTONOMOUS APPROVAL: the schema, permission or public API change for ${risky.map((i) => i.id).join(', ')} is pre-approved. Do not stop to ask. Keep migrations forward-only, additive where possible, with a data-safe backfill, and prove them on a fresh database AND on seeded data.\n`;
  }

  if (state.feedback[c]) {
    log(`  feeding the agent failure details from the previous attempt (${state.feedback[c].length} chars)`);
    prompt += `\n\nORCHESTRATOR FEEDBACK FROM THE PREVIOUS ATTEMPT (address this first). For any item already at FIXED-UNVERIFIED, record FIXED-UNVERIFIED -> REJECTED -> IN-PROGRESS in statusHistory with the note "orchestrator check failed", then fix:\n${state.feedback[c]}\n`;
    state.feedback[c] = '';
  }

  await runAgent(useEscalate ? ESCALATE_CMD : FIXER_CMD, 'fixer', c, prompt);

  const commits = sh(`git log --oneline ${tag}..HEAD`).out.trim();
  log(commits ? `  commits made by the agent:\n${commits.split('\n').map((l) => '      ' + l).join('\n')}` : '  ⚠ the agent made NO commits');

  const stat = sh(`git diff --stat ${tag}..HEAD`).out.trim().split('\n').slice(-14);
  if (stat[0]) log(`  diff summary:\n${stat.map((l) => '      ' + l).join('\n')}`);

  const problems = [];
  const nowItems = loadItems().filter((i) => act.items.some((x) => x.id === i.id));
  const moved = nowItems.filter((i) => i.status === 'FIXED-UNVERIFIED');
  log(`  tracker: ${moved.length} of ${act.items.length} item(s) reached FIXED-UNVERIFIED: ${nowItems.map((i) => `${i.id}=${i.status}`).join(', ')}`);

  if (!commits) problems.push('The agent made no commits. A fix must be committed (one commit per finding, with its regression test).');
  if (!moved.length) problems.push(`No item reached FIXED-UNVERIFIED (current: ${nowItems.map((i) => `${i.id}=${i.status}`).join(', ')}). Fix, commit, add the regression test, record fixCommit and regressionTest in the tracker, and set FIXED-UNVERIFIED.`);

  const after = treeState();
  if (after.dirty) {
    problems.push('Uncommitted changes remain after the fix:\n' + after.dirty);
    log(`  ✘ uncommitted changes remain:\n${after.dirty.split('\n').map((l) => '      ' + l).join('\n')}`);
  } else {
    log('  ✔ working tree is clean after the fix');
  }

  const chk = await step(`orchestrator's own check after fix (${CHECK_CMD})`, CHECK_CMD);
  writeFileSync(A('runs', `check-after-fix-${c}.log`), chk.out);
  if (chk.code) problems.push(`CHECK_CMD failed:\n${tail(chk.out)}`);

  const tv = trackerValid();
  if (!tv.ok) problems.push('Tracker validator failed:\n' + tv.why);

  state.feedback[c] = problems.join('\n\n');
  saveState();
  log(problems.length ? `✘ ${c} attempt ${n} has ${problems.length} problem(s); the next attempt will receive the details:\n${problems.map((p2) => '      - ' + clip(p2.split('\n')[0], 200)).join('\n')}` : `✔ ${c} attempt ${n}: orchestrator checks passed; ${moved.length} item(s) now go to independent verification.`);
}

const overridePrompt = (base, failures) => base + `\n\nORCHESTRATOR OVERRIDE: independent checks contradict the verdict. For each affected item record the legal transition: if it is FIXED-UNVERIFIED set REJECTED; if it is already VERIFIED set VERIFIED -> REOPENED. Attach this evidence and update tracker.md and run check-tracker.mjs. Do not fix code.\n${failures.map((f) => `- ${f.why}`).join('\n\n')}\n`;

async function doVerify(prompts, act) {
  const c = act.cluster;
  const ids = act.items.map((i) => i.id).join(', ');
  log(`Verifying cluster ${c}: ${ids} (the verifier is a separate session from the fixer)`);
  const base = ctx('VERIFIER', c, `${c} (items to verify: ${ids})`) + prompts['4'].replace('<CLUSTER-ID>', c);

  await runAgent(VERIFIER_CMD, 'verifier', c, base);

  const verified = () => loadItems().filter((i) => act.items.some((x) => x.id === i.id) && i.status === 'VERIFIED');
  const claimed = verified();
  log(`  verifier claims VERIFIED: ${claimed.map((i) => i.id).join(', ') || 'none'}; not verified: ${act.items.filter((i) => !claimed.some((x) => x.id === i.id)).map((i) => i.id).join(', ') || 'none'}`);

  const failures = [];
  for (const it of claimed) {
    const r = await revertCheck(it);
    if (!r.ok) {
      failures.push({ id: it.id, why: r.why });
      log(`✘ ${it.id}: orchestrator DISAGREES with the verifier: ${clip(r.why, 300)}`, 0);
    }
  }

  const chk = await step(`orchestrator's own full check after verification (${CHECK_CMD})`, CHECK_CMD);
  writeFileSync(A('runs', `check-after-verify-${c}.log`), chk.out);
  if (chk.code) {
    if (!AUTONOMOUS) die(`CHECK_CMD failed after verifying ${c}:\n${tail(chk.out)}`, 3);
    for (const it of verified()) failures.push({ id: it.id, why: `${it.id}: the full check suite is RED after this cluster was verified:\n${tail(chk.out, 1500)}` });
  }

  if (failures.length) {
    log(`Asking the verifier to correct its verdict for: ${failures.map((f) => f.id).join(', ')}`, 0);
    await runAgent(VERIFIER_CMD, 'verifier', c + '-override', overridePrompt(base, failures));
    const still = verified().filter((i) => failures.some((f) => f.id === i.id));
    if (still.length) {
      if (!AUTONOMOUS) die(`Verifier and orchestrator disagree on ${c}. Human review needed.`, 3);
      for (const i of still) state.contradicted[i.id] = (failures.find((f) => f.id === i.id)?.why ?? 'independent check failed').slice(0, 400);
      return park(c, `verifier and orchestrator disagree on ${still.map((i) => i.id).join(', ')}: ${failures[0].why.slice(0, 300)}`);
    }
    return log(`↺ ${c}: verdict corrected; the cluster goes back to the fixer.`);
  }

  let tv = trackerValid();
  if (!tv.ok) {
    if (AUTONOMOUS) {
      await runAgent(GATE_CMD, 'tracker-repair', c, ctx('TRACKER-REPAIR', c, 'tracker bookkeeping only') + `The tracker validator failed after verification of ${c}:\n${tv.why}\nFix tracker.json / tracker.md bookkeeping ONLY (never edit check-tracker.mjs, never change any status to hide a problem), then re-run the validator.`);
      tv = trackerValid();
    }
    if (!tv.ok) die('Tracker validator failed after verification:\n' + tv.why, 3);
  }
  log(`✔ ${c}: independently verified: ${claimed.map((i) => i.id).join(', ') || 'none'}`);
}

async function doGate(prompts, act) {
  const t = act.tier;
  log(`Tier T${t} gate: every item in the tier is verified or parked. Running the full gate.`);
  let failure = null;

  const pre = await step(`tier T${t} gate checks (${GATE_CHECK_CMD})`, GATE_CHECK_CMD);
  writeFileSync(A('runs', `gate-T${t}-checks.log`), pre.out);
  if (pre.code) failure = `GATE_CHECK_CMD failed for tier T${t}:\n${tail(pre.out)}`;

  if (!failure) {
    const extra = `\n\nWrite your verdict to audit/gates/T${t}.json as {"result":"PASS"|"FAIL","failedChecks":[...],"reopen":[ids]}.`;
    await runAgent(GATE_CMD, 'gate', `T${t}`, ctx('GATEKEEPER', `T${t}`, `tier T${t}`) + prompts['5'].replace('<T#>', `T${t}`) + extra);
    const g = A('gates', `T${t}.json`);
    if (!existsSync(g)) {
      failure = `Gatekeeper did not write ${g}`;
    } else {
      try {
        const res = JSON.parse(readFileSync(g, 'utf8'));
        log(`  gatekeeper verdict: ${res.result}${res.failedChecks?.length ? ' | failed: ' + JSON.stringify(res.failedChecks).slice(0, 300) : ''}`);
        if (res.result !== 'PASS') {
          failure = `Gatekeeper verdict FAIL. Failed checks: ${JSON.stringify(res.failedChecks ?? [])}. Reopen: ${(res.reopen ?? []).join(', ')}`;
        } else {
          // Stamp gate file with commit SHA, timestamp, covered findings, and fingerprint
          const allItems = loadItems();
          const commitSha = sh('git rev-parse HEAD').out.trim();
          res.timestamp = now();
          res.commitSha = commitSha;
          res.tier = `T${t}`;
          res.coveredFindings = allItems.filter(i => isFinding(i) && tierNum(i) === t).map(i => i.id);
          res.fingerprint = computeTierFingerprint(allItems, t);
          writeFileSync(g, JSON.stringify(res, null, 2));
        }
      } catch {
        failure = `Gatekeeper wrote an unreadable verdict file ${g}`;
      }
    }
  }

  if (!failure) return log(`✔ TIER T${t} GATE PASSED`, 0);

  log(`✘ TIER T${t} GATE FAILED: ${clip(failure, 500)}`, 0);
  if (!AUTONOMOUS) die(`Tier T${t} gate FAILED: ${failure}`, 3);

  sh(`node -e "try{require('fs').unlinkSync(process.argv[1])}catch(e){}" "${A('gates', `T${t}.json`)}"`);
  state.gateAttempts[t] = (state.gateAttempts[t] ?? 0) + 1;
  if (state.gateAttempts[t] > MAX_GATE_ATTEMPTS) {
    state.gateWaived[t] = failure.slice(0, 600);
    saveState();
    return log(`⛔ Tier T${t} gate WAIVED after ${MAX_GATE_ATTEMPTS} attempts (recorded in summary).`, 0);
  }
  saveState();

  log(`  converting the failure into tracker work (gate attempt ${state.gateAttempts[t]} of ${MAX_GATE_ATTEMPTS})`);
  await runAgent(GATE_CMD, 'reopener', `T${t}`, ctx('REOPENER', `T${t}`, `tier T${t} gate failure, tracker bookkeeping only`) +
    `Tier T${t} failed its gate:\n${failure}\n\nConvert every failing check into tracker work. For implicated items that are VERIFIED record VERIFIED -> REOPENED with an evidence link. For failures with no matching item create a new F-### item (continue numbering; status OPEN; tier, cluster, severity, dependsOn, reproCommand, files filled in; needsApproval set honestly). Update tracker.md with its generator and run check-tracker.mjs. Do NOT fix product code. If the cause is a flaky test or environment problem rather than product code, create a finding in tier T11 for it and explain in audit/runs/ENV-NOTE-T${t}.md.`);
}

async function handleStuck(act, items) {
  const t = act.tier;
  state.unblock[t] = (state.unblock[t] ?? 0) + 1;
  saveState();
  const list = act.items.map((i) => `${i.id} [${i.status}] ${i.title ?? ''}: ${blockedReason(i, items)}`).join('\n');
  log(`Nothing in tier T${t} can start. Blockers:\n${list.split('\n').map((l) => '   ' + clip(l, 230)).join('\n')}`);

  if (state.unblock[t] <= MAX_UNBLOCK_PASSES) {
    log(`  unblock pass ${state.unblock[t]} of ${MAX_UNBLOCK_PASSES}: an agent will record conservative ASSUMED decisions`);
    return runAgent(GATE_CMD, 'unblocker', `T${t}`, ctx('UNBLOCKER', `T${t}`, `unblocking tier T${t}`) +
      `No human owner is available. These items in tier T${t} cannot start:\n${list}\n\nFor each BLOCKED item and each open owner decision behind them: pick the safest, most conservative default consistent with the README intent and the cited standards. Record it in audit/tracker/owner-decisions.md as "ASSUMED (autonomous run, ${now().slice(0, 10)})" with the options considered, the choice, why, and how to reverse it. Then update the affected tracker items (BLOCKED -> OPEN with the note "unblocked by assumption A-n"), regenerate tracker.md and run check-tracker.mjs.\nRules: never WONT-FIX a P0 or P1. Never invent legal or tax facts: for GST or legal questions choose configuration-driven behavior (rates and thresholds from tables, not hardcoded) and mark the item NEEDS-PROFESSIONAL-REVIEW. If a decision cannot be made safely, leave the item BLOCKED and write why to audit/runs/UNRESOLVED-T${t}.md.`);
  }

  for (const c of new Set(act.items.map((i) => i.cluster))) {
    park(c, `stuck after ${MAX_UNBLOCK_PASSES} unblock passes: ${act.items.filter((i) => i.cluster === c).map((i) => `${i.id}: ${blockedReason(i, items)}`).join(' | ').slice(0, 500)}`);
  }
}

async function runFinalStage(prompts) {
  mkdirSync(A('final', 'evidence'), { recursive: true });
  log('━━ FINAL RE-AUDIT: every original audit phase is re-run on the remediated code, in fresh sessions', 0);
  const ap = loadAuditPrompts();
  const prefix = `OUTPUT LOCATION OVERRIDE: this is the FINAL RE-AUDIT of the remediated code. Write every file this phase would write under audit/final/ (for example audit/final/phase-04-validation-logging.md, audit/final/evidence/, audit/final/findings/) and never overwrite the original audit files. Do not change product source code. For every NEW finding: write it under audit/final/findings/ AND add it to audit/tracker/tracker.json as a new F-### item (continue numbering; status OPEN; tier, cluster, severity, dependsOn, reproCommand, files filled in; needsApproval set honestly), regenerate tracker.md and run check-tracker.mjs. For every original finding that still reproduces, record VERIFIED -> REOPENED with evidence.\n\n`;

  if (ap) {
    for (let n = 0; n <= 15; n++) {
      if (ap[n]) {
        log(`  final re-audit phase ${n} of 15`);
        await runAgent(VERIFIER_CMD, 'final', `P${n}`, ctx('FINAL-AUDITOR', `P${n}`, `final re-audit, phase ${n}`) + prefix + ap[n]);
      }
    }
  } else {
    log(`WARNING: ${AUDIT_PROMPTS_FILE} not found; the phase-by-phase final re-audit was SKIPPED.`, 0);
  }

  const items = loadItems();
  const P = parkedSet(items);
  const pending = items.filter((i) => isFinding(i) && ACTIVE.has(i.status) && !P.has(i.id));

  if (pending.length && state.finalCycles < MAX_FINAL_CYCLES) {
    state.finalCycles++;
    saveState();
    log(`↺ The final re-audit produced ${pending.length} new or reopened item(s): ${pending.map((i) => i.id).join(', ')}. Fixing them (cycle ${state.finalCycles} of ${MAX_FINAL_CYCLES}).`, 0);
    return 'again';
  }

  await runAgent(VERIFIER_CMD, 'final', 'P7', ctx('FINAL-AUDITOR', 'P7', 'final report and README') +
    `Step 1 of the prompt below was already performed by the orchestrator: the phase re-audits are in audit/final/. Do steps 2 to 5. Write the report to audit/final/FINAL.md. Commit the README rewrite on the remediation branch.\n\n` + prompts['7']);

  const chk = await step(`final full check (${GATE_CHECK_CMD})`, GATE_CHECK_CMD);
  writeFileSync(A('runs', 'final-checks.log'), chk.out);

  const reportFile = A('final', 'FINAL.md');
  const reportWritten = existsSync(reportFile) && statSync(reportFile).size > 100;
  const checksPassed = chk.code === 0;

  state.finalChecksPassed = checksPassed;
  state.finalReportWritten = reportWritten;
  state.finalDone = checksPassed && reportWritten;
  saveState();

  if (!state.finalDone) {
    die(`Final stage failed technical acceptance: checksPassed=${checksPassed}, reportWritten=${reportWritten}`, 3);
  }

  return 'complete';
}

// ---------- progress ----------
function progress(items) {
  const f = items.filter(isFinding);
  if (!f.length) return;
  const P = parkedSet(items);
  const n = (fn) => f.filter(fn).length;
  const ver = n((i) => i.status === 'VERIFIED');
  const remainingFindings = n((i) => !isDone(i.status) && !P.has(i.id));
  const remainingClusters = new Set(f.filter((i) => !isDone(i.status) && !P.has(i.id)).map((i) => i.cluster)).size;
  let eta = '';
  if (ver >= 3 && remainingFindings && state.agentMs > 60000) eta = ` | rough ETA ${dur((state.agentMs / ver) * remainingFindings)} (agent time only)`;

  log(`━━ PROGRESS ${ver}/${f.length} findings verified (${Math.round((100 * ver) / f.length)}%) | ${n((i) => i.status === 'FIXED-UNVERIFIED')} awaiting verification | ${n((i) => P.has(i.id))} parked | ${n((i) => i.status === 'WONT-FIX')} won't-fix | ${remainingClusters} cluster(s) left | agent runs ${state.runs} | tokens ${state.tokens.total} | elapsed ${dur(Date.now() - START)}${eta}`);

  const tiers = [...new Set(f.map(tierNum))].sort((a, b) => a - b);
  for (const t of tiers) {
    const x = f.filter((i) => tierNum(i) === t);
    const gate = state.gateWaived[t] ? 'gate WAIVED' : existsSync(A('gates', `T${t}.json`)) ? 'gate passed' : 'gate pending';
    log(`     T${t}: ${x.filter((i) => i.status === 'VERIFIED').length}/${x.length} verified, ${x.filter((i) => i.status === 'FIXED-UNVERIFIED').length} awaiting verification, ${x.filter((i) => ACTIVE.has(i.status) || i.status === 'BLOCKED').length} open, ${x.filter((i) => P.has(i.id)).length} parked | ${gate}`);
  }
}

// ---------- reporting ----------
function writeSummary() {
  if (!existsSync(A('tracker', 'tracker.json'))) return;
  const items = loadItems().filter(isFinding);
  const P = parkedSet(loadItems());
  const by = {};
  for (const i of items) by[i.status] = (by[i.status] ?? 0) + 1;
  const read = (f) => (existsSync(A('runs', f)) ? readFileSync(A('runs', f), 'utf8').trim() : '');
  const L = [];
  L.push(`# Autonomous run summary (${now()})`, '', `Mode: ${AUTONOMOUS ? 'AUTONOMOUS' : 'supervised'} | agent runs: ${state.runs} | tokens: ${state.tokens?.total ?? 0} | elapsed this process: ${Math.round((Date.now() - START) / 60000)} min`, '');
  L.push('## Status counts', ...Object.entries(by).map(([k, v]) => `- ${k}: ${v}`), '');
  const contra = Object.entries(state.contradicted).filter(([id]) => items.find((i) => i.id === id && i.status === 'VERIFIED'));
  L.push(`## CONTRADICTED: the agent says VERIFIED but the independent checks FAILED. Treat as NOT fixed (${contra.length})`, ...contra.map(([id, w]) => `- ${id}: ${w.replace(/\n/g, ' ')}`), '');
  const parked = items.filter((i) => P.has(i.id));
  L.push(`## PARKED, a human must handle these (${parked.length})`, ...parked.map((i) => `- ${i.id} [${i.severity}] ${i.title ?? ''} :: ${state.parked[i.cluster] ?? 'depends on a parked item'}`), '');
  L.push('## Waived tier gates (a gate never passed)', ...(Object.keys(state.gateWaived).length ? Object.entries(state.gateWaived).map(([t, w]) => `- T${t}: ${w}`) : ['- none']), '');
  L.push('## WONT-FIX items', ...(items.filter((i) => i.status === 'WONT-FIX').map((i) => `- ${i.id} [${i.severity}] ${i.title ?? ''}`)), '');
  L.push('## Revert-checks skipped (regression test not independently proven)', ...(Object.keys(state.skippedRevert).length ? Object.entries(state.skippedRevert).map(([k, v]) => `- ${k}: ${v}`) : ['- none']), '');
  L.push('## Auto-approved schema/permission/API changes (review every one)', read('auto-approvals.log') || '- none', '');
  L.push('## Assumptions made without an owner', '- see audit/tracker/owner-decisions.md (entries marked ASSUMED)', '');
  L.push('## Agent STOP requests handled autonomously', read('agent-stops.log') ? '- see audit/runs/agent-stops.log' : '- none', '');
  L.push('## Final re-audit', `- finished: ${state.finalDone ? 'yes' : 'no'} | full check suite green at the end: ${state.finalChecksPassed ?? 'n/a'} | FINAL.md written: ${state.finalReportWritten ?? 'n/a'}`, '');
  L.push('## Still needs a human before go-live', '- Accountant review of GST rates, HSN, place of supply, invoice numbering, e-invoicing applicability', '- Real screen-reader and keyboard testing by a person (automated checks cover only part of WCAG)', '- Review of every PARKED item, WAIVED gate, auto-approval and ASSUMED decision above', '- Staging dry run with production-like data, and a restore drill', '');
  writeFileSync(A('runs', 'AUTONOMOUS-SUMMARY.md'), L.join('\n'));
}

// ---------- guards and CLI helpers ----------
function dbGuard() {
  const urls = [];
  if (env.DATABASE_URL) urls.push(env.DATABASE_URL);
  for (const f of ['server/.env', '.env']) {
    const p = join(ROOT, f);
    if (existsSync(p)) {
      const m = /^\s*DATABASE_URL\s*=\s*["']?([^"'\r\n]+)/m.exec(readFileSync(p, 'utf8'));
      if (m) urls.push(m[1]);
    }
  }
  const okHosts = ['localhost', '127.0.0.1', '::1', '[::1]', 'db', 'postgres', 'host.docker.internal'];
  for (const u of urls) {
    let host = '';
    try { host = new URL(u).hostname; } catch { continue; }
    if (!okHosts.includes(host) && env.ALLOW_REMOTE_DB !== '1') {
      die(`DATABASE_URL points to "${host}", which is not local. An unattended agent with write access must never touch a shared or production database. Use a throwaway local DB (or set ALLOW_REMOTE_DB=1 at your own risk).`);
    }
  }
}

function why(items) {
  const open = items.filter((i) => isFinding(i) && !isDone(i.status)).sort((a, b) => tierNum(a) - tierNum(b));
  for (const i of open) console.log(`T${tierNum(i)} ${i.id} ${i.severity} ${i.cluster} [${i.status}] ${String(i.title ?? '').slice(0, 70)}\n     -> ${blockedReason(i, items)}`);
}

function approve(arg) {
  const ids = arg.split(',').map((x) => x.trim()).filter(Boolean);
  const next = [...new Set([...readApprovals(), ...ids])];
  writeFileSync(A('tracker', 'approvals.json'), JSON.stringify(next, null, 2));
  console.log('approvals.json now:', next.join(', '));
}

function plan(items) {
  const f = items.filter(isFinding);
  const counts = {};
  for (const i of f) { const k = `T${tierNum(i)} ${i.status}`; counts[k] = (counts[k] ?? 0) + 1; }
  console.log('Items by tier and status:');
  for (const k of Object.keys(counts).sort((a, b) => parseInt(a.slice(1)) - parseInt(b.slice(1)) || a.localeCompare(b))) console.log(`  ${k}: ${counts[k]}`);
  console.log('Parked clusters:', Object.keys(state.parked).join(', ') || 'none');
  console.log('Next action:', JSON.stringify(nextAction(items), (k, v) => (k === 'items' ? v.map((i) => i.id) : v)));
  console.log(`Mode: ${AUTONOMOUS ? 'AUTONOMOUS' : 'supervised'} | revert-check: unit ${TEST_FILE_CMD ? 'ON' : 'OFF'}, e2e ${E2E_FILE_CMD ? 'ON' : 'OFF'} | escalation agent: ${ESCALATE_CMD ? 'set' : 'not set'}`);
}

// Export internal primitives for automated testing
export {
  run,
  sh,
  killTree,
  nextAction,
  computeTierFingerprint,
  revertCheck,
  getDbSnapshotCmd,
  loadItems,
  blockedReason,
  parkedSet,
  dbGuard,
  ctx
};

// ---------- main execution ----------
if (process.argv[1] && process.argv[1].endsWith('orchestrate.mjs')) {
  const items0 = loadItems();
  if (process.argv.includes('--why')) { why(items0); process.exit(0); }
  const ai = process.argv.indexOf('--approve');
  if (ai > -1) { approve(process.argv[ai + 1] ?? ''); process.exit(0); }
  if (PLAN_ONLY) { plan(items0); process.exit(0); }

  if (AUTONOMOUS) {
    if (env.CONFIRM_SANDBOX !== 'yes') die('AUTONOMOUS=1 gives an agent unattended write and command access. Run it only inside a disposable container or VM, with a throwaway local database, then set CONFIRM_SANDBOX=yes.');
    if (!TEST_FILE_CMD) die('AUTONOMOUS=1 requires TEST_FILE_CMD: independent regression-test validation is the only guard when no human reviews the fixes.');
  }

  dbGuard();
  const prompts = loadPrompts();

  if (AUTONOMOUS) {
    const p7 = extract(PROMPTS_FILE, /^# PROMPT (\d+)[^\n]*\n[\s\S]*?```text\n([\s\S]*?)\n```/gm, ['7'], 'Fix prompts');
    prompts['7'] = p7['7'];
  }

  process.on('exit', () => { try { writeSummary(); } catch { /* best effort */ } });

  log('════════════════════════════════════════════════════════════');
  log(`MillLedger orchestrator v3 started | mode ${AUTONOMOUS ? 'AUTONOMOUS' : 'supervised'} | verbosity ${VERBOSE} | live log: tail -f ${LOG_FILE}`, 0);
  log(`  fixer: ${clip(FIXER_CMD, 130)}\n  verifier: ${clip(VERIFIER_CMD, 130)}${ESCALATE_CMD ? '\n  escalation: ' + clip(ESCALATE_CMD, 130) : ''}`);
  log(`  independent revert-check: unit ${TEST_FILE_CMD ? 'ON' : 'OFF'}, e2e ${E2E_FILE_CMD ? 'ON' : 'OFF'} | limits: ${MAX_ATTEMPTS} attempts/cluster, ${MAX_RUNS} runs, ${AUTONOMOUS ? MAX_HOURS + ' h' : 'no time limit'}, ${AGENT_TIMEOUT_MIN} min/agent run | stall timeout ${STALL_TIMEOUT_SEC}s`);

  for (;;) {
    if (AUTONOMOUS && (Date.now() - START) / 3600000 > MAX_HOURS) done(`\nMAX_HOURS (${MAX_HOURS}) reached. Progress is saved; re-run to continue.`, 3);
    const items = loadItems();
    progress(items);
    const act = nextAction(items);

    if (act.type === 'done') {
      if (!AUTONOMOUS) done('\nAll tiers VERIFIED and gated. Now run Prompt 7 (final re-audit) in fresh sessions.');
      if (state.finalDone) done('\nAutonomous run complete. Read audit/runs/AUTONOMOUS-SUMMARY.md.');
      if ((await runFinalStage(prompts)) === 'again') continue;
      done('\nAutonomous run complete. Read audit/runs/AUTONOMOUS-SUMMARY.md and audit/final/FINAL.md.');
    }

    if (act.type === 'pause') done(`\nTier T${act.tier} gate PASSED. Do your spot check (3 random VERIFIED items), then: touch audit/gates/T${act.tier}.accepted and re-run.`, 3);

    if (act.type === 'stuck') {
      if (AUTONOMOUS) { log(`\n▓▓ NEXT: STUCK in tier T${act.tier}`); await handleStuck(act, items); continue; }
      log(`\nNo eligible work in tier T${act.tier}. Why each remaining item is blocked:`, 0);
      for (const i of act.items) log(`  ${i.id} [${i.status}] ${String(i.title ?? '').slice(0, 60)}\n      -> ${blockedReason(i, items)}`, 0);
      done('\nReview items needing approval (node orchestrate.mjs --why), then: node orchestrate.mjs --approve F-009,F-010 and re-run.', 3);
    }

    log(`\n▓▓ NEXT: ${act.type.toUpperCase()} ${act.cluster ?? 'T' + act.tier}`);
    if (act.type === 'fix') await doFix(prompts, act);
    else if (act.type === 'verify') await doVerify(prompts, act);
    else if (act.type === 'gate') await doGate(prompts, act);
  }
}
