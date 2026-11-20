#!/usr/bin/env node
/**
 * MillLedger remediation orchestrator v2 (supervised or AUTONOMOUS).
 *
 * One launch command, many FRESH agent sessions. The script (not an AI) decides what runs next, enforces rules, and
 * re-checks the agents' claims itself. It reads audit/tracker/tracker.json built by Prompt 1.
 *
 * SUPERVISED (default): stops for your approvals and a spot check after every tier.
 * AUTONOMOUS (AUTONOMOUS=1): works through EVERY finding with no human in the loop:
 *   fix -> independent verify -> tier gate -> (reopen failures) -> next tier -> final re-audit of phases 0-15.
 *   It auto-approves schema/permission/API changes (logged), resolves owner questions with recorded ASSUMPTIONS,
 *   escalates hard clusters to a stronger model, and PARKS what it cannot finish instead of faking a pass.
 *   Read audit/runs/AUTONOMOUS-SUMMARY.md afterwards: it lists everything a human must still look at.
 *
 * Usage (repo root, remediation branch, inside a disposable container or VM, with a LOCAL throwaway database):
 *   node orchestrate.mjs --plan      # queue and next action, runs nothing
 *   node orchestrate.mjs --why       # every open item and exactly why it is blocked
 *   node orchestrate.mjs --approve F-009,CLUSTER-02   # supervised mode: record your approval
 *   node orchestrate.mjs             # run
 *
 * Antigravity CLI (agy) command shape (from https://antigravity.google/docs/cli/headless; verify with `agy --help`
 * and `agy models`). The prompt is handed over as a FILE the agent reads, which avoids quoting/length problems:
 *   FIXER_CMD='agy -p "Read {promptFile} and carry out every instruction in it exactly." --model gemini-3.8-flash-medium --dangerously-skip-permissions --output-format json --print-timeout 50m'
 *
 * Env vars
 *   FIXER_CMD (required)  VERIFIER_CMD (default FIXER_CMD)  GATE_CMD (default VERIFIER_CMD)
 *   ESCALATE_CMD          Stronger agent used for a cluster's later attempts (AUTONOMOUS). Strongly recommended.
 *   TEST_FILE_CMD         Runs ONE unit/integration test file, {file} placeholder. REQUIRED for AUTONOMOUS.
 *   E2E_FILE_CMD          Runs ONE Playwright spec ({file}). Files matching *.spec.* or /e2e/ use this command.
 *                         If unset, the revert-check for those findings is skipped and listed in the summary.
 *   INSTALL_CMD           Run in the scratch worktree (default: pnpm install --frozen-lockfile)
 *   CHECK_CMD             After each fix/verify (default: pnpm typecheck && pnpm lint && pnpm test)
 *   GATE_CHECK_CMD        At each tier gate (default: CHECK_CMD && pnpm build && pnpm test:e2e && pnpm benchmark)
 *   DB_SNAPSHOT_CMD       Optional, run before any fix that needs approval (e.g. a pg_dump of the throwaway DB)
 *   AUDIT_PROMPTS_FILE    MILLLEDGER_AUDIT_PROMPTS.md (for the final re-audit; default ./MILLLEDGER_AUDIT_PROMPTS.md)
 *   PROMPTS_FILE          MILLLEDGER_FIX_TRACKER_PROMPTS.md (default ./MILLLEDGER_FIX_TRACKER_PROMPTS.md)
 *   MAX_ATTEMPTS (4 supervised / 6 autonomous)  MAX_RUNS (200 / 800)  MAX_HOURS (autonomous, default 72)
 *   MAX_GATE_ATTEMPTS (3)  MAX_UNBLOCK_PASSES (2)  MAX_FINAL_CYCLES (2)  AGENT_TIMEOUT_MIN (60)
 *   CONFIRM_SANDBOX=yes   Required for AUTONOMOUS: you confirm this runs in a disposable environment.
 *   ALLOW_REMOTE_DB=1     Override the refusal to run when DATABASE_URL is not local.
 *   PAUSE_AFTER_TIER=0    Supervised mode: do not stop after each tier gate.
 */
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const ROOT = process.cwd();
const A = (...p) => join(ROOT, 'audit', ...p);
const env = process.env;
const AUTONOMOUS = env.AUTONOMOUS === '1';
const PROMPTS_FILE = env.PROMPTS_FILE ?? join(ROOT, 'MILLLEDGER_FIX_TRACKER_PROMPTS.md');
const AUDIT_PROMPTS_FILE = env.AUDIT_PROMPTS_FILE ?? join(ROOT, 'MILLLEDGER_AUDIT_PROMPTS.md');
const FIXER_CMD = env.FIXER_CMD;
const VERIFIER_CMD = env.VERIFIER_CMD ?? FIXER_CMD;
const GATE_CMD = env.GATE_CMD ?? VERIFIER_CMD;
const ESCALATE_CMD = env.ESCALATE_CMD;
const TEST_FILE_CMD = env.TEST_FILE_CMD;
const E2E_FILE_CMD = env.E2E_FILE_CMD;
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
const AGENT_TIMEOUT_MIN = Number(env.AGENT_TIMEOUT_MIN ?? 60);
const PAUSE_AFTER_TIER = !AUTONOMOUS && env.PAUSE_AFTER_TIER !== '0';
const PLAN_ONLY = process.argv.includes('--plan');
const START = Date.now();

const done = (msg, code = 0) => { console.log(msg); process.exit(code); };
const die = (msg, code = 2) => { console.error('\nSTOP: ' + msg); process.exit(code); };
const tail = (s, n = 3000) => (s.length > n ? '...' + s.slice(-n) : s);
const now = () => new Date().toISOString();

function sh(cmd, { cwd = ROOT, input, timeout } = {}) {
  const r = spawnSync(cmd, { cwd, shell: true, input, encoding: 'utf8', maxBuffer: 1 << 28, timeout, killSignal: 'SIGKILL' });
  const timedOut = r.error && r.error.code === 'ETIMEDOUT';
  return { code: r.status ?? 1, out: (r.stdout ?? '') + (r.stderr ?? '') + (timedOut ? `\n[orchestrator] killed after ${timeout} ms timeout` : '') };
}

// ---------- state ----------
mkdirSync(A('runs'), { recursive: true });
mkdirSync(A('gates'), { recursive: true });
const STATE_FILE = A('runs', 'state.json');
const state = Object.assign(
  { runs: 0, attempts: {}, feedback: {}, parked: {}, contradicted: {}, gateAttempts: {}, gateWaived: {}, unblock: {}, skippedRevert: {}, finalCycles: 0, finalDone: false },
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

// Items in a parked cluster, plus anything that depends (transitively) on a parked item, are set aside.
function parkedSet(items) {
  const open = items.filter((i) => isFinding(i) && !isDone(i.status));
  const P = new Set(open.filter((i) => state.parked[i.cluster]).map((i) => i.id));
  for (let ch = true; ch;) {
    ch = false;
    for (const i of open) if (!P.has(i.id) && (i.dependsOn ?? []).some((d) => P.has(d))) { P.add(i.id); ch = true; }
  }
  return P;
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
      try { ok = existsSync(g) && JSON.parse(readFileSync(g, 'utf8')).result === 'PASS'; } catch { ok = false; }
      if (!ok) return { type: 'gate', tier: t };
      if (PAUSE_AFTER_TIER && !existsSync(A('gates', `T${t}.accepted`))) return { type: 'pause', tier: t };
      continue;
    }
    const live = inTier.filter((i) => !P.has(i.id));
    const clusters = [...new Set(live.map((i) => i.cluster))];
    for (const c of clusters) {
      const unver = live.filter((i) => i.cluster === c && i.status === 'FIXED-UNVERIFIED');
      if (unver.length) return { type: 'verify', cluster: c, items: unver };
    }
    const depsMet = (i) => (i.dependsOn ?? []).every((d) => {
      const dep = byId.get(d);
      return !dep || isDone(dep.status) || (dep.cluster === i.cluster && ACTIVE.has(dep.status) && isApproved(dep, ap) && !P.has(dep.id));
    });
    const eligible = clusters
      .map((c) => ({ c, ready: live.filter((i) => i.cluster === c && ACTIVE.has(i.status) && isApproved(i, ap) && depsMet(i)) }))
      .filter((x) => x.ready.length);
    if (eligible.length) {
      const sev = (x) => Math.min(...x.ready.map((i) => Number(String(i.severity).replace(/\D/g, '')) || 9));
      eligible.sort((a, b) => sev(a) - sev(b) || String(a.c).localeCompare(String(b.c)));
      return { type: 'fix', cluster: eligible[0].c, items: eligible[0].ready };
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
  if (needsApproval(i) && !isApproved(i, ap)) why.push(`needs your approval (${i.needsApproval}) -> add "${i.id}" to audit/tracker/approvals.json`);
  for (const d of i.dependsOn ?? []) {
    const dep = byId.get(d);
    if (dep && !isDone(dep.status) && !(dep.cluster === i.cluster && ACTIVE.has(dep.status) && isApproved(dep, ap))) why.push(`waits for ${d} [${dep.status}${needsApproval(dep) && !isApproved(dep, ap) ? ', needs approval' : ''}]`);
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
---
`;

// ---------- agent runner ----------
function runAgent(cmd, role, tag, prompt) {
  if (!cmd) die(`No command set for the ${role} role (set FIXER_CMD / VERIFIER_CMD / GATE_CMD).`);
  if (++state.runs > MAX_RUNS) { saveState(); die(`MAX_RUNS (${MAX_RUNS}) reached. Re-run to continue after raising it.`, 3); }
  const base = A('runs', `${String(state.runs).padStart(3, '0')}-${role}-${tag}`);
  writeFileSync(base + '.prompt.md', prompt);
  const viaFile = cmd.includes('{promptFile}');
  const full = viaFile ? cmd.replaceAll('{promptFile}', base + '.prompt.md') : cmd;
  const t0 = Date.now();
  const r = sh(full, { input: viaFile ? undefined : prompt, timeout: AGENT_TIMEOUT_MIN * 60000 });
  writeFileSync(base + '.log', r.out);
  saveState();
  console.log(`[${role}] ${tag} exit=${r.code} ${Math.round((Date.now() - t0) / 1000)}s  log: ${base}.log`);
  const stop = A('runs', `STOP-${tag}.md`);
  if (existsSync(stop)) {
    if (!AUTONOMOUS) die(`The agent asked for a human decision: ${stop}`, 3);
    appendFileSync(A('runs', 'agent-stops.log'), `${now()} ${tag}: ${readFileSync(stop, 'utf8').slice(0, 1500)}\n---\n`);
    writeFileSync(stop + '.seen', readFileSync(stop, 'utf8'));
    sh(`node -e "require('fs').unlinkSync(process.argv[1])" "${stop}"`);
  }
  return r;
}

// ---------- independent checks ----------
function trackerValid() {
  const f = A('tracker', 'check-tracker.mjs');
  if (!existsSync(f)) return { ok: false, why: 'check-tracker.mjs missing' };
  const r = sh(`node "${f}"`);
  return { ok: r.code === 0, why: tail(r.out) };
}
const EXCLUDES = '":(exclude)audit" ":(exclude)orchestrate.mjs" ":(exclude)MILLLEDGER_FIX_TRACKER_PROMPTS.md" ":(exclude)MILLLEDGER_AUDIT_PROMPTS.md" ":(exclude)AGENTS.md"';
function treeState() {
  const branch = sh('git rev-parse --abbrev-ref HEAD').out.trim();
  const dirty = sh(`git status --porcelain -- . ${EXCLUDES}`).out.trim();
  return { branch, dirty };
}
const isE2E = (f) => /(\.spec\.|[\\/]e2e[\\/]|playwright)/i.test(f);
function cmdFor(files) {
  if (files.every(isE2E)) return E2E_FILE_CMD;
  if (files.every((f) => !isE2E(f))) return TEST_FILE_CMD;
  return undefined; // mixed unit and e2e: not safely runnable with one command
}
function revertCheck(item) {
  const files = [].concat(item.regressionTest ?? []);
  if (!item.fixCommit || !files.length) return { ok: false, why: `${item.id}: tracker lacks fixCommit or regressionTest` };
  const base = cmdFor(files);
  if (!base) { state.skippedRevert[item.id] = 'no TEST_FILE_CMD/E2E_FILE_CMD for this test type'; saveState(); return { ok: true, skipped: true }; }
  const wt = join(tmpdir(), `ml-verify-${item.id}-${Date.now()}`);
  try {
    let r = sh(`git worktree add --detach "${wt}" ${item.fixCommit}^`);
    if (r.code) return { ok: false, why: `${item.id}: could not create worktree: ${r.out}` };
    r = sh(INSTALL_CMD, { cwd: wt });
    if (r.code) return { ok: false, why: `${item.id}: install failed in scratch worktree: ${tail(r.out)}` };
    sh(`git checkout ${item.fixCommit} -- ${files.map((f) => `"${f}"`).join(' ')}`, { cwd: wt });
    const cmd = base.replaceAll('{file}', files.join(' '));
    const without = sh(cmd, { cwd: wt });
    writeFileSync(A('runs', `revert-${item.id}-without-fix.log`), without.out);
    if (without.code === 0) return { ok: false, why: `${item.id}: regression test PASSES without the fix, so it proves nothing` };
    sh(`git checkout -f --detach ${item.fixCommit}`, { cwd: wt });
    const withFix = sh(cmd, { cwd: wt });
    writeFileSync(A('runs', `revert-${item.id}-with-fix.log`), withFix.out);
    if (withFix.code !== 0) return { ok: false, why: `${item.id}: regression test FAILS with the fix:\n${tail(withFix.out)}` };
    return { ok: true };
  } finally {
    sh(`git worktree remove --force "${wt}"`);
  }
}

const park = (cluster, reason) => { state.parked[cluster] = reason; saveState(); console.log(`[orchestrator] PARKED ${cluster}: ${reason}`); };

// ---------- actions ----------
function doFix(prompts, act) {
  const c = act.cluster;
  state.attempts[c] = (state.attempts[c] ?? 0) + 1;
  if (state.attempts[c] > MAX_ATTEMPTS) {
    saveState();
    if (!AUTONOMOUS) die(`${c}: ${MAX_ATTEMPTS} fixer attempts used. Human review needed.`, 3);
    return park(c, `${MAX_ATTEMPTS} fixer attempts used. Last feedback: ${tail(state.feedback[c] || 'none', 500)}`);
  }
  const t = treeState();
  if (/^(main|master)$/.test(t.branch)) die('Refusing to run on main/master. Use the remediation branch.');
  if (t.dirty) {
    if (!AUTONOMOUS) die(`Working tree is not clean before fixing ${c}:\n${t.dirty}`);
    sh(`git stash push -u -m "orchestrator-leftover-${c}-${Date.now()}" -- . ${EXCLUDES}`);
    appendFileSync(A('runs', 'leftovers.log'), `${now()} stashed leftovers before ${c}:\n${t.dirty}\n`);
  }
  const risky = act.items.filter(needsApproval);
  if (AUTONOMOUS && risky.length) {
    appendFileSync(A('runs', 'auto-approvals.log'), `${now()} ${c} attempt ${state.attempts[c]}: auto-approved ${risky.map((i) => `${i.id}(${i.needsApproval})`).join(', ')}\n`);
    if (DB_SNAPSHOT_CMD) { const s = sh(DB_SNAPSHOT_CMD); if (s.code) console.warn('[orchestrator] DB_SNAPSHOT_CMD failed: ' + tail(s.out, 300)); }
  }
  sh(`git tag -f pre-${c}-a${state.attempts[c]}`);
  const cmd = AUTONOMOUS && ESCALATE_CMD && state.attempts[c] > 2 ? ESCALATE_CMD : FIXER_CMD;
  const ids = act.items.map((i) => i.id).join(', ');
  let prompt = ctx('FIXER', c, `${c}, findings ${ids} ONLY (leave other findings in this cluster untouched; they are blocked, parked or not yet due)`) + prompts['3'].replace('<CLUSTER-ID or next in queue>', c);
  if (AUTONOMOUS && risky.length) prompt += `\n\nAUTONOMOUS APPROVAL: the schema, permission or public API change for ${risky.map((i) => i.id).join(', ')} is pre-approved. Do not stop to ask. Keep migrations forward-only, additive where possible, with a data-safe backfill, and prove them on a fresh database AND on seeded data.\n`;
  if (state.feedback[c]) {
    prompt += `\n\nORCHESTRATOR FEEDBACK FROM THE PREVIOUS ATTEMPT (address this first). For any item already at FIXED-UNVERIFIED, record FIXED-UNVERIFIED -> REJECTED -> IN-PROGRESS in statusHistory with the note "orchestrator check failed", then fix:\n${state.feedback[c]}\n`;
    state.feedback[c] = '';
  }
  runAgent(cmd, 'fixer', c, prompt);
  const problems = [];
  const after = treeState();
  if (after.dirty) problems.push('Uncommitted changes remain after the fix:\n' + after.dirty);
  const chk = sh(CHECK_CMD);
  writeFileSync(A('runs', `check-after-fix-${c}.log`), chk.out);
  if (chk.code) problems.push(`CHECK_CMD failed:\n${tail(chk.out)}`);
  const tv = trackerValid();
  if (!tv.ok) problems.push('Tracker validator failed:\n' + tv.why);
  state.feedback[c] = problems.join('\n\n');
  saveState();
  if (problems.length) console.log(`[orchestrator] ${c}: checks failed after fix; the next attempt gets the failure details.`);
}

function overridePrompt(base, failures) {
  return base + `\n\nORCHESTRATOR OVERRIDE: independent checks contradict the verdict. For each affected item record the legal transition: if it is FIXED-UNVERIFIED set REJECTED; if it is already VERIFIED set VERIFIED -> REOPENED. Attach this evidence and update tracker.md and run check-tracker.mjs. Do not fix code.\n${failures.map((f) => `- ${f.why}`).join('\n\n')}\n`;
}

function doVerify(prompts, act) {
  const c = act.cluster;
  const ids = act.items.map((i) => i.id).join(', ');
  const base = ctx('VERIFIER', c, `${c} (items to verify: ${ids})`) + prompts['4'].replace('<CLUSTER-ID>', c);
  runAgent(VERIFIER_CMD, 'verifier', c, base);
  const verified = () => loadItems().filter((i) => act.items.some((x) => x.id === i.id) && i.status === 'VERIFIED');
  const failures = [];
  for (const it of verified()) {
    const r = revertCheck(it);
    if (!r.ok) failures.push({ id: it.id, why: r.why });
  }
  let chk = sh(CHECK_CMD);
  writeFileSync(A('runs', `check-after-verify-${c}.log`), chk.out);
  if (chk.code) {
    if (!AUTONOMOUS) die(`CHECK_CMD failed after verifying ${c}:\n${tail(chk.out)}`, 3);
    for (const it of verified()) failures.push({ id: it.id, why: `${it.id}: the full check suite is RED after this cluster was verified:\n${tail(chk.out, 1500)}` });
  }
  if (failures.length) {
    runAgent(VERIFIER_CMD, 'verifier', c + '-override', overridePrompt(base, failures));
    const still = verified().filter((i) => failures.some((f) => f.id === i.id));
    if (still.length) {
      if (!AUTONOMOUS) die(`Verifier and orchestrator disagree on ${c}. Human review needed.`, 3);
      for (const i of still) state.contradicted[i.id] = (failures.find((f) => f.id === i.id)?.why ?? 'independent check failed').slice(0, 400);
      park(c, `verifier and orchestrator disagree on ${still.map((i) => i.id).join(', ')}: ${failures[0].why.slice(0, 300)}`);
    }
    return;
  }
  let tv = trackerValid();
  if (!tv.ok) {
    if (AUTONOMOUS) {
      runAgent(GATE_CMD, 'tracker-repair', c, ctx('TRACKER-REPAIR', c, 'tracker bookkeeping only') + `The tracker validator failed after verification of ${c}:\n${tv.why}\nFix tracker.json / tracker.md bookkeeping ONLY (never edit check-tracker.mjs, never change any status to hide a problem), then re-run the validator.`);
      tv = trackerValid();
    }
    if (!tv.ok) die('Tracker validator failed after verification:\n' + tv.why, 3);
  }
}

function doGate(prompts, act) {
  const t = act.tier;
  let failure = null;
  const pre = sh(GATE_CHECK_CMD);
  writeFileSync(A('runs', `gate-T${t}-checks.log`), pre.out);
  if (pre.code) failure = `GATE_CHECK_CMD failed for tier T${t}:\n${tail(pre.out)}`;
  if (!failure) {
    const extra = `\n\nWrite your verdict to audit/gates/T${t}.json as {"result":"PASS"|"FAIL","failedChecks":[...],"reopen":[ids]}.`;
    runAgent(GATE_CMD, 'gate', `T${t}`, ctx('GATEKEEPER', `T${t}`, `tier T${t}`) + prompts['5'].replace('<T#>', `T${t}`) + extra);
    const g = A('gates', `T${t}.json`);
    if (!existsSync(g)) failure = `Gatekeeper did not write ${g}`;
    else {
      try { const res = JSON.parse(readFileSync(g, 'utf8')); if (res.result !== 'PASS') failure = `Gatekeeper verdict FAIL. Failed checks: ${JSON.stringify(res.failedChecks ?? [])}. Reopen: ${(res.reopen ?? []).join(', ')}`; }
      catch { failure = `Gatekeeper wrote an unreadable verdict file ${g}`; }
    }
  }
  if (!failure) return;
  if (!AUTONOMOUS) die(`Tier T${t} gate FAILED: ${failure}`, 3);
  sh(`node -e "try{require('fs').unlinkSync(process.argv[1])}catch(e){}" "${A('gates', `T${t}.json`)}"`);
  state.gateAttempts[t] = (state.gateAttempts[t] ?? 0) + 1;
  if (state.gateAttempts[t] > MAX_GATE_ATTEMPTS) {
    state.gateWaived[t] = failure.slice(0, 600);
    saveState();
    return console.log(`[orchestrator] Tier T${t} gate WAIVED after ${MAX_GATE_ATTEMPTS} attempts (recorded in the summary).`);
  }
  saveState();
  runAgent(GATE_CMD, 'reopener', `T${t}`, ctx('REOPENER', `T${t}`, `tier T${t} gate failure, tracker bookkeeping only`) +
    `Tier T${t} failed its gate:\n${failure}\n\nConvert every failing check into tracker work. For implicated items that are VERIFIED record VERIFIED -> REOPENED with an evidence link. For failures with no matching item create a new F-### item (continue numbering; status OPEN; tier, cluster, severity, dependsOn, reproCommand, files filled in; needsApproval set honestly). Update tracker.md with its generator and run check-tracker.mjs. Do NOT fix product code. If the cause is a flaky test or environment problem rather than product code, create a finding in tier T11 for it and explain in audit/runs/ENV-NOTE-T${t}.md.`);
}

function handleStuck(act, items) {
  const t = act.tier;
  state.unblock[t] = (state.unblock[t] ?? 0) + 1;
  saveState();
  const list = act.items.map((i) => `${i.id} [${i.status}] ${i.title ?? ''}: ${blockedReason(i, items)}`).join('\n');
  if (state.unblock[t] <= MAX_UNBLOCK_PASSES) {
    return runAgent(GATE_CMD, 'unblocker', `T${t}`, ctx('UNBLOCKER', `T${t}`, `unblocking tier T${t}`) +
      `No human owner is available. These items in tier T${t} cannot start:\n${list}\n\nFor each BLOCKED item and each open owner decision behind them: pick the safest, most conservative default consistent with the README intent and the cited standards. Record it in audit/tracker/owner-decisions.md as "ASSUMED (autonomous run, ${now().slice(0, 10)})" with the options considered, the choice, why, and how to reverse it. Then update the affected tracker items (BLOCKED -> OPEN with the note "unblocked by assumption A-n"), regenerate tracker.md and run check-tracker.mjs.\nRules: never WONT-FIX a P0 or P1. Never invent legal or tax facts: for GST or legal questions choose configuration-driven behavior (rates and thresholds from tables, not hardcoded) and mark the item NEEDS-PROFESSIONAL-REVIEW. If a decision cannot be made safely, leave the item BLOCKED and write why to audit/runs/UNRESOLVED-T${t}.md.`);
  }
  for (const c of new Set(act.items.map((i) => i.cluster))) {
    park(c, `stuck after ${MAX_UNBLOCK_PASSES} unblock passes: ${act.items.filter((i) => i.cluster === c).map((i) => `${i.id}: ${blockedReason(i, items)}`).join(' | ').slice(0, 500)}`);
  }
}

function runFinalStage(prompts) {
  mkdirSync(A('final', 'evidence'), { recursive: true });
  const ap = loadAuditPrompts();
  const prefix = `OUTPUT LOCATION OVERRIDE: this is the FINAL RE-AUDIT of the remediated code. Write every file this phase would write under audit/final/ (for example audit/final/phase-04-validation-logging.md, audit/final/evidence/, audit/final/findings/) and never overwrite the original audit files. Do not change product source code. For every NEW finding: write it under audit/final/findings/ AND add it to audit/tracker/tracker.json as a new F-### item (continue numbering; status OPEN; tier, cluster, severity, dependsOn, reproCommand, files filled in; needsApproval set honestly), regenerate tracker.md and run check-tracker.mjs. For every original finding that still reproduces, record VERIFIED -> REOPENED with evidence.\n\n`;
  if (ap) {
    for (let n = 0; n <= 15; n++) if (ap[n]) runAgent(VERIFIER_CMD, 'final', `P${n}`, ctx('FINAL-AUDITOR', `P${n}`, `final re-audit, phase ${n}`) + prefix + ap[n]);
  } else console.warn(`WARNING: ${AUDIT_PROMPTS_FILE} not found; the phase-by-phase final re-audit was SKIPPED.`);
  const items = loadItems();
  const P = parkedSet(items);
  const pending = items.filter((i) => isFinding(i) && ACTIVE.has(i.status) && !P.has(i.id));
  if (pending.length && state.finalCycles < MAX_FINAL_CYCLES) {
    state.finalCycles++; saveState();
    console.log(`[orchestrator] Final re-audit produced ${pending.length} new/reopened items; fixing them (cycle ${state.finalCycles}/${MAX_FINAL_CYCLES}).`);
    return 'again';
  }
  runAgent(VERIFIER_CMD, 'final', 'P7', ctx('FINAL-AUDITOR', 'P7', 'final report and README') +
    `Step 1 of the prompt below was already performed by the orchestrator: the phase re-audits are in audit/final/. Do steps 2 to 5. Write the report to audit/final/FINAL.md. Commit the README rewrite on the remediation branch.\n\n` + prompts['7']);
  const chk = sh(GATE_CHECK_CMD);
  writeFileSync(A('runs', 'final-checks.log'), chk.out);
  state.finalDone = true;
  state.finalChecksPassed = chk.code === 0;
  state.finalReportWritten = existsSync(A('final', 'FINAL.md'));
  saveState();
  return 'complete';
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
  L.push(`# Autonomous run summary (${now()})`, '', `Mode: ${AUTONOMOUS ? 'AUTONOMOUS' : 'supervised'} | agent runs: ${state.runs} | elapsed this process: ${Math.round((Date.now() - START) / 60000)} min`, '');
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
    if (existsSync(p)) { const m = /^\s*DATABASE_URL\s*=\s*["']?([^"'\r\n]+)/m.exec(readFileSync(p, 'utf8')); if (m) urls.push(m[1]); }
  }
  const okHosts = ['localhost', '127.0.0.1', '::1', '[::1]', 'db', 'postgres', 'host.docker.internal'];
  for (const u of urls) {
    let host = '';
    try { host = new URL(u).hostname; } catch { continue; }
    if (!okHosts.includes(host) && env.ALLOW_REMOTE_DB !== '1') die(`DATABASE_URL points to "${host}", which is not local. An unattended agent with write access must never touch a shared or production database. Use a throwaway local DB (or set ALLOW_REMOTE_DB=1 at your own risk).`);
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

// ---------- main ----------
const items0 = loadItems();
if (process.argv.includes('--why')) { why(items0); process.exit(0); }
const ai = process.argv.indexOf('--approve');
if (ai > -1) { approve(process.argv[ai + 1] ?? ''); process.exit(0); }
if (PLAN_ONLY) { plan(items0); process.exit(0); }
if (!FIXER_CMD) die('Set FIXER_CMD (and preferably a different VERIFIER_CMD).');
if (AUTONOMOUS) {
  if (env.CONFIRM_SANDBOX !== 'yes') die('AUTONOMOUS=1 gives an agent unattended write and command access. Run it only inside a disposable container or VM, with a throwaway local database, then set CONFIRM_SANDBOX=yes.');
  if (!TEST_FILE_CMD) die('AUTONOMOUS=1 requires TEST_FILE_CMD: independent regression-test validation is the only guard when no human reviews the fixes.');
  if (!ESCALATE_CMD) console.warn('WARNING: ESCALATE_CMD is not set; hard clusters will keep using the same model until they are parked.');
}
dbGuard();
const prompts = loadPrompts();
if (!AUTONOMOUS && !TEST_FILE_CMD) console.warn('WARNING: TEST_FILE_CMD is not set; the orchestrator cannot independently prove regression tests fail without the fix.');
if (VERIFIER_CMD === FIXER_CMD) console.warn('WARNING: verifier uses the same command as the fixer. A different model or tool gives stronger verification.');
if (AUTONOMOUS) {
  const p7 = extract(PROMPTS_FILE, /^# PROMPT (\d+)[^\n]*\n[\s\S]*?```text\n([\s\S]*?)\n```/gm, ['7'], 'Fix prompts');
  prompts['7'] = p7['7'];
}
process.on('exit', () => { try { writeSummary(); } catch { /* best effort */ } });

for (;;) {
  if (AUTONOMOUS && (Date.now() - START) / 3600000 > MAX_HOURS) done(`\nMAX_HOURS (${MAX_HOURS}) reached. Progress is saved; re-run to continue.`, 3);
  const items = loadItems();
  const act = nextAction(items);
  if (act.type === 'done') {
    if (!AUTONOMOUS) done('\nAll tiers VERIFIED and gated. Now run Prompt 7 (final re-audit) in fresh sessions.');
    if (state.finalDone) done('\nAutonomous run complete. Read audit/runs/AUTONOMOUS-SUMMARY.md.');
    if (runFinalStage(prompts) === 'again') continue;
    done('\nAutonomous run complete. Read audit/runs/AUTONOMOUS-SUMMARY.md and audit/final/FINAL.md.');
  }
  if (act.type === 'pause') done(`\nTier T${act.tier} gate PASSED. Do your spot check (3 random VERIFIED items), then: touch audit/gates/T${act.tier}.accepted and re-run.`, 3);
  if (act.type === 'stuck') {
    if (AUTONOMOUS) { console.log(`\n=== STUCK T${act.tier} ===`); handleStuck(act, items); continue; }
    console.log(`\nNo eligible work in tier T${act.tier}. Why each remaining item is blocked:`);
    for (const i of act.items) console.log(`  ${i.id} [${i.status}] ${String(i.title ?? '').slice(0, 60)}\n      -> ${blockedReason(i, items)}`);
    done('\nReview the items needing approval (node orchestrate.mjs --why), then: node orchestrate.mjs --approve F-009,F-010 and re-run.', 3);
  }
  console.log(`\n=== ${act.type.toUpperCase()} ${act.cluster ?? 'T' + act.tier} ===`);
  if (act.type === 'fix') doFix(prompts, act);
  else if (act.type === 'verify') doVerify(prompts, act);
  else if (act.type === 'gate') doGate(prompts, act);
}