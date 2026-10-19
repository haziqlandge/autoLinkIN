import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadConfig, parseList } from '../scripts/lib/config.mjs';

test('reads plugin options from env', () => {
  const c = loadConfig({
    CLAUDE_PLUGIN_OPTION_DRAFTS_DIR: 'E:/x/linkedin-drafts',
    CLAUDE_PLUGIN_OPTION_STYLE_SOURCES: '["a.md","b.md"]',
    CLAUDE_PLUGIN_OPTION_PROTECTED_PATHS: 'C:/p1;C:/p2',
  });
  assert.equal(c.draftsDir, 'E:/x/linkedin-drafts');
  assert.deepEqual(c.styleSources, ['a.md', 'b.md']);
  assert.deepEqual(c.protectedPaths, ['C:/p1', 'C:/p2']);
});

test('missing config is null, overrides win', () => {
  assert.equal(loadConfig({}).draftsDir, null);
  assert.equal(loadConfig({ CLAUDE_PLUGIN_OPTION_DRAFTS_DIR: 'a' }, { draftsDir: 'D:/d' }).draftsDir, 'D:/d');
});

test('parseList handles newlines and blanks', () => {
  assert.deepEqual(parseList('a\n\n b \n'), ['a', 'b']);
});
