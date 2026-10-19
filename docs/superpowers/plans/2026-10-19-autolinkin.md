# autoLinkIN Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the autoLinkIN Claude Code plugin. It asks when shipped work is worth a LinkedIn post, drafts the post in the owner's voice with checked style rules, previews it as a feed card, and fills the LinkedIn composer for the owner to press Post.

**Architecture:** A plugin made of three hook scripts (milestone, end-of-turn, protection guard) and a small CLI. All of them are thin wrappers over pure Node libraries in `scripts/lib/`, which are unit-tested with `node --test`. Two skills (`lndraft`, `lnvid`) carry the writing and video workflows and call the CLI for anything deterministic: draft folders, checks, preview, state.

**Tech Stack:** Node 22 ESM (`.mjs`), no npm dependencies, `node:test` + `node:assert/strict`, git and gh CLIs, Claude Code plugin manifest, hooks and skills, and the desktop app's built-in browser tools for the composer.

**Spec:** `docs/superpowers/specs/2026-10-19-autolinkin-design.md`

## Global Constraints

- Node >= 22, ES modules, zero npm dependencies. Tests run with `npm test` (`node --test tests/`).
- Windows 10 first. Git Bash and PowerShell both call these scripts. Use `node:path` and `execFileSync`, never a POSIX shell.
- Plugin name `autolinkin`, display name `autoLinkIN`, skills `lndraft` and `lnvid`.
- Every hook exits 0 and prints nothing when anything goes wrong (bad stdin, missing config, no git). A hook must never break the owner's session.
- Hooks read config from `CLAUDE_PLUGIN_OPTION_<KEY>` env. Bash-tool commands do not get those variables, so the CLI takes `--drafts-dir`, and skills pass `${user_config.drafts_dir}`.
- LinkedIn limits: post 3000 chars, comment 1250 chars. Emoji: hard cap 5 across post and comment, default 0. Hashtags: default 3, max 5. Fold: about 210 chars.
- Banned dashes: U+2012, U+2013, U+2014, U+2015. A plain hyphen `-` is fine.
- Public repo: no personal data and no machine paths in committed files. Personal data lives in the git-ignored `linkedin-drafts/`.
- Markdown is git-ignored except `/README.md`, `skills/**/SKILL.md`, `skills/**/references/*.md`, the plan and handoff files. Anything the plugin needs at runtime must be one of those or not be markdown.
- Never click Post, Comment, Save or any other submit control on LinkedIn.
- Commits go through the `commitskill` skill: the owner's identity, no AI attribution or co-author trailers anywhere.

## Review Focus

1. **A hook running somewhere it has no business:** not a git repo, a fresh repo with no commits, or no `drafts_dir` configured. Expect silence and exit 0. Tests in Task 5 and Task 6.
2. **Protected paths written differently from the config:** backslashes vs slashes, different drive-letter case, spaces in the path. Expect the guard still to fire, and a sibling folder like `memory-old` not to match. Test in Task 7.
3. **Emoji the eye counts as one but code counts as many:** ZWJ families, skin tones, flags, `❤️` with a variation selector. Expect each to count as one. `C#` and `#1` are not hashtags. Test in Task 4.
4. **Commands that look like releases but are not:** `git tag -l`, bare `git tag`, `gh release view`, `npm publish --dry-run`, `echo "npm publish"`. Expect no milestone. Test in Task 5.
5. **History rewritten under a stored `sinceSha`** (rebase or force-push). Expect a fallback to the most recent commits, not a crash or an empty list. Test in Task 2 and Task 6.

---

## File structure

```
.claude-plugin/plugin.json        manifest + userConfig
.claude-plugin/marketplace.json   local marketplace, source "./"
package.json                      {"type":"module","scripts":{"test":"node --test tests/"}}
hooks/hooks.json                  wires the three hook scripts
scripts/lib/config.mjs            config from env + overrides
scripts/lib/state.mjs             state/projects.json, atomic writes
scripts/lib/git.mjs               git queries
scripts/lib/eligibility.mjs       .autolinkin flags + GitHub visibility
scripts/lib/checker.mjs           style rules
scripts/lib/milestone.mjs         command classification
scripts/lib/guard.mjs             protected-path matching + previews
scripts/lib/drafts.mjs            draft folders, history, project pointer
scripts/lib/preview.mjs           feed-card HTML
scripts/hooks/post-tool-use.mjs   milestone hook
scripts/hooks/stop.mjs            end-of-turn check
scripts/hooks/pre-tool-use.mjs    protection guard
scripts/cli.mjs                   CLI the skills call
skills/lndraft/SKILL.md
skills/lndraft/references/voice-rules.md
skills/lndraft/references/composer.md
skills/lnvid/SKILL.md
tests/helpers.mjs                 tmpDir, makeRepo, commit, runHook
tests/*.test.mjs
README.md, LICENSE
```

---

### Task 1: Scaffold, manifest and config

**Files:**
- Create: `.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`, `package.json`, `scripts/lib/config.mjs`, `tests/helpers.mjs`
- Test: `tests/config.test.mjs`

**Interfaces:**
- Produces:
  - `loadConfig(env = process.env, overrides = {}) -> { draftsDir: string|null, styleSources: string[], protectedPaths: string[], displayName: string, headline: string }`. Overrides (`{draftsDir}` etc.) win over env.
  - `parseList(value: string|undefined) -> string[]`. Accepts a JSON array, newline-separated, or `;`-separated. Trims entries and drops blanks.
  - `tests/helpers.mjs`:
    - `tmpDir() -> string`
    - `makeRepo() -> string`: `git init` with `user.name`/`user.email` set locally
    - `commit(root, msg) -> sha`: writes a file and commits it
    - `runHook(scriptPath, input: object|string, env: object) -> {code, stdout}`: `spawnSync('node', [scriptPath])` with stdin

- [ ] **Step 1: Write the failing test**

```js
import { test } from 'node:test'; import assert from 'node:assert/strict';
import { loadConfig, parseList } from '../scripts/lib/config.mjs';
test('reads plugin options from env', () => {
  const c = loadConfig({ CLAUDE_PLUGIN_OPTION_DRAFTS_DIR: 'E:/x/linkedin-drafts',
    CLAUDE_PLUGIN_OPTION_STYLE_SOURCES: '["a.md","b.md"]',
    CLAUDE_PLUGIN_OPTION_PROTECTED_PATHS: 'C:/p1;C:/p2' });
  assert.equal(c.draftsDir, 'E:/x/linkedin-drafts');
  assert.deepEqual(c.styleSources, ['a.md', 'b.md']);
  assert.deepEqual(c.protectedPaths, ['C:/p1', 'C:/p2']);
});
test('missing config is null, overrides win', () => {
  assert.equal(loadConfig({}).draftsDir, null);
  assert.equal(loadConfig({ CLAUDE_PLUGIN_OPTION_DRAFTS_DIR: 'a' }, { draftsDir: 'D:/d' }).draftsDir, 'D:/d');
});
test('parseList handles newlines and blanks', () => assert.deepEqual(parseList('a\n\n b \n'), ['a', 'b']));
```

- [ ] **Step 2: Run** `npm test`. Expected: FAIL, module not found.
- [ ] **Step 3: Implement `config.mjs` and `helpers.mjs`.** Write `plugin.json` with:
  - `name` `autolinkin`, `displayName` `autoLinkIN`, `version` `0.1.0`
  - `author.name` `Haziq`, `repository` `https://github.com/haziqlandge/autoLinkIN`, `license` `MIT`
  - `userConfig` for spec section 9:
    - `drafts_dir`: type directory, required
    - `style_sources`: type string, multiple
    - `protected_paths`: type string, multiple
    - `display_name`, `headline`: type string

  Write `marketplace.json` with `name` `autolinkin`, `owner.name` `Haziq`, and one plugin `{ "name": "autolinkin", "source": "./" }`.
- [ ] **Step 4: Run** `npm test`. Expected: 3 pass. Run `claude plugin validate .`. Expected: `Validation passed`.
- [ ] **Step 5: Commit** with commitskill: "Add plugin manifest and config loader".

### Task 2: State and git helpers

**Files:**
- Create: `scripts/lib/state.mjs`, `scripts/lib/git.mjs`
- Test: `tests/state.test.mjs`, `tests/git.test.mjs`

**Interfaces:**
- Produces (`state.mjs`):
  - `projectKey(root) -> string`: resolved path, forward slashes, lowercased on win32.
  - `readState(draftsDir) -> { projects: { [key]: ProjectState } }`. Returns `{projects:{}}` when the file is missing or corrupt.
  - `getProject(draftsDir, root) -> ProjectState` (defaults when absent).
  - `updateProject(draftsDir, root, patch) -> ProjectState`. Merges, then writes `state/projects.json` through a temp file plus rename.
  - `ProjectState = { sinceSha: string|null, lastSeenSha: string|null, visibility: 'public'|'private'|null, visibilityCheckedAt: number|null, firstMilestones: string[] }`.
- Produces (`git.mjs`; every function returns null or `[]` on any git error):
  - `repoRoot(cwd) -> string|null`
  - `headSha(root) -> string|null`: null when there are no commits.
  - `commitsSince(root, sinceSha: string|null, limit = 30) -> {sha, subject}[]`: newest first. Falls back to the last `limit` commits when `sinceSha` is null or not an ancestor of HEAD.
  - `diffstat(root, sinceSha: string|null) -> string`: the `--shortstat` line, `''` when unknown.
  - `originUrl(root) -> string|null`

- [ ] **Step 1: Write the failing tests**

```js
test('updateProject merges and survives reread', () => {
  const d = tmpDir(); updateProject(d, 'C:/r', { sinceSha: 'a' }); updateProject(d, 'C:/r', { lastSeenSha: 'b' });
  assert.deepEqual([getProject(d, 'C:/r').sinceSha, getProject(d, 'C:/r').lastSeenSha], ['a', 'b']);
});
test('projectKey ignores slash style and case on win32', { skip: process.platform !== 'win32' }, () =>
  assert.equal(projectKey('C:\\Foo\\Bar'), projectKey('c:/foo/bar')));
test('git helpers on empty, normal and rewritten history', () => {
  assert.equal(repoRoot(tmpDir()), null);
  const r = makeRepo(); assert.equal(headSha(r), null);
  const a = commit(r, 'first'); commit(r, 'second');
  assert.deepEqual(commitsSince(r, null).map(c => c.subject), ['second', 'first']);
  assert.deepEqual(commitsSince(r, a).map(c => c.subject), ['second']);
  assert.equal(commitsSince(r, '0'.repeat(40)).length, 2); // Review Focus 5
});
```

- [ ] **Step 2: Run** `npm test`. Expected: FAIL.
- [ ] **Step 3: Implement** `state.mjs` and `git.mjs`. Use `git merge-base --is-ancestor` to decide whether to fall back.
- [ ] **Step 4: Run** `npm test`. Expected: all pass.
- [ ] **Step 5: Commit** with commitskill: "Add state store and git helpers".

### Task 3: Eligibility

**Files:**
- Create: `scripts/lib/eligibility.mjs`
- Test: `tests/eligibility.test.mjs`

**Interfaces:**
- Consumes: `originUrl`, `getProject`, `updateProject`.
- Produces:
  - `readProjectFile(root) -> { nda?: boolean, optIn?: boolean, drafts?: string[] }`: `{}` when `.autolinkin` is missing or invalid.
  - `parseGithubRepo(url) -> 'owner/name'|null`: handles https and ssh forms, strips `.git`.
  - `defaultGhVisibility(ownerRepo) -> 'public'|'private'|null`: runs `gh repo view <repo> --json visibility`, null on error.
  - `checkEligibility(root, { draftsDir, ghVisibility = defaultGhVisibility, now = Date.now() }) -> { eligible: boolean, reason: 'opt-in'|'nda'|'private'|'public'|'no-remote'|'unknown' }`.
    - Rules, in this order: optIn means eligible; nda means not eligible; private means not eligible; anything else is eligible.
    - Visibility is cached in state for 24 hours.

- [ ] **Step 1: Write the failing tests**

```js
test('parses github remotes', () => {
  assert.equal(parseGithubRepo('https://github.com/a/b.git'), 'a/b');
  assert.equal(parseGithubRepo('git@github.com:a/b.git'), 'a/b');
  assert.equal(parseGithubRepo('https://gitlab.com/a/b'), null);
});
test('rules: no remote, nda, private, opt-in, cache', () => {
  const d = tmpDir(); const r = makeRepo(); commit(r, 'x');
  assert.deepEqual(checkEligibility(r, { draftsDir: d }), { eligible: true, reason: 'no-remote' });
  writeFileSync(join(r, '.autolinkin'), '{"nda":true}');
  assert.equal(checkEligibility(r, { draftsDir: d }).reason, 'nda');
  writeFileSync(join(r, '.autolinkin'), '{}'); execFileSync('git', ['-C', r, 'remote', 'add', 'origin', 'https://github.com/a/b']);
  let calls = 0; const gh = () => { calls++; return 'private'; };
  assert.equal(checkEligibility(r, { draftsDir: d, ghVisibility: gh }).reason, 'private');
  checkEligibility(r, { draftsDir: d, ghVisibility: gh }); assert.equal(calls, 1);
  writeFileSync(join(r, '.autolinkin'), '{"optIn":true}');
  assert.deepEqual(checkEligibility(r, { draftsDir: d, ghVisibility: gh }), { eligible: true, reason: 'opt-in' });
});
```

- [ ] **Step 2: Run** `npm test`. Expected: FAIL.
- [ ] **Step 3: Implement** `eligibility.mjs`.
- [ ] **Step 4: Run** `npm test`. Expected: all pass.
- [ ] **Step 5: Commit** with commitskill: "Add project eligibility rules".

### Task 4: Style checker

**Files:**
- Create: `scripts/lib/checker.mjs`
- Test: `tests/checker.test.mjs`

**Interfaces:**
- Produces:
  - `checkDraft({ post: string, comment: string }) -> { fails: string[], warns: string[] }`. Each entry is a human-readable message naming the rule and, where useful, the offending text.
  - `countEmoji(text) -> number`: graphemes via `Intl.Segmenter`, counted when they match `/\p{Extended_Pictographic}|\p{Regional_Indicator}/u`.
  - `countHashtags(text) -> number`: `#` followed by a letter, at the start of the text or after whitespace.
  - Constants: `BANNED_DASHES`, `POST_LIMIT = 3000`, `COMMENT_LIMIT = 1250`, `MAX_EMOJI = 5`, `MAX_HASHTAGS = 5`, `FOLD_CHARS = 210`, `BLOCKLIST`, `DENSITY_WORDS`, `SWEARS`.
- Fails:
  - banned dashes
  - emoji over 5 (post and comment combined)
  - hashtags over 5
  - post over 3000 or comment over 1250 characters
  - a lowercase standalone `i` (including `i'm`, `i've`, `i'll`, `i'd`)
  - a `SWEARS` word
  - a `BLOCKLIST` phrase, case-insensitive:
    - `excited to announce`, `thrilled to announce`
    - `game-changer`, `game changer`
    - `delve`
    - `let me be honest`, `here's the thing`, `plot twist`
- Warns:
  - any emoji present ("justify in brief.md")
  - first line longer than `FOLD_CHARS`
  - first line ending in `?`
  - any paragraph with 3 or more `DENSITY_WORDS`:
    - `crucial`, `robust`, `seamless`, `leverage`, `elevate`, `landscape`
    - `streamline`, `notably`, `comprehensive`, `insights`, `foster`, `nuanced`

- [ ] **Step 1: Write the failing tests**

```js
const ok = 'I shipped v2 of the Packet Tracer MCP after 41 commits.\n\nIt builds labs from plain English.';
test('clean post passes with no warnings', () => assert.deepEqual(checkDraft({ post: ok, comment: '' }), { fails: [], warns: [] }));
test('dashes', () => {
  assert.ok(checkDraft({ post: ok + ' a \u2014 b', comment: '' }).fails.length);
  assert.ok(checkDraft({ post: ok + ' a \u2013 b', comment: '' }).fails.length);
  assert.equal(checkDraft({ post: ok + ' real-time', comment: '' }).fails.length, 0);
});
test('emoji counting (Review Focus 3)', () => {
  assert.equal(countEmoji('👨‍👩‍👧 👍🏽 🇮🇳 ❤️'), 4);
  assert.equal(checkDraft({ post: ok + ' 🚀🚀🚀', comment: '🚀🚀🚀' }).fails.length, 1);
  assert.deepEqual(checkDraft({ post: ok + ' 🚀', comment: '' }).fails, []);
  assert.equal(checkDraft({ post: ok + ' 🚀', comment: '' }).warns.length, 1);
});
test('hashtags', () => {
  assert.equal(countHashtags('#a #b C# #1 x#y'), 2);
  assert.ok(checkDraft({ post: ok + '\n#a #b #c #d #e #f', comment: '' }).fails.length);
});
test('limits', () => {
  assert.ok(checkDraft({ post: 'I '.repeat(1501).slice(0, 3001), comment: '' }).fails.some(f => /3000/.test(f)));
  assert.ok(checkDraft({ post: ok, comment: 'a'.repeat(1251) }).fails.some(f => /1250/.test(f)));
});
test('lowercase i', () => {
  for (const bad of ['so i built it', "i'm done"]) assert.ok(checkDraft({ post: bad, comment: '' }).fails.length, bad);
  for (const fine of ['I built it', 'i.e. this', 'Wi-Fi', 'pi day']) assert.equal(checkDraft({ post: fine, comment: '' }).fails.length, 0, fine);
});
test('blocklist, swears, warnings', () => {
  assert.ok(checkDraft({ post: 'Excited to announce v2', comment: '' }).fails.length);
  assert.ok(checkDraft({ post: 'This shit works', comment: '' }).fails.length);
  assert.ok(checkDraft({ post: 'Why did I build this?\n\nBecause.', comment: '' }).warns.length);
  assert.ok(checkDraft({ post: ok + '\n\nA robust, seamless way to leverage it.', comment: '' }).warns.length);
});
```

- [ ] **Step 2: Run** `npm test`. Expected: FAIL.
- [ ] **Step 3: Implement** `checker.mjs`.
- [ ] **Step 4: Run** `npm test`. Expected: all pass.
- [ ] **Step 5: Commit** with commitskill: "Add draft style checker".

### Task 5: Milestone hook

**Files:**
- Create: `scripts/lib/milestone.mjs`, `scripts/hooks/post-tool-use.mjs`
- Test: `tests/milestone.test.mjs`

**Interfaces:**
- Consumes: `loadConfig`, `repoRoot`, `headSha`, `checkEligibility`, `getProject`, `updateProject`.
- Produces:
  - `classifyCommand(cmd: string) -> { kind: 'tag'|'release'|'version'|'publish'|'deploy', detail: string, firstOnly: boolean } | null`.
    - `firstOnly` is true for `publish` and `deploy` (spec 15.1).
    - Split the command on `&&`, `||`, `;`, `|` and newlines, strip leading `VAR=x`, and match each segment at its start.
    - Any segment containing `--dry-run` does not count.
    - `detail` is the tag, version or target when one is visible, otherwise the matched command.
  - `buildMilestoneContext({ projectName, root, kind, detail, cliPath, draftsDir }) -> string`. It says:
    - which milestone happened and that the project is eligible
    - that Claude should finish the current task first, then ask the user in one line whether they want a draft
    - on yes: use the `autolinkin:lndraft` skill
    - on no: run `node "<cliPath>" declined "<root>" --drafts-dir "<draftsDir>"`
  - The hook reads stdin and does nothing unless all of these hold:
    - `tool_name` is `Bash` or `PowerShell`
    - the command classifies as a milestone
    - the cwd is in a repo and `draftsDir` is set
    - the project is eligible
    - for a first-only milestone, its kind is not already in `firstMilestones`

    Then it sets `lastSeenSha` to HEAD, adds the kind to `firstMilestones` for first-only kinds, and prints `{"hookSpecificOutput":{"hookEventName":"PostToolUse","additionalContext":...}}`.
- Matches:

| kind | commands |
|---|---|
| tag | `git tag <name>` (not bare, not `-l`/`--list`/`-d`/`--delete`/`-v`), `git push` with `--tags` or `--follow-tags` |
| release | `gh release create` |
| version | `npm version <x>` |
| publish | `npm publish`, `pnpm publish`, `yarn publish`, `yarn npm publish`, `cargo publish`, `twine upload`, `uv publish`, `poetry publish` |
| deploy | `vercel` with `--prod`, `netlify deploy` with `--prod`, `firebase deploy`, `fly deploy`, `flyctl deploy`, `wrangler deploy`, `wrangler publish` |

- [ ] **Step 1: Write the failing tests**

```js
test('classifies real milestones', () => {
  assert.equal(classifyCommand('gh release create v1.2.0 --notes x').kind, 'release');
  assert.equal(classifyCommand('npm test && git tag v1.2.0').detail, 'v1.2.0');
  assert.equal(classifyCommand('vercel --prod').firstOnly, true);
  assert.equal(classifyCommand('git push origin main --follow-tags').kind, 'tag');
});
test('ignores look-alikes (Review Focus 4)', () => {
  for (const c of ['git tag', 'git tag -l', 'gh release view v1', 'npm publish --dry-run', 'echo "npm publish"', 'vercel'])
    assert.equal(classifyCommand(c), null, c);
});
test('hook: emits once per first-only kind, silent outside repos and on junk', () => {
  const d = tmpDir(); const r = makeRepo(); commit(r, 'x'); const env = { CLAUDE_PLUGIN_OPTION_DRAFTS_DIR: d };
  const input = c => ({ tool_name: 'Bash', tool_input: { command: c }, cwd: r });
  const out = runHook(HOOK, input('gh release create v1.0.0'), env);
  assert.match(JSON.parse(out.stdout).hookSpecificOutput.additionalContext, /release.*v1\.0\.0/s);
  assert.notEqual(runHook(HOOK, input('vercel --prod'), env).stdout, '');
  assert.equal(runHook(HOOK, input('vercel --prod'), env).stdout, '');
  assert.deepEqual(runHook(HOOK, { ...input('gh release create v2'), cwd: tmpDir() }, env), { code: 0, stdout: '' });
  assert.deepEqual(runHook(HOOK, 'not json', env), { code: 0, stdout: '' });
  assert.deepEqual(runHook(HOOK, input('gh release create v3'), {}), { code: 0, stdout: '' });
});
```

- [ ] **Step 2: Run** `npm test`. Expected: FAIL.
- [ ] **Step 3: Implement** `milestone.mjs` and `post-tool-use.mjs`. The whole script body sits in try/catch and exits 0 silently. `cliPath` is `scripts/cli.mjs`, resolved from the hook file's own location.
- [ ] **Step 4: Run** `npm test`. Expected: all pass.
- [ ] **Step 5: Commit** with commitskill: "Add milestone detection hook".

### Task 6: End-of-turn check

**Files:**
- Create: `scripts/hooks/stop.mjs`
- Test: `tests/stop.test.mjs`

**Interfaces:**
- Consumes: `loadConfig`, `repoRoot`, `headSha`, `commitsSince`, `diffstat`, `checkEligibility`, `getProject`, `updateProject`.
- Produces:
  - `buildBundleContext({ projectName, root, commits, stat, cliPath, draftsDir }) -> string`. It lists up to 30 commit subjects plus the diffstat. It tells Claude to judge whether they add up to an important feature, or enough small ones, for a LinkedIn post:
    - not enough: say nothing about it
    - enough: ask the user in one line when the current task is finished
    - on no: run `node "<cliPath>" declined "<root>" --drafts-dir "<draftsDir>"`
  - The hook does nothing when any of these is true:
    - `stop_hook_active` is true
    - there's no repo, no `draftsDir` or no HEAD
    - the project is ineligible
    - HEAD equals `lastSeenSha`

    Otherwise it sets `lastSeenSha` to HEAD and prints `{"hookSpecificOutput":{"hookEventName":"Stop","additionalContext":...}}` built from `commitsSince(root, sinceSha)`. It never changes `sinceSha`.

- [ ] **Step 1: Write the failing tests**

```js
test('fires once per new commit set and accumulates since sinceSha', () => {
  const d = tmpDir(); const r = makeRepo(); const env = { CLAUDE_PLUGIN_OPTION_DRAFTS_DIR: d };
  assert.equal(runHook(STOP, { cwd: r, stop_hook_active: false }, env).stdout, ''); // no commits
  commit(r, 'add export'); const a = runHook(STOP, { cwd: r }, env).stdout;
  assert.match(a, /add export/);
  assert.equal(runHook(STOP, { cwd: r }, env).stdout, '');
  commit(r, 'add import'); const b = JSON.parse(runHook(STOP, { cwd: r }, env).stdout).hookSpecificOutput.additionalContext;
  assert.match(b, /add import/); assert.match(b, /add export/);
});
test('silent when stop_hook_active, outside repos, or after a milestone hook saw HEAD', () => {
  const d = tmpDir(); const r = makeRepo(); commit(r, 'x'); const env = { CLAUDE_PLUGIN_OPTION_DRAFTS_DIR: d };
  assert.equal(runHook(STOP, { cwd: r, stop_hook_active: true }, env).stdout, '');
  assert.equal(runHook(STOP, { cwd: tmpDir() }, env).stdout, '');
  runHook(POST, { tool_name: 'Bash', tool_input: { command: 'git tag v1' }, cwd: r }, env);
  assert.equal(runHook(STOP, { cwd: r }, env).stdout, '');
});
test('unknown sinceSha falls back to recent commits (Review Focus 5)', () => {
  const d = tmpDir(); const r = makeRepo(); commit(r, 'kept'); updateProject(d, r, { sinceSha: 'f'.repeat(40) });
  assert.match(runHook(STOP, { cwd: r }, { CLAUDE_PLUGIN_OPTION_DRAFTS_DIR: d }).stdout, /kept/);
});
```

- [ ] **Step 2: Run** `npm test`. Expected: FAIL.
- [ ] **Step 3: Implement** `stop.mjs`, with the same try/catch silence as Task 5.
- [ ] **Step 4: Run** `npm test`. Expected: all pass.
- [ ] **Step 5: Commit** with commitskill: "Add end-of-turn bundle check".

### Task 7: Protection guard

**Files:**
- Create: `scripts/lib/guard.mjs`, `scripts/hooks/pre-tool-use.mjs`
- Test: `tests/guard.test.mjs`

**Interfaces:**
- Consumes: `loadConfig`.
- Produces:
  - `isProtectedPath(p, protectedPaths) -> boolean`. Normalise both sides: resolve, forward slashes, lowercase on win32. It matches the path itself or anything under it (prefix plus `/`).
  - `shellWritesTo(cmd, protectedPaths) -> boolean`. True when the command mentions a protected path in either slash style and contains a write-like token:
    - `>`, `>>`
    - `sed -i`, `tee`
    - `Set-Content`, `Add-Content`, `Out-File`
    - `mv`, `cp`, `rm`, `Move-Item`, `Copy-Item`, `Remove-Item`, `del`, `erase`
  - `buildPreview(toolName, toolInput, readFile = fs.readFileSync) -> string`. Truncated at 4000 chars with `...(truncated)`:
    - Edit: the file, then `--- old` / `+++ new` blocks
    - MultiEdit: one such block per edit
    - Write: a line diff against the current file, with `-`/`+` prefixes, or all `+` for a new file
    - NotebookEdit: the notebook path and the new source
    - Bash/PowerShell: the command
  - The hook does nothing unless the target is protected, or the shell command writes to a protected path. File tools use `tool_input.file_path`, NotebookEdit uses `notebook_path`. When it fires it prints `{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"ask","permissionDecisionReason":"autoLinkIN: this changes your protected writing-style memory. Allow only if you approve this change.\n\n<preview>"}}`.

- [ ] **Step 1: Write the failing tests**

```js
const P = ['C:/Users/me/.claude/projects/E--ProjectsPVT-eureka/memory'];
test('path matching across styles (Review Focus 2)', { skip: process.platform !== 'win32' }, () => {
  assert.ok(isProtectedPath('c:\\users\\ME\\.claude\\projects\\E--ProjectsPVT-eureka\\memory\\style.md', P));
  assert.ok(!isProtectedPath('C:/Users/me/.claude/projects/E--ProjectsPVT-eureka/memory-old/x.md', P));
  assert.ok(isProtectedPath('C:/My Docs/notes/a.md', ['C:/My Docs/notes']));
});
test('shell writes', () => {
  assert.ok(!shellWritesTo('cat "C:/Users/me/.claude/projects/E--ProjectsPVT-eureka/memory/a.md"', P));
  assert.ok(shellWritesTo('echo x >> C:/Users/me/.claude/projects/E--ProjectsPVT-eureka/memory/a.md', P));
  assert.ok(shellWritesTo('Set-Content -Path "C:\\Users\\me\\.claude\\projects\\E--ProjectsPVT-eureka\\memory\\a.md" x', P));
});
test('hook asks with the change, ignores others, silent without config', () => {
  const dir = tmpDir(); const f = join(dir, 'style.md'); writeFileSync(f, 'old line\n');
  const env = { CLAUDE_PLUGIN_OPTION_PROTECTED_PATHS: dir };
  const ask = JSON.parse(runHook(GUARD, { tool_name: 'Edit', tool_input: { file_path: f, old_string: 'old line', new_string: 'new line' } }, env).stdout);
  assert.equal(ask.hookSpecificOutput.permissionDecision, 'ask');
  assert.match(ask.hookSpecificOutput.permissionDecisionReason, /old line[\s\S]*new line/);
  const w = JSON.parse(runHook(GUARD, { tool_name: 'Write', tool_input: { file_path: f, content: 'fresh\n' } }, env).stdout);
  assert.match(w.hookSpecificOutput.permissionDecisionReason, /\+fresh/);
  assert.equal(runHook(GUARD, { tool_name: 'Edit', tool_input: { file_path: join(tmpDir(), 'x.md') } }, env).stdout, '');
  assert.equal(runHook(GUARD, { tool_name: 'Edit', tool_input: { file_path: f } }, {}).stdout, '');
});
```

- [ ] **Step 2: Run** `npm test`. Expected: FAIL.
- [ ] **Step 3: Implement** `guard.mjs` and `pre-tool-use.mjs`, with the same try/catch silence.
- [ ] **Step 4: Run** `npm test`. Expected: all pass.
- [ ] **Step 5: Commit** with commitskill: "Add protected memory guard".

### Task 8: Draft store and CLI

**Files:**
- Create: `scripts/lib/drafts.mjs`, `scripts/cli.mjs`
- Test: `tests/drafts.test.mjs`, `tests/cli.test.mjs`

**Interfaces:**
- Consumes: `loadConfig`, `state`, `git`, `checkEligibility`, `checkDraft`, `readProjectFile`.
- Produces (`drafts.mjs`):
  - `slugify(text) -> string`: lowercase, `[a-z0-9-]`, collapsed hyphens, at most 40 chars.
  - `createDraft(draftsDir, { projectRoot, title, date }) -> { id, dir }`. `date` defaults to today's local date as `YYYY-MM-DD`.
    - The id is `<date>-<slug(basename(projectRoot))>-<slug(title)>`, suffixed `-2`, `-3` and so on when taken.
    - Creates `dir/media/`, appends history `{id, project: root, date, title, status: 'drafting'}`, and calls `updatePointer`.
  - `appendHistory(draftsDir, entry)`: writes to `history.jsonl`.
  - `setStatus(draftsDir, id, status, extra = {})`: appends `{id, status, at, ...extra}`.
  - `readHistory(draftsDir) -> entry[]`: the latest line per id, merged.
  - Statuses: `drafting`, `approved`, `posted`, `abandoned`.
  - `updatePointer(projectRoot, draftDir)`: merges `drafts` into `.autolinkin`, keeps other keys, and makes sure `.git/info/exclude` has exactly one `.autolinkin` line.
- Produces (`cli.mjs`). Commands that touch state, history or drafts take `--drafts-dir <dir>` and fall back to env; `check` and `preview` work on the draft folder alone. Every command prints JSON or plain text to stdout and exits 2 on a usage error:

| command | effect | exit |
|---|---|---|
| `new <projectRoot> <title>` | `createDraft` and write `VOICE_TEMPLATE` to `<drafts>/linkedin-voice.md` if missing; prints `{id, dir}` | 0 |
| `check <draftDir>` | `checkDraft` on `post.md` + `first-comment.md`, writes `checks.txt`, prints it | 1 if fails |
| `preview <draftDir>` | writes `preview.html` (Task 9), prints its path | 0 |
| `status <id> <status> [postUrl]` | `setStatus` | 0 |
| `declined <projectRoot>` / `drafted <projectRoot>` | `sinceSha = HEAD`, `lastSeenSha = HEAD` | 0 |
| `eligible <projectRoot>` | prints `checkEligibility` result | 0 |
| `commits <projectRoot>` | prints `{commits, stat}` since `sinceSha` | 0 |
| `history [projectRoot]` | prints `readHistory`, filtered by project | 0 |

- [ ] **Step 1: Write the failing tests**

```js
test('slugify', () => assert.equal(slugify('Packet Tracer MCP v2!'), 'packet-tracer-mcp-v2'));
test('createDraft writes folder, history, pointer and exclude once', () => {
  const d = tmpDir(); const r = makeRepo(); commit(r, 'x'); writeFileSync(join(r, '.autolinkin'), '{"nda":false,"optIn":true}');
  const a = createDraft(d, { projectRoot: r, title: 'v2 launch', date: '2026-10-19' });
  const b = createDraft(d, { projectRoot: r, title: 'v2 launch', date: '2026-10-19' });
  assert.ok(existsSync(join(a.dir, 'media'))); assert.equal(b.id, a.id + '-2');
  const ptr = JSON.parse(readFileSync(join(r, '.autolinkin'), 'utf8'));
  assert.equal(ptr.optIn, true); assert.equal(ptr.drafts.length, 2);
  assert.equal(readFileSync(join(r, '.git/info/exclude'), 'utf8').split('\n').filter(l => l.trim() === '.autolinkin').length, 1);
  setStatus(d, a.id, 'posted', { postUrl: 'u' }); assert.equal(readHistory(d).find(e => e.id === a.id).status, 'posted');
});
test('cli check fails on an em dash and writes checks.txt', () => {
  const dir = tmpDir(); writeFileSync(join(dir, 'post.md'), 'I built it \u2014 fast'); writeFileSync(join(dir, 'first-comment.md'), '');
  assert.equal(cli(['check', dir]).code, 1); assert.ok(existsSync(join(dir, 'checks.txt')));
});
test('declined moves sinceSha so the stop hook only shows newer work', () => {
  const d = tmpDir(); const r = makeRepo(); commit(r, 'old work');
  cli(['declined', r, '--drafts-dir', d]); commit(r, 'new work');
  const ctx = runHook(STOP, { cwd: r }, { CLAUDE_PLUGIN_OPTION_DRAFTS_DIR: d }).stdout;
  assert.match(ctx, /new work/); assert.doesNotMatch(ctx, /old work/);
});
```

(`cli(args)` is a small helper in this test file around `spawnSync('node', ['scripts/cli.mjs', ...args])`.)

- [ ] **Step 2: Run** `npm test`. Expected: FAIL.
- [ ] **Step 3: Implement** `drafts.mjs` and `cli.mjs`. Export `VOICE_TEMPLATE` from `drafts.mjs`: a string constant with a title, empty "Rules learned from edits" and "Phrases to avoid" sections, and one line saying entries are dated and pruned. It lives in code because markdown files outside the tracked set never reach the repo.
- [ ] **Step 4: Run** `npm test`. Expected: all pass. The `preview` command can be stubbed until Task 9.
- [ ] **Step 5: Commit** with commitskill: "Add draft store and CLI".

### Task 9: Feed-card preview

**Files:**
- Create: `scripts/lib/preview.mjs`
- Modify: `scripts/cli.mjs` (the `preview` command)
- Test: `tests/preview.test.mjs`

**Interfaces:**
- Produces:
  - `foldIndex(text) -> number`. The smaller of: `FOLD_CHARS` backed off to the previous whitespace, or the end of the third line.
  - `renderPreview({ post, comment, media: string[], displayName, headline }) -> string`. One self-contained HTML file (inline CSS, a few lines of inline JS for "see more"), styled as a LinkedIn feed card. It contains:
    - the avatar initial, name and headline
    - the post text cut at `foldIndex` with a "...see more" control
    - media from relative `media/<file>` paths: `<img>` for png/jpg/jpeg/webp/gif, `<video controls>` for mp4/webm/mov
    - the first comment in a comment bubble
    - a character count against 3000

    All text is HTML-escaped.
  - CLI `preview <draftDir>` reads `post.md`, `first-comment.md` and `media/`, plus `display_name`/`headline` from config or `--name`/`--headline`, then writes `preview.html`.

- [ ] **Step 1: Write the failing tests**

```js
test('fold backs off to whitespace and respects three lines', () => {
  const t = 'word '.repeat(60); const i = foldIndex(t); assert.ok(i <= 210); assert.match(t.slice(0, i), /word\s*$/);
  assert.equal(foldIndex('a\nb\nc\nd is long'), 'a\nb\nc'.length);
});
test('renders escaped text, media and comment', () => {
  const h = renderPreview({ post: '<script>x</script> hi', comment: 'link here', media: ['shot.png', 'demo.mp4'], displayName: 'Regel Fallen', headline: 'h' });
  assert.ok(!h.includes('<script>x')); assert.match(h, /&lt;script&gt;/);
  assert.match(h, /<img[^>]+media\/shot\.png/); assert.match(h, /<video[^>]+media\/demo\.mp4/);
  assert.match(h, /link here/); assert.match(h, /see more/);
});
```

- [ ] **Step 2: Run** `npm test`. Expected: FAIL.
- [ ] **Step 3: Implement** `preview.mjs` and wire the CLI command.
- [ ] **Step 4: Run** `npm test`. Expected: all pass. Open one generated `preview.html` in the desktop app's side panel and check by eye that it reads as a LinkedIn card.
- [ ] **Step 5: Commit** with commitskill: "Add feed-card preview".

### Task 10: Hook wiring and install

**Files:**
- Create: `hooks/hooks.json`

**Interfaces:**
- Consumes: the three hook scripts.

`hooks/hooks.json`, in exec form so paths with spaces stay one argument:

```json
{ "hooks": {
  "PostToolUse": [{ "matcher": "Bash|PowerShell", "hooks": [{ "type": "command", "command": "node", "args": ["${CLAUDE_PLUGIN_ROOT}/scripts/hooks/post-tool-use.mjs"] }] }],
  "Stop": [{ "hooks": [{ "type": "command", "command": "node", "args": ["${CLAUDE_PLUGIN_ROOT}/scripts/hooks/stop.mjs"] }] }],
  "PreToolUse": [{ "matcher": "Write|Edit|MultiEdit|NotebookEdit|Bash|PowerShell", "hooks": [{ "type": "command", "command": "node", "args": ["${CLAUDE_PLUGIN_ROOT}/scripts/hooks/pre-tool-use.mjs"] }] }]
} }
```

- [ ] **Step 1: Run** `claude plugin validate .`. Expected: `Validation passed`. If exec form is rejected, switch to the shell form `node "${CLAUDE_PLUGIN_ROOT}/scripts/hooks/<name>.mjs"` and validate again.
- [ ] **Step 2: Install in place.** Run `claude plugin marketplace add E:\ProjectsPVT\autoLinkIN`, then `claude plugin install autolinkin@autolinkin`. Set `pluginConfigs` (with the update-config skill or `/config`) to:
  - `drafts_dir` = `E:\ProjectsPVT\autoLinkIN\linkedin-drafts`
  - `style_sources` = the eureka `user-writing-style-and-mindset.md` path
  - `protected_paths` = the eureka project memory folder
  - `display_name` = `Regel Fallen`

  Expected: `claude plugin list` shows `autolinkin` enabled.
- [ ] **Step 3: Smoke test the milestone and end-of-turn hooks** in a new desktop session inside a scratch git repo with one commit. Ask Claude to run `git tag v0.0.1`. Expected: once the task is done, Claude asks one line about a draft. Make another commit without a tag. Expected: at the end of the turn Claude judges the bundle (it may stay quiet for a trivial commit).
- [ ] **Step 4: Smoke test the guard.** In a new session, ask Claude to append a test line to the eureka writing-style memory. Expected: a permission prompt whose text shows the change. Decline it, and confirm the file is unchanged. Also try it in bypass-permissions mode (spec risk 4). If no prompt appears there, change the guard to return `deny` with the same reason when `permission_mode` is `bypassPermissions`, add a test, then rerun `npm test` and repeat this step.
- [ ] **Step 5: Commit** with commitskill: "Wire hooks into the plugin".

### Task 11: Skills

**Files:**
- Create: `skills/lndraft/SKILL.md`, `skills/lndraft/references/voice-rules.md`, `skills/lnvid/SKILL.md`

**Interfaces:**
- Consumes: the CLI commands from Tasks 8 and 9, called as `node "${CLAUDE_PLUGIN_ROOT}/scripts/cli.mjs" <cmd> ... --drafts-dir "${user_config.drafts_dir}"`. Style sources are read from `${user_config.style_sources}`.

Required content:
- **`lndraft/SKILL.md`**
  - Frontmatter `name: lndraft`. The description says it makes a LinkedIn draft for what the user just shipped and is used when an autoLinkIN hook asks or the user runs lndraft.
  - The body follows spec 6.1 steps 1 to 12 in order, naming the CLI command at each deterministic step: `eligible`, `commits`, `history`, `new`, `check`, `preview`, `status`, `drafted`.
  - It includes:
    - the audience rules from spec 6.2
    - the video verdict format: "Video: yes/no", two to four reasons about attention and understanding, then a question to the user
    - showing `preview.html` in the side panel
    - the learning step from 6.7, with the rule that only `linkedin-voice.md` is written
    - the composer steps, by reference to `references/composer.md`
    - the hard rule never to press Post or Comment
- **`references/voice-rules.md`**: spec 6.3 and 6.4 in full, plus 3 hashtags by default and 5 at most. Copy the rules, not the owner's personal details.
- **`lnvid/SKILL.md`**
  - Frontmatter `name: lnvid`. Description: adds a hyper-animated video to an existing autoLinkIN draft.
  - The body follows spec section 7: pick the draft (latest drafting entry from `history`, or the one the user names); propose a storyboard with length, ratio and style chosen for this project and confirmed with the user (no defaults); voiceover choice (the user's recording or ElevenLabs); captions; build through the hyperframes skills; save to `media/`; rerun `preview`.
  - It says that if INSPI or ElevenLabs tools are not available, it should say so and continue without them.

- [ ] **Step 1: Write the three files.**
- [ ] **Step 2: Run** `claude plugin validate .`. Expected: `Validation passed`. Reload plugins in the desktop app.
- [ ] **Step 3: Check the command names.** Type `/lndraft` in a session. If it does not resolve, create user-level shims outside the repo: `~/.claude/skills/lndraft/SKILL.md` and `~/.claude/skills/lnvid/SKILL.md`, each with matching `name` and a body that only says to use the `autolinkin:lndraft` (or `autolinkin:lnvid`) skill. Expected: `/lndraft` and `/lnvid` both start the plugin skills.
- [ ] **Step 4: Dry run on a real eligible project.** Use this repo, which is public, and run `/lndraft`. Expected:
  - a draft folder with `brief.md`, `post.original.md`, `post.md`, `first-comment.md` and `checks.txt` with no fails
  - a video verdict with reasons in chat
  - the preview showing in the side panel

  Do not run the composer yet.
- [ ] **Step 5: Commit** with commitskill: "Add lndraft and lnvid skills".

### Task 12: Composer flow on the throwaway account

**Files:**
- Create: `skills/lndraft/references/composer.md`

- [ ] **Step 1: Spike** in the built-in browser with the throwaway account signed in.
  1. Open the feed and click "Start a post", then type a two-line test text.
  2. Try to attach an image from a draft's `media/` folder with the browser tools.
  3. Record what worked. Then close the composer and choose Discard. Never press Post.

  Expected: a clear yes or no on attaching media.
- [ ] **Step 2: Write `composer.md`.** The exact steps that worked: open feed, Start a post, type `post.md`, attach media or fall back, stop. After the user says it's posted: open the post, fill `first-comment.md`, stop. Keep every selector or label the flow depends on in one list at the top. Add the fallback: copy text to the clipboard and name the files to drag in.
- [ ] **Step 3: End-to-end run.** Take the Task 11 draft through approval: the composer gets filled on the throwaway account. The owner decides whether to press Post. Then fill the first comment. Run `status <id> posted <url>` once the owner confirms. Expected: `history` shows the draft as posted, and `linkedin-voice.md` gained a dated entry if the owner edited anything.
- [ ] **Step 4: Commit** with commitskill: "Document composer flow".

### Task 13: README and release

**Files:**
- Create: `README.md`, `LICENSE` (MIT, copyright Haziq)

- [ ] **Step 1: Write `README.md`.** Cover:
  - what autoLinkIN does, in one paragraph
  - install (the two `claude plugin` commands from Task 10)
  - the five config keys
  - the commands `/lndraft` and `/lnvid`
  - when it asks
  - how to mark a project `nda` or `optIn` in `.autolinkin`
  - that it never posts by itself

  No AI attribution and no personal data.
- [ ] **Step 2: Run** `npm test` and `claude plugin validate .`. Expected: all pass.
- [ ] **Step 3: Commit and push** with commitskill: "Add README and license". Expected: `git ls-remote origin main` equals the local HEAD.
