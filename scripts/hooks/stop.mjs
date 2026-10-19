// Stop hook: when new commits landed since the last check, hand Claude the
// bundle since the last draft or decline so it can judge if it is postable.
import { basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readStdinJson, emit, runSafely } from '../lib/hookio.mjs';
import { loadConfig } from '../lib/config.mjs';
import { repoRoot, headSha, commitsSince, diffstat } from '../lib/git.mjs';
import { checkEligibility } from '../lib/eligibility.mjs';
import { getProject, updateProject } from '../lib/state.mjs';
import { buildBundleContext } from '../lib/milestone.mjs';

const CLI = fileURLToPath(new URL('../cli.mjs', import.meta.url));

await runSafely(async () => {
  const input = await readStdinJson();
  if (!input || input.stop_hook_active === true) return;
  const { draftsDir } = loadConfig();
  if (!draftsDir) return;
  const root = repoRoot(input.cwd || process.cwd());
  if (!root) return;
  const head = headSha(root);
  const project = getProject(draftsDir, root);
  // First sight: work that predates autoLinkIN is not "just shipped". A repo
  // with no commits yet starts from the beginning; one with history starts at HEAD.
  if (!project.baselined && project.sinceSha === null) {
    updateProject(draftsDir, root, head ? { baselined: true, sinceSha: head, lastSeenSha: head } : { baselined: true });
    return;
  }
  if (!head || project.lastSeenSha === head) return;
  if (!checkEligibility(root, { draftsDir }).eligible) return;

  const commits = commitsSince(root, project.sinceSha);
  updateProject(draftsDir, root, { lastSeenSha: head });
  if (!commits.length) return;
  emit({
    hookSpecificOutput: {
      hookEventName: 'Stop',
      additionalContext: buildBundleContext({
        projectName: basename(root), root, commits, stat: diffstat(root, project.sinceSha), cliPath: CLI, draftsDir,
      }),
    },
  });
});
