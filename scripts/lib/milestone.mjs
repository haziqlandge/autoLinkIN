// Recognises shell commands that release or deploy a project.

function tokenize(segment) {
  const tokens = [];
  const re = /"((?:[^"\\]|\\.)*)"|'([^']*)'|(\S+)/g;
  let m;
  while ((m = re.exec(segment))) tokens.push(m[1] ?? m[2] ?? m[3]);
  return tokens;
}

function commandName(token) {
  const base = token.replace(/\\/g, '/').split('/').pop().toLowerCase();
  return base.replace(/\.(exe|cmd|bat|ps1)$/, '');
}

const TAG_REFUSE = new Set(['-l', '--list', '-d', '--delete', '-v', '--verify', '-n', '--contains', '--no-contains', '--points-at', '--merged', '--no-merged']);
const TAG_VALUE_FLAGS = new Set(['-m', '--message', '-F', '--file', '-u', '--local-user', '--cleanup']);

function gitTag(args) {
  if (!args.length || args.some((a) => TAG_REFUSE.has(a) || a.startsWith('--list='))) return null;
  for (let i = 0; i < args.length; i += 1) {
    if (TAG_VALUE_FLAGS.has(args[i])) { i += 1; continue; }
    if (!args[i].startsWith('-')) return { kind: 'tag', detail: args[i], firstOnly: false };
  }
  return null;
}

function firstPositional(args) {
  return args.find((a) => !a.startsWith('-')) || null;
}

function classifySegment(tokens) {
  while (tokens.length && /^[A-Za-z_][A-Za-z0-9_]*=/.test(tokens[0])) tokens.shift();
  if (tokens.length && commandName(tokens[0]) === 'npx') tokens.shift();
  if (!tokens.length || tokens.includes('--dry-run')) return null;
  const cmd = commandName(tokens[0]);
  const args = tokens.slice(1);
  const sub = args[0];

  if (cmd === 'git') {
    if (sub === 'tag') return gitTag(args.slice(1));
    if (sub === 'push' && (args.includes('--tags') || args.includes('--follow-tags'))) {
      return { kind: 'tag', detail: 'git push --tags', firstOnly: false };
    }
    return null;
  }
  if (cmd === 'gh' && sub === 'release' && args[1] === 'create') {
    return { kind: 'release', detail: firstPositional(args.slice(2)) || 'gh release create', firstOnly: false };
  }
  if (cmd === 'npm' && sub === 'version' && args[1]) {
    return { kind: 'version', detail: args[1], firstOnly: false };
  }
  const publish = { kind: 'publish', detail: `${cmd} ${args.slice(0, 2).join(' ')}`.trim(), firstOnly: true };
  if ((cmd === 'npm' || cmd === 'pnpm') && sub === 'publish') return publish;
  if (cmd === 'yarn' && (sub === 'publish' || (sub === 'npm' && args[1] === 'publish'))) return publish;
  if (cmd === 'cargo' && sub === 'publish') return publish;
  if (cmd === 'twine' && sub === 'upload') return publish;
  if ((cmd === 'uv' || cmd === 'poetry') && sub === 'publish') return publish;

  const deploy = { kind: 'deploy', detail: `${cmd} ${args.join(' ')}`.trim(), firstOnly: true };
  if (cmd === 'vercel' && args.includes('--prod')) return deploy;
  if (cmd === 'netlify' && sub === 'deploy' && args.includes('--prod')) return deploy;
  if ((cmd === 'firebase' || cmd === 'fly' || cmd === 'flyctl') && sub === 'deploy') return deploy;
  if (cmd === 'wrangler' && (sub === 'deploy' || sub === 'publish')) return deploy;
  return null;
}

export function classifyCommand(cmd) {
  if (typeof cmd !== 'string' || !cmd.trim()) return null;
  for (const segment of cmd.split(/&&|\|\||[;|\r\n]/)) {
    const hit = classifySegment(tokenize(segment.trim()));
    if (hit) return hit;
  }
  return null;
}

export function buildMilestoneContext({ projectName, root, kind, detail, cliPath, draftsDir }) {
  return [
    `autoLinkIN: ${projectName} just hit a milestone (${kind}: ${detail}).`,
    'This project is eligible for a LinkedIn draft.',
    'Once the current task is finished, ask the user in one line whether they want a LinkedIn draft for it.',
    'If yes, use the autolinkin:lndraft skill.',
    `If no, run: node "${cliPath}" declined "${root}" --drafts-dir "${draftsDir}"`,
  ].join(' ');
}
