// PostToolUse hook: when a shell command releases or deploys an eligible
// project, tell Claude to offer a LinkedIn draft once its task is done.
import { basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readStdinJson, emit, runSafely } from '../lib/hookio.mjs';
import { loadConfig } from '../lib/config.mjs';
import { repoRoot, headSha } from '../lib/git.mjs';
import { checkEligibility } from '../lib/eligibility.mjs';
import { getProject, updateProject } from '../lib/state.mjs';
import { classifyCommand, buildMilestoneContext } from '../lib/milestone.mjs';

const CLI = fileURLToPath(new URL('../cli.mjs', import.meta.url));

await runSafely(async () => {
  const input = await readStdinJson();
  if (!input || !['Bash', 'PowerShell'].includes(input.tool_name)) return;
  const milestone = classifyCommand(input.tool_input?.command);
  if (!milestone) return;
  const { draftsDir } = loadConfig();
  if (!draftsDir) return;
  const root = repoRoot(input.cwd || process.cwd());
  if (!root) return;
  if (!checkEligibility(root, { draftsDir }).eligible) return;

  const project = getProject(draftsDir, root);
  if (milestone.firstOnly && project.firstMilestones.includes(milestone.kind)) return;
  const head = headSha(root);
  updateProject(draftsDir, root, {
    baselined: true,
    sinceSha: project.sinceSha ?? head,
    lastSeenSha: head ?? project.lastSeenSha,
    firstMilestones: milestone.firstOnly ? [...project.firstMilestones, milestone.kind] : project.firstMilestones,
  });
  emit({
    hookSpecificOutput: {
      hookEventName: 'PostToolUse',
      additionalContext: buildMilestoneContext({
        projectName: basename(root), root, kind: milestone.kind, detail: milestone.detail, cliPath: CLI, draftsDir,
      }),
    },
  });
});
