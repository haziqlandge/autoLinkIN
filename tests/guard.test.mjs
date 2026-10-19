import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpDir, runHook } from './helpers.mjs';
import { isProtectedPath, shellWritesTo } from '../scripts/lib/guard.mjs';

const GUARD = fileURLToPath(new URL('../scripts/hooks/pre-tool-use.mjs', import.meta.url));
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
  assert.ok(!shellWritesTo('echo x > C:/elsewhere/a.md', P));
});

test('hook asks with the change, ignores others, silent without config', () => {
  const dir = tmpDir();
  const f = join(dir, 'style.md');
  writeFileSync(f, 'old line\n');
  const env = { CLAUDE_PLUGIN_OPTION_PROTECTED_PATHS: dir };
  const ask = JSON.parse(runHook(GUARD, { tool_name: 'Edit', tool_input: { file_path: f, old_string: 'old line', new_string: 'new line' } }, env).stdout);
  assert.equal(ask.hookSpecificOutput.permissionDecision, 'ask');
  assert.match(ask.hookSpecificOutput.permissionDecisionReason, /old line[\s\S]*new line/);
  const w = JSON.parse(runHook(GUARD, { tool_name: 'Write', tool_input: { file_path: f, content: 'fresh\n' } }, env).stdout);
  assert.match(w.hookSpecificOutput.permissionDecisionReason, /\+fresh/);
  assert.match(w.hookSpecificOutput.permissionDecisionReason, /-old line/);
  const sh = JSON.parse(runHook(GUARD, { tool_name: 'Bash', tool_input: { command: `echo hi >> "${f}"` } }, env).stdout);
  assert.equal(sh.hookSpecificOutput.permissionDecision, 'ask');
  assert.equal(runHook(GUARD, { tool_name: 'Edit', tool_input: { file_path: join(tmpDir(), 'x.md') } }, env).stdout, '');
  assert.equal(runHook(GUARD, { tool_name: 'Edit', tool_input: { file_path: f } }, {}).stdout, '');
});
