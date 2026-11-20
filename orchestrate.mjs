#!/usr/bin/env node
/**
 * MillLedger remediation orchestrator.
 *
 * One launch command, many FRESH agent sessions. The script (not an AI) decides what runs next, enforces the
 * rules, and re-checks the agents' claims itself. It reads /audit/tracker/tracker.json built by Prompt 1.
 *
 * Usage (from the repo root, on the remediation branch, ideally inside a disposable container or VM):
 *   FIXER_CMD="<your agent CLI, non-interactive>" \
 *   VERIFIER_CMD="<a different agent CLI or model>" \
 *   TEST_FILE_CMD="pnpm --filter @mill-ledger/server exec vitest run {file}" \
 *   node orchestrate.mjs            # run the loop
 *   node orchestrate.mjs --plan     # print the queue and the next action, run nothing
 *
 * Antigravity CLI (agy) example, command shape taken from https://antigravity.google/docs/cli/headless
 * (verify with `agy --help` and `agy models` on your machine). The prompt is handed over as a FILE the agent reads,
 * which avoids shell quoting and length problems on every OS:
 *   FIXER_CMD='agy -p "Read {promptFile} and carry out every instruction in it exactly." --model gemini-3.8-flash-medium --dangerously-skip-permissions --output-format json --print-timeout 50m'
 *
 * Env vars (all optional except FIXER_CMD):
 *   FIXER_CMD / VERIFIER_CMD / GATE_CMD   Agent commands. The prompt is sent on stdin, or put {promptFile} in the
 *                                         command to receive a file path instead. Check your tool's `--help` for the
 *                                         non-interactive flag; do not assume it.
 *   TEST_FILE_CMD     Command that runs ONE test file, with {file} placeholder. Enables the independent
 *                     "fails without the fix, passes with it" check.
 *   INSTALL_CMD       Run inside the scratch worktree (default: pnpm install --frozen-lockfile)
 *   CHECK_CMD         Run after each fix and verify (default: pnpm typecheck && pnpm lint && pnpm test)
 *   GATE_CHECK_CMD    Run at each tier gate (default: CHECK_CMD plus build, e2e and benchmark)
 *   MAX_ATTEMPTS      Fixer runs allowed per cluster before stopping (default 4)
 *   MAX_RUNS          Hard cap on total agent runs, a cost guard (default 200)
 *   AGENT_TIMEOUT_MIN Kill an agent run that exceeds this many minutes (default 60)
 *   PAUSE_AFTER_TIER  1 (default) stops after each passed tier gate until you `touch audit/gates/T<n>.accepted`
 *   PROMPTS_FILE      Path to MILLLEDGER_FIX_TRACKER_PROMPTS.md (default: ./MILLLEDGER_FIX_TRACKER_PROMPTS.md)
 *
 * Human files:
 *   audit/tracker/approvals.json   ["F-012","CLUSTER-03"]  ids you approve for schema/permission/API changes
 *   audit/gates/T<n>.accepted      empty file you create after your spot check of that tier
 */
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const ROOT = process.cwd();
const A = (...p) => join(ROOT, 'audit', ...p);
const env = process.env;
const PROMPTS_FILE = env.PROMPTS_FILE ?? join(ROOT, 'MILLLEDGER_FIX_TRACKER_PROMPTS.md');
const FIXER_CMD = env.FIXER_CMD;
const VERIFIER_CMD = env.VERIFIER_CMD ?? FIXER_CMD;
const GATE_CMD = env.GATE_CMD ?? VERIFIER_CMD;
const TEST_FILE_CMD = env.TEST_FILE_CMD;
const INSTALL_CMD = env.INSTALL_CMD ?? 'pnpm install --frozen-lockfile';
const CHECK_CMD = env.CHECK_CMD ?? 'pnpm typecheck && pnpm lint && pnpm test';
const GATE_CHECK_CMD = env.GATE_CHECK_CMD ?? `${CHECK_CMD} && pnpm build && pnpm test:e2e && pnpm benchmark`;
const MAX_ATTEMPTS = Number(env.MAX_ATTEMPTS ?? 4);
const MAX_RUNS = Number(env.MAX_RUNS ?? 200);
const AGENT_TIMEOUT_MIN = Number(env.AGENT_TIMEOUT_MIN ?? 60); // kills a hung agent run (non-TTY hangs are reported for some CLIs)
const PAUSE_AFTER_TIER = env.PAUSE_AFTER_TIER !== '0';
const PLAN_ONLY = process.argv.includes('--plan');

const done = (msg, code = 0) => { console.log(msg); process.exit(code); };
const die = (msg, code = 2) => { console.error('\nSTOP: ' + msg); process.exit(code); };
const tail = (s, n = 3000) => (s.length > n ? '...' + s.slice(-n) : s);

function sh(cmd, { cwd = ROOT, input, timeout } = {}) {
  const r = spawnSync(cmd, { cwd, shell: true, input, encoding: 'utf8', maxBuffer: 1 << 28, timeout, killSignal: 'SIGKILL' });
  const timedOut = r.error && r.error.code === 'ETIMEDOUT';
  return { code: r.status ?? 1, out: (r.stdout ?? '') + (r.stderr ?? '') + (timedOut ? `\n[orchestrator] killed after ${timeout} ms timeout` : '') };
}

// ---------- state ----------
mkdirSync(A('runs'), { recursive: true });
mkdirSync(A('gates'), { recursive: true });
const STATE_FILE = A('runs', 'state.json');
const state = existsSync(STATE_FILE)
  ? JSON.parse(readFileSync(STATE_FILE, 'utf8'))
  : { runs: 0, attempts: {}, feedback: {} };
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
const tierNum = (i) => parseInt(String(i.tier).replace(/\D/g, ''), 10);
const needsApproval = (i) => i.needsApproval && i.needsApproval !== 'none';
const isApproved = (i, ap) => !needsApproval(i) || ap.includes(i.id) || ap.includes(i.cluster);

function nextAction(items) {
  const findings = items.filter((i) => /^F-/.test(i.id) && tierNum(i) >= 1);
  const byId = new Map(items.map((i) => [i.id, i]));
  const ap = readApprovals();
  const tiers = [...new Set(findings.map(tierNum))].sort((a, b) => a - b);
  for (const t of tiers) {
    const inTier = findings.filter((i) => tierNum(i) === t);
    if (inTier.every((i) => isDone(i.status))) {
      const g = A('gates', `T${t}.json`);
      const ok = existsSync(g) && JSON.parse(readFileSync(g, 'utf8')).result === 'PASS';
      if (!ok) return { type: 'gate', tier: t };
      if (PAUSE_AFTER_TIER && !existsSync(A('gates', `T${t}.accepted`))) return { type: 'pause', tier: t };
      continue;
    }
    const clusters = [...new Set(inTier.map((i) => i.cluster))];
    for (const c of clusters) {
      const unver = inTier.filter((i) => i.cluster === c && i.status === 'FIXED-UNVERIFIED');
      if (unver.length) return { type: 'verify', cluster: c, items: unver };
    }
    const eligible = clusters
      .map((c) => ({ c, its: inTier.filter((i) => i.cluster === c && ACTIVE.has(i.status)) }))
      .filter((x) => x.its.length)
      .filter((x) => x.its.every((i) => isApproved(i, ap) && (i.dependsOn ?? []).every((d) => {
        const dep = byId.get(d);
        return !dep || isDone(dep.status) || dep.cluster === x.c;
      })));
    if (eligible.length) {
      const sev = (x) => Math.min(...x.its.map((i) => Number(String(i.severity).replace(/\D/g, '')) || 9));
      eligible.sort((a, b) => sev(a) - sev(b) || String(a.c).localeCompare(String(b.c)));
      return { type: 'fix', cluster: eligible[0].c, items: eligible[0].its };
    }
    return { type: 'stuck', tier: t, items: inTier.filter((i) => !isDone(i.status)) };
  }
  return { type: 'done' };
}

// ---------- prompts ----------
function loadPrompts() {
  if (!existsSync(PROMPTS_FILE)) die(`Prompts file not found: ${PROMPTS_FILE}`);
  const md = readFileSync(PROMPTS_FILE, 'utf8');
  const re = /^# PROMPT (\d+)[^\n]*\n[\s\S]*?```text\n([\s\S]*?)\n```/gm;
  const out = {};
  let m;
  while ((m = re.exec(md))) out[m[1]] = m[2];
  for (const n of ['3', '4', '5']) if (!out[n]) die(`Prompt ${n} not found in ${PROMPTS_FILE}`);
  return out;
}
const ctx = (role, tag, target) =>
  `ORCHESTRATOR CONTEXT (non-interactive run, role: ${role})
- You cannot ask questions. If any STOP CONDITION applies, write the reason to audit/runs/STOP-${tag}.md and exit
  without changing tracker statuses.
- Work ONLY on: ${target}
- Follow the MASTER RULEBOOK in AGENTS.md. The orchestrator independently re-runs tests and checks; claims
  without evidence will be rejected.
---
`;

// ---------- agent runner ----------
function runAgent(cmd, role, tag, prompt) {
  if (!cmd) die(`No command set for the ${role} role (set FIXER_CMD / VERIFIER_CMD / GATE_CMD).`);
  if (++state.runs > MAX_RUNS) { saveState(); die(`MAX_RUNS (${MAX_RUNS}) reached.`, 3); }
  const base = A('runs', `${String(state.runs).padStart(3, '0')}-${role}-${tag}`);
  writeFileSync(base + '.prompt.md', prompt);
  const viaFile = cmd.includes('{promptFile}');
  const full = viaFile ? cmd.replaceAll('{promptFile}', base + '.prompt.md') : cmd;
  const t0 = Date.now();
  const r = sh(full, { input: viaFile ? undefined : prompt, timeout: AGENT_TIMEOUT_MIN * 60000 });
  writeFileSync(base + '.log', r.out);
  saveState();
  console.log(`[${role}] ${tag} exit=${r.code} ${Math.round((Date.now() - t0) / 1000)}s  log: ${base}.log`);
  if (existsSync(A('runs', `STOP-${tag}.md`))) die(`The agent asked for a human decision: audit/runs/STOP-${tag}.md`, 3);
  return r;
}

// ---------- independent checks ----------
function trackerValid() {
  const f = A('tracker', 'check-tracker.mjs');
  if (!existsSync(f)) return { ok: false, why: 'check-tracker.mjs missing' };
  const r = sh(`node "${f}"`);
  return { ok: r.code === 0, why: tail(r.out) };
}
function treeState() {
  const branch = sh('git rev-parse --abbrev-ref HEAD').out.trim();
  // audit/ (tracker, logs, evidence) is bookkeeping, so it does not count as an uncommitted product change
  const dirty = sh('git status --porcelain -- . ":(exclude)audit"').out.trim();
  return { branch, dirty };
}
function revertCheck(item) {
  if (!TEST_FILE_CMD) return { ok: true, skipped: true };
  const files = [].concat(item.regressionTest ?? []);
  if (!item.fixCommit || !files.length) return { ok: false, why: `${item.id}: tracker lacks fixCommit or regressionTest` };
  const wt = join(tmpdir(), `ml-verify-${item.id}-${Date.now()}`);
  try {
    let r = sh(`git worktree add --detach "${wt}" ${item.fixCommit}^`);
    if (r.code) return { ok: false, why: 'could not create worktree: ' + r.out };
    r = sh(INSTALL_CMD, { cwd: wt });
    if (r.code) return { ok: false, why: 'install failed in scratch worktree: ' + tail(r.out) };
    sh(`git checkout ${item.fixCommit} -- ${files.map((f) => `"${f}"`).join(' ')}`, { cwd: wt });
    const cmd = TEST_FILE_CMD.replaceAll('{file}', files.join(' '));
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

// ---------- actions ----------
function doFix(prompts, act) {
  const c = act.cluster;
  state.attempts[c] = (state.attempts[c] ?? 0) + 1;
  if (state.attempts[c] > MAX_ATTEMPTS) { saveState(); die(`${c}: ${MAX_ATTEMPTS} fixer attempts used. Human review needed.`, 3); }
  const { branch, dirty } = treeState();
  if (/^(main|master)$/.test(branch)) die('Refusing to run on main/master. Use the remediation branch.');
  if (dirty) die(`Working tree is not clean before fixing ${c}:\n${dirty}`);
  const ids = act.items.map((i) => i.id).join(', ');
  let prompt = ctx('FIXER', c, `${c} (findings: ${ids})`) + prompts['3'].replace('<CLUSTER-ID or next in queue>', c);
  if (state.feedback[c]) {
    prompt += `\n\nORCHESTRATOR FEEDBACK FROM THE PREVIOUS ATTEMPT (address this first). For any item already at FIXED-UNVERIFIED, record FIXED-UNVERIFIED -> REJECTED -> IN-PROGRESS in statusHistory with the note "orchestrator check failed", then fix:\n${state.feedback[c]}\n`;
    state.feedback[c] = '';
  }
  runAgent(FIXER_CMD, 'fixer', c, prompt);
  const problems = [];
  const t = treeState();
  if (t.dirty) problems.push('Uncommitted changes remain after the fix:\n' + t.dirty);
  const chk = sh(CHECK_CMD);
  writeFileSync(A('runs', `check-after-fix-${c}.log`), chk.out);
  if (chk.code) problems.push(`CHECK_CMD failed:\n${tail(chk.out)}`);
  const tv = trackerValid();
  if (!tv.ok) problems.push('Tracker validator failed:\n' + tv.why);
  state.feedback[c] = problems.join('\n\n');
  saveState();
  if (problems.length) console.log(`[orchestrator] ${c}: checks failed after fix; the next attempt gets the failure details.`);
}

function doVerify(prompts, act) {
  const c = act.cluster;
  const ids = act.items.map((i) => i.id).join(', ');
  const base = ctx('VERIFIER', c, `${c} (items to verify: ${ids})`) + prompts['4'].replace('<CLUSTER-ID>', c);
  runAgent(VERIFIER_CMD, 'verifier', c, base);
  const after = loadItems().filter((i) => act.items.some((x) => x.id === i.id));
  const failures = [];
  for (const it of after.filter((i) => i.status === 'VERIFIED')) {
    const r = revertCheck(it);
    if (r.skipped) { console.log('[orchestrator] TEST_FILE_CMD not set: independent revert-check SKIPPED.'); break; }
    if (!r.ok) failures.push(r.why);
  }
  if (failures.length) {
    const override = base + `\n\nORCHESTRATOR OVERRIDE: independent checks contradict your verdict. Set the verdict to REJECTED for the affected items and record this evidence:\n${failures.join('\n\n')}\n`;
    runAgent(VERIFIER_CMD, 'verifier', c + '-override', override);
    const again = loadItems().filter((i) => act.items.some((x) => x.id === i.id));
    if (again.some((i) => i.status === 'VERIFIED' && failures.some((f) => f.startsWith(i.id)))) die(`Verifier and orchestrator disagree on ${c}. Human review needed.`, 3);
  }
  const chk = sh(CHECK_CMD);
  writeFileSync(A('runs', `check-after-verify-${c}.log`), chk.out);
  if (chk.code) die(`CHECK_CMD failed after verifying ${c}:\n${tail(chk.out)}`, 3);
  const tv = trackerValid();
  if (!tv.ok) die('Tracker validator failed after verification:\n' + tv.why, 3);
}

function doGate(prompts, act) {
  const t = act.tier;
  const pre = sh(GATE_CHECK_CMD);
  writeFileSync(A('runs', `gate-T${t}-checks.log`), pre.out);
  if (pre.code) die(`GATE_CHECK_CMD failed for tier T${t}. See audit/runs/gate-T${t}-checks.log`, 3);
  const extra = `\n\nWrite your verdict to audit/gates/T${t}.json as {"result":"PASS"|"FAIL","failedChecks":[...],"reopen":[ids]}.`;
  runAgent(GATE_CMD, 'gate', `T${t}`, ctx('GATEKEEPER', `T${t}`, `tier T${t}`) + prompts['5'].replace('<T#>', `T${t}`) + extra);
  const g = A('gates', `T${t}.json`);
  if (!existsSync(g)) die(`Gatekeeper did not write ${g}.`, 3);
  const res = JSON.parse(readFileSync(g, 'utf8'));
  if (res.result !== 'PASS') die(`Tier T${t} gate FAILED. Items to reopen: ${(res.reopen ?? []).join(', ') || 'see report'}`, 3);
}

// ---------- main ----------
function plan(items) {
  const f = items.filter((i) => /^F-/.test(i.id));
  const counts = {};
  for (const i of f) { const k = `T${tierNum(i)} ${i.status}`; counts[k] = (counts[k] ?? 0) + 1; }
  console.log('Items by tier and status:');
  for (const k of Object.keys(counts).sort()) console.log(`  ${k}: ${counts[k]}`);
  console.log('Next action:', JSON.stringify(nextAction(items), (k, v) => (k === 'items' ? v.map((i) => i.id) : v)));
  console.log(TEST_FILE_CMD ? 'Independent revert-check: ENABLED' : 'Independent revert-check: DISABLED (set TEST_FILE_CMD)');
}

const items0 = loadItems();
if (PLAN_ONLY) { plan(items0); process.exit(0); }
if (!FIXER_CMD) die('Set FIXER_CMD (and preferably a different VERIFIER_CMD).');
const prompts = loadPrompts();
if (!TEST_FILE_CMD) console.warn('WARNING: TEST_FILE_CMD is not set; the orchestrator cannot independently prove regression tests fail without the fix.');
if (VERIFIER_CMD === FIXER_CMD) console.warn('WARNING: verifier uses the same command as the fixer. A different model or tool gives stronger verification.');

for (;;) {
  const items = loadItems();
  const act = nextAction(items);
  if (act.type === 'done') done('\nAll tiers VERIFIED and gated. Now run Prompt 7 (final re-audit) in fresh sessions.');
  if (act.type === 'pause') done(`\nTier T${act.tier} gate PASSED. Do your spot check (3 random VERIFIED items), then: touch audit/gates/T${act.tier}.accepted and re-run.`, 3);
  if (act.type === 'stuck') {
    done(`\nNo eligible work in tier T${act.tier}. Remaining: ${act.items.map((i) => `${i.id}[${i.status}${needsApproval(i) && !isApproved(i, readApprovals()) ? ', needs approval' : ''}]`).join(', ')}\nFix blockers, add approvals to audit/tracker/approvals.json, or answer owner decisions, then re-run.`, 3);
  }
  console.log(`\n=== ${act.type.toUpperCase()} ${act.cluster ?? 'T' + act.tier} ===`);
  if (act.type === 'fix') doFix(prompts, act);
  else if (act.type === 'verify') doVerify(prompts, act);
  else if (act.type === 'gate') doGate(prompts, act);
}
