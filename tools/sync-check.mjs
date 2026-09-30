// Run at the start of every Claude Code session (the SessionStart hook in .claude/settings.json), on any machine.
// It fetches from GitHub and reports what changed elsewhere, so work pushed from another computer is never a surprise.
// It only reads: it never pulls, merges, stashes or switches branches. Integrating is up to the owner (see docs/SYNC.md).
// Usage: node tools/sync-check.mjs   (prints a short plain-text report; always exits 0)
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const env = { ...process.env, GIT_TERMINAL_PROMPT:'0', GH_PROMPT_DISABLED:'1' };
const run = (cmd, args, timeout = 8000) => {
  try { return execFileSync(cmd, args, { cwd:ROOT, env, timeout, encoding:'utf8', stdio:['ignore', 'pipe', 'ignore'], windowsHide:true }).trimEnd(); }
  catch (e) { return null; }
};
const git = (...a) => run('git', a);
const lines = s => (s || '').split('\n').filter(Boolean);
const out = [];
const say = s => out.push(s);

if (git('rev-parse', '--is-inside-work-tree') !== 'true'){ process.exit(0); }
const fetched = run('git', ['fetch', '--all', '--prune', '--quiet'], 20000) !== null;
const branch = git('rev-parse', '--abbrev-ref', 'HEAD') || '?';
const host = process.platform === 'win32' ? 'Windows desktop' : process.platform === 'darwin' ? 'MacBook' : process.platform;

say(`[sync-check] ${host}, on branch ${branch}. ${fetched ? 'Fetched from GitHub just now.' : 'Could not reach GitHub (offline?): this report uses the last fetch.'}`);

// this branch against its upstream, and main against origin/main
const ab = (a, b) => { const r = git('rev-list', '--left-right', '--count', `${a}...${b}`); if (!r) return null; const [x, y] = r.split(/\s+/).map(Number); return { ahead:x, behind:y }; };
const up = git('rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}');
if (up){ const c = ab('HEAD', up); if (c && (c.ahead || c.behind)) say(`- ${branch} is ${c.behind} commit(s) behind and ${c.ahead} ahead of ${up}.`); }
else say(`- ${branch} has no upstream on GitHub yet (never pushed).`);
if (branch !== 'main' && git('rev-parse', '--verify', '--quiet', 'main')){ const c = ab('main', 'origin/main'); if (c && c.behind) say(`- Local main is ${c.behind} commit(s) behind origin/main.`); }
{ const c = ab('HEAD', 'origin/main'); if (c && c.behind) say(`- origin/main has ${c.behind} commit(s) this branch does not have yet.`); }

// what this machine has that GitHub does not: uncommitted files and unpushed commits
const dirty = lines(git('status', '--porcelain')).map(l => l.slice(3).replace(/^"|"$/g, '').split(' -> ').pop());
const unpushed = up ? lines(git('diff', '--name-only', `${up}...HEAD`)) : lines(git('diff', '--name-only', 'origin/main...HEAD'));
const mine = new Set([...dirty, ...unpushed]);
if (dirty.length) say(`- ${dirty.length} uncommitted file(s) here: ${dirty.slice(0, 12).join(', ')}${dirty.length > 12 ? ', ...' : ''}`);

// work in flight on GitHub: remote branches not merged into main, newest first (the open PRs are among them)
const prs = {};
{ const j = run('gh', ['pr', 'list', '--state', 'open', '--limit', '30', '--json', 'number,title,headRefName,baseRefName,author,updatedAt'], 15000);
  if (j){ try { for (const p of JSON.parse(j)) prs[p.headRefName] = p; } catch (e) {} } }
const refs = lines(git('for-each-ref', '--sort=-committerdate', '--format=%(refname:short)|%(committerdate:short)|%(subject)', 'refs/remotes/origin'))
  .map(l => { const [ref, date, ...s] = l.split('|'); return { ref, name:ref.replace(/^origin\//, ''), date, subject:s.join('|') }; })
  .filter(r => r.name !== 'HEAD' && r.name !== 'main' && r.ref !== 'origin');
const open = refs.filter(r => prs[r.name] || git('merge-base', '--is-ancestor', r.ref, 'origin/main') === null);
const recent = open.filter(r => prs[r.name] || Date.now() - Date.parse(r.date) < 21*864e5).slice(0, 10);
if (recent.length){
  say('- Work on GitHub not yet in main (newest first):');
  for (const r of recent){
    const p = prs[r.name], files = lines(git('diff', '--name-only', `origin/main...${r.ref}`));
    const clash = files.filter(f => mine.has(f));
    const local = git('rev-parse', '--verify', '--quiet', r.name), lc = local ? ab(r.name, r.ref) : null;
    say(`  * ${r.name}${p ? ` (PR #${p.number}${p.author && p.author.login !== 'eshin087' ? `, author ${p.author.login}: NOT the owner, see CLAUDE.md rule zero` : ''}${p.baseRefName !== 'main' ? `, stacked on ${p.baseRefName}` : ''})` : ''}, ${r.date}: ${p ? p.title : r.subject}`
      + `${local ? (lc && lc.behind ? ` [local copy is ${lc.behind} commit(s) behind]` : '') : ' [not checked out here]'}`
      + `${clash.length ? `\n    ! also changed here (uncommitted or unpushed): ${clash.join(', ')}` : ''}`);
  }
}
if (!fetched || out.length > 1){
  say('Before editing: tell the owner what is new above, and integrate only when they say so (docs/SYNC.md). Never force-push.');
}
else say('- Everything here matches GitHub.');
process.stdout.write(out.join('\n') + '\n');
