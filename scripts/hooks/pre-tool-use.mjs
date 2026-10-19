// PreToolUse hook: any change to a protected path needs the owner's approval,
// and the permission prompt shows exactly what would change.
import { readStdinJson, emit, runSafely } from '../lib/hookio.mjs';
import { loadConfig } from '../lib/config.mjs';
import { isProtectedPath, shellWritesTo, buildPreview } from '../lib/guard.mjs';

const FILE_TOOLS = new Set(['Write', 'Edit', 'MultiEdit', 'NotebookEdit']);
const SHELL_TOOLS = new Set(['Bash', 'PowerShell']);

await runSafely(async () => {
  const input = await readStdinJson();
  if (!input) return;
  const { protectedPaths } = loadConfig();
  if (!protectedPaths.length) return;
  const tool = input.tool_name;
  const args = input.tool_input || {};
  let hit = false;
  if (FILE_TOOLS.has(tool)) hit = isProtectedPath(args.file_path || args.notebook_path, protectedPaths);
  else if (SHELL_TOOLS.has(tool)) hit = shellWritesTo(args.command, protectedPaths, input.cwd);
  if (!hit) return;
  emit({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'ask',
      permissionDecisionReason: `autoLinkIN: this changes your protected writing-style memory. Allow only if you approve this change.\n\n${buildPreview(tool, args)}`,
    },
  });
});
