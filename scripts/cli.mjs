#!/usr/bin/env node
// autoLinkIN CLI: the deterministic steps the lndraft and lnvid skills call.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { loadConfig } from './lib/config.mjs';
import { repoRoot, headSha, commitsSince, diffstat } from './lib/git.mjs';
import { checkEligibility } from './lib/eligibility.mjs';
import { getProject, updateProject, projectKey } from './lib/state.mjs';
import { checkDraft } from './lib/checker.mjs';
import { createDraft, setStatus, readHistory, VOICE_TEMPLATE } from './lib/drafts.mjs';

const USAGE = `usage: cli.mjs <command> [args] [--drafts-dir <dir>]
  new <projectRoot> <title>          create a draft folder, print {id, dir}
  check <draftDir>                   run the style checker, write checks.txt (exit 1 on fails)
  preview <draftDir> [--name N] [--headline H]   write preview.html
  status <id> <status> [postUrl]     record drafting|approved|posted|abandoned
  declined <projectRoot>             the user said no: skip work up to HEAD
  drafted <projectRoot>              a draft was made: skip work up to HEAD
  eligible <projectRoot>             print eligibility
  commits <projectRoot>              print commits since the last draft or decline
  history [projectRoot]              print draft history`;

class UsageError extends Error {}

function parseArgs(argv) {
  const positional = [];
  const flags = {};
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a.startsWith('--')) {
      flags[a.slice(2)] = argv[i + 1];
      i += 1;
    } else positional.push(a);
  }
  return { positional, flags };
}

function need(value, what) {
  if (value === undefined || value === null || value === '') throw new UsageError(`missing ${what}`);
  return value;
}

function readText(path) {
  try { return readFileSync(path, 'utf8'); } catch { return ''; }
}

function print(value) {
  process.stdout.write(typeof value === 'string' ? `${value}\n` : `${JSON.stringify(value, null, 2)}\n`);
}

function rootOf(path) {
  return repoRoot(path) || path;
}

const commands = {
  new([projectRoot, title], { draftsDir }) {
    const root = rootOf(need(projectRoot, 'projectRoot'));
    const made = createDraft(need(draftsDir, '--drafts-dir'), { projectRoot: root, title: need(title, 'title') });
    const voice = join(draftsDir, 'linkedin-voice.md');
    if (!existsSync(voice)) writeFileSync(voice, VOICE_TEMPLATE);
    print(made);
  },
  check([draftDir]) {
    const dir = need(draftDir, 'draftDir');
    const { fails, warns } = checkDraft({ post: readText(join(dir, 'post.md')), comment: readText(join(dir, 'first-comment.md')) });
    const lines = [...fails.map((f) => `FAIL: ${f}`), ...warns.map((w) => `WARN: ${w}`)];
    const report = lines.length ? lines.join('\n') : 'PASS: no problems found';
    writeFileSync(join(dir, 'checks.txt'), `${report}\n`);
    print(report);
    return fails.length ? 1 : 0;
  },
  async preview([draftDir], cfg) {
    const { writePreview } = await import('./lib/preview.mjs');
    print(writePreview(need(draftDir, 'draftDir'), { displayName: cfg.displayName, headline: cfg.headline }));
  },
  status([id, status, postUrl], { draftsDir }) {
    setStatus(need(draftsDir, '--drafts-dir'), need(id, 'id'), need(status, 'status'), postUrl ? { postUrl } : {});
    print({ id, status });
  },
  declined([projectRoot], { draftsDir }) {
    return commands.drafted([projectRoot], { draftsDir });
  },
  drafted([projectRoot], { draftsDir }) {
    const root = rootOf(need(projectRoot, 'projectRoot'));
    const dir = need(draftsDir, '--drafts-dir');
    const head = headSha(root);
    updateProject(dir, root, { sinceSha: head, lastSeenSha: head });
    print({ project: root, sinceSha: head });
  },
  eligible([projectRoot], { draftsDir }) {
    print(checkEligibility(rootOf(need(projectRoot, 'projectRoot')), { draftsDir: need(draftsDir, '--drafts-dir') }));
  },
  commits([projectRoot], { draftsDir }) {
    const root = rootOf(need(projectRoot, 'projectRoot'));
    const { sinceSha } = getProject(need(draftsDir, '--drafts-dir'), root);
    print({ commits: commitsSince(root, sinceSha), stat: diffstat(root, sinceSha) });
  },
  history([projectRoot], { draftsDir }) {
    const all = readHistory(need(draftsDir, '--drafts-dir'));
    const key = projectRoot ? projectKey(rootOf(projectRoot)) : null;
    print(key ? all.filter((e) => e.project && projectKey(e.project) === key) : all);
  },
};

async function main() {
  const [command, ...rest] = process.argv.slice(2);
  const { positional, flags } = parseArgs(rest);
  const cfg = loadConfig(process.env, {
    draftsDir: flags['drafts-dir'],
    displayName: flags.name,
    headline: flags.headline,
  });
  try {
    if (!command || !commands[command]) throw new UsageError(command ? `unknown command "${command}"` : 'no command');
    return (await commands[command](positional, cfg)) ?? 0;
  } catch (err) {
    process.stderr.write(`${err.message}\n`);
    if (err instanceof UsageError) {
      process.stderr.write(`${USAGE}\n`);
      return 2;
    }
    return 1;
  }
}

process.exitCode = await main();
