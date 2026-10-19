# autoLinkIN design

Date: 2026-10-19
Status: draft for approval

## 1. Intent

autoLinkIN is a Claude Code plugin that turns real shipped work into LinkedIn drafts the owner reviews before anything goes out. The owner builds a lot of projects with agents running in parallel and wants attention and steady inbound messages from that work, without writing every post by hand and without posts that read like AI.

It notices when something worth posting has shipped, asks first, then writes a draft in the owner's own voice with the media the post needs, shows a LinkedIn-style preview, and fills the LinkedIn composer so the owner only has to press Post.

## 2. Goals, non-goals, anti-goals

Goals
- Ask at the right moments: releases, deploys, an important feature, or enough small features to be worth a post. No time-based throttling.
- Drafts that sound like the owner, follow hard style rules, and pick the right audience for each project.
- A video recommendation with reasons on every draft, decided by the owner; a full video pipeline when wanted.
- Learn from the owner's edits so drafts get closer to final over time.
- Works in every project the owner opens in the Claude desktop app.

Non-goals (v1)
- Other LinkedIn activity: hackathons, seminars, certificates, volunteering, Experience entries. Planned later (see section 12).
- PDF / document carousels.
- Posting through the LinkedIn API.
- Terminal-only Claude Code sessions. The owner uses the desktop app.
- Screenshot tooling. Sessions already take whatever screenshots a draft needs.

Anti-goals (fails even if it technically works)
- Posting, commenting or saving anything on LinkedIn without the owner pressing the button.
- Drafting about private or NDA work.
- Writing that reads as AI: hype words, reveal bridges, stacked triads, em dashes, emoji spam.
- Inventing numbers, users or results.
- Using the owner's personal life as content beyond the narrow case in 6.3.
- Changing the owner's protected writing-style memory without explicit approval.
- Nagging about every small commit.

## 3. Decisions the owner made

| Topic | Decision |
|---|---|
| Form | Custom Claude Code plugin, own code. Only borrow ideas from other projects when they are substantial. No credits needed since nothing is copied. |
| Repo | Public GitHub repo `autoLinkIN`, local at `E:\ProjectsPVT\autoLinkIN`. Commits through the `commitskill` skill. |
| Commands | `lndraft` (make a draft, including a video verdict) and `lnvid` (explicitly add a video to an existing draft). |
| Triggers | Version tag, GitHub release, first deploy or publish, an important feature landing, or a bundle of small features big enough for a post. Always ask first. No time limits. |
| Eligibility | Every project except a private repo or a project marked NDA, unless opted in. |
| Audience | Chosen per project. Free dev tools (example: the Packet Tracer MCP) target devs and users of that tool. Business tools target clients and customers first, devs second. |
| Success | Attention plus steady inbound messages. |
| Voice | Copy the writing style from the owner's eureka writing-style memory. Proper casing (I, sentence starts), no typos, no swearing. Sections and lists are fine as long as tone and way of speaking are preserved. English only. Length depends on the post. |
| Personal life | Not used, except a dramatic line recalling a personal event when it fits the project (example: in a post about a finished game, a line recalling a childhood wish to make games and not having the means back then). The owner reviews every such line. |
| Emoji | Default 0, hard cap 5 across the whole draft, only when one earns its place. |
| Dashes | Em dashes banned. Plain hyphens are fine. |
| Hashtags | Best practice from research: 3 by default, never more than 5, at the end. |
| Video | No default length, ratio or style. Model and owner decide per project. Style when made: hyper-animated, infographic-like, can take the app's components and animate them punchily, does not have to keep the original look. |
| Voiceover | Owner's own voice or ElevenLabs, owner decides each time. |
| Images | INSPI MCP. |
| Drafts | A `linkedin-drafts` folder with one subfolder per draft, plus a pointer in the project. Lives inside `E:\ProjectsPVT\autoLinkIN` (git-ignored). |
| Review | HTML preview that looks like a LinkedIn feed card. Owner edits the draft file directly or replies in chat. |
| Posting | Fill the LinkedIn composer in the desktop app's browser panel; owner presses Post. Drafts go to the throwaway account signed in there. |
| Learning | Learn from the owner's edits into a plugin-owned `linkedin-voice.md`. The eureka memory is read-only. A hook catches any change to it, shows the exact change, and the owner allows or declines. |
| History | Track every draft and post. |

## 4. Shape of the plugin

```
autoLinkIN/
  .claude-plugin/
    plugin.json          name "autolinkin", userConfig (section 9)
    marketplace.json     local marketplace so the repo folder installs in place
  skills/
    lndraft/SKILL.md     the drafting workflow (section 6)
    lnvid/SKILL.md       the video workflow (section 7)
    voice/               voice rules the two skills load (section 6.3, 6.4)
  hooks/hooks.json       milestone hook, end-of-turn check, protection guard
  scripts/               Node scripts the hooks and skills call (no npm dependencies unless needed)
  templates/
    feed-card.html       preview template
    linkedin-voice.template.md
  docs/superpowers/specs/  this document
  linkedin-drafts/       git-ignored owner data (section 5)
```

Node is the script runtime (Claude Code already needs it; v22 is on the machine). Plugin components are namespaced, so commands appear as `/autolinkin:lndraft` and `/autolinkin:lnvid`. The owner wants to type `/lndraft` and `/lnvid`; if the bare names do not resolve, add two tiny user-level skills with those names that hand off to the plugin skills.

The repo is public. Everything personal lives only in git-ignored folders or in files read from their existing locations at runtime: the eureka memory, `linkedin-voice.md`, drafts, history, state. The repo ships code, templates and a blank voice template.

## 5. Data on disk

```
linkedin-drafts/
  linkedin-voice.md      learned voice notes, the only voice file the plugin may write
  history.jsonl          one line per draft: id, project, date, kind, audience, status, post URL if known
  state/projects.json    per project: since_sha, last_seen_sha, visibility cache, opt-in/NDA flags seen
  2026-10-19-<project>-<slug>/
    brief.md             what shipped, chosen audience and why, angle, video verdict with reasons,
                         any personal-event lines flagged for review
    post.original.md     first full draft that passed the checker, never edited
    post.md              working draft the owner may edit
    first-comment.md     links and extra context for the first comment
    media/               screenshots, images, video
    preview.html         feed-card preview
    checks.txt           latest checker output
```

Project pointer: a `.autolinkin` JSON file in the project root, listing that project's draft folders and holding per-project flags (`"nda": true`, `"optIn": true`). The plugin adds `.autolinkin` to the project's `.git/info/exclude` so it never appears in the owner's commits.

## 6. `lndraft`

### 6.1 Flow

1. Work out what shipped: commits since the project's `since_sha`, tags, release notes, README, and what the session just did.
2. Check eligibility (section 8). Stop with a one-line explanation if the project is not eligible.
3. Load voice: the eureka writing-style memory (read only), `linkedin-voice.md`, and the rules in 6.3 and 6.4. Read `history.jsonl` to avoid repeating angles and to continue a series when it fits.
4. Pick the audience from what the project is (section 3), and say which audience and why in `brief.md`.
5. Write `post.md`, `first-comment.md` and hashtags. Save the first passing version as `post.original.md`.
6. Video verdict: say whether a video would bring real attention or help people understand the app, with reasons, and ask the owner. On yes, run the `lnvid` workflow now or leave it for later.
7. Media: the session takes the screenshots it needs; images come from the INSPI MCP when it is enabled. If an MCP is disabled, say so and continue without it.
8. Run the checker (6.5) and fix until it passes.
9. Build `preview.html` and show it in the desktop app's side panel. The browser panel cannot open local files.
10. Review loop: the owner edits `post.md` or replies in chat. Re-run the checker after every change.
11. On approval: fill the composer (6.6). Update history and the project pointer, and move `since_sha` to HEAD.
12. Learn from the edits (6.7).

### 6.2 Audience and success

Every draft states its audience: devs and users of the tool for free dev tools; clients and customers first, devs second for business tools; something else when the project clearly calls for it. The aim is attention and inbound messages, so the post should make it clear who it helps and how to reach the owner or try the thing. That comes from the content, not from engagement bait.

### 6.3 Voice

Copy how the owner writes, as described in the eureka writing-style memory:
- A thought moves from noticing something, to stepping back, to comparing with before, to naming what is at stake, often ending on an open question.
- Concrete anchors: exact numbers, named tools, times, places.
- Balanced antitheses for punch. Big metaphors that stay in one image for a few sentences.
- Self-addressed questions. Connectors like "so", "but", "and then", "finally".
- Explains jargon for an outside reader. Admits mistakes plainly. Dry humour.

Then clean it for LinkedIn: proper capitals, correct spelling, no swearing. Sections and short lists are allowed.

Personal life: do not draw on the memory's personal content (relationships, family, self-talk). The single exception is a dramatic line recalling a personal event that ties directly to the project. Every such line is listed in `brief.md` for review.

### 6.4 Writing rules

These are borrowed as ideas, not copied:
- Never open with a question. A concrete, specific first line (an odd-precision number with a referent works well) beats a teaser.
- The first ~210 characters, before "see more", carry the hook.
- AI tells to avoid, each judged by density and not as a blind ban list:
  - hype vocabulary (excited to announce, thrilled, game-changer, delve, leverage, robust, seamless, elevate, landscape)
  - reveal bridges ("The result?", "Here's the thing", "Plot twist")
  - staccato fragment runs ("Short. Punchy. Done.")
  - more than one triad
  - more than one "not X, it's Y" contrast
  - performed sincerity ("let me be honest")
  - mechanically alternating sentence lengths
- Over-correction guard: do not make the writing worse on purpose to look human.
- No invented facts. Every number traces back to the project.
- Hashtags: 3 by default, 5 maximum, at the end, one or two broad plus one niche, CamelCase.
- First comment: links and extras.

### 6.5 Checker

A script run on `post.md` and `first-comment.md`. It writes `checks.txt`.

Hard fail:
- em dash U+2014, en dash U+2013 and the other long dashes (U+2012, U+2015)
- more than 5 emoji across post and comment
- more than 5 hashtags
- post over 3000 characters, comment over 1250
- a lowercase standalone "i"
- swear words
- blocklisted phrases

Warn, and must be answered in `brief.md`:
- any emoji at all (say why it earns its place)
- hook longer than the fold
- density-based AI tells from 6.4

### 6.6 Composer fill

Uses the desktop app's built-in browser tools on whichever LinkedIn account is signed in. Today that is the throwaway account.

1. Open the feed and start a post.
2. Type `post.md`.
3. Attach media if the browser tool allows it.
4. Stop. The owner presses Post.

After the owner says it is posted, fill the comment box on that post with `first-comment.md` and stop again; the owner presses Comment.

Fallback, if LinkedIn's UI changes or attaching fails: copy the text to the clipboard and tell the owner which files to drag in from `media/`.

### 6.7 Learning from edits

When a draft is approved, compare `post.original.md` with the final text: `post.md`, or the published post read back from LinkedIn if the owner edited in the composer. Turn real differences into short dated rules in `linkedin-voice.md`, for example "cuts the closing question when the post ends on a result" or "prefers 'I built' over 'we built'". Merge and prune old rules so the file stays short. The eureka memory is never written to (section 10).

## 7. `lnvid`

Works on an existing draft (the latest one, or one named by the owner). No default length, ratio, style or voice: the model proposes what fits this project and this post, and the owner decides.

1. Plan a storyboard: a hyper-animated, infographic-style explainer or product piece. It can lift the app's real components and animate them punchily, and it does not have to keep the original look.
2. Voiceover: the owner records it, or ElevenLabs generates it. The owner chooses each time. Captions are planned in either case, since most feeds autoplay muted.
3. Build and render with the existing hyperframes skills (hyperframes, hyperframes-animation, hyperframes-audio, media-use).
4. Save to the draft's `media/`, update `brief.md` and the preview.

In `lndraft`, the video verdict comes first and runs on its own. `lnvid` skips the debate and builds.

## 8. Eligibility

A project is skipped unless opted in (`"optIn": true` in `.autolinkin`) when either:
- its `origin` remote is a private GitHub repo (checked with `gh repo view --json visibility`, cached in state), or
- `.autolinkin` has `"nda": true`.

A project with no remote is eligible. Ineligible projects get no hook prompts. A manual `lndraft` refuses with the reason and the opt-in instruction.

## 9. Configuration (`userConfig`)

| Key | Type | Purpose |
|---|---|---|
| `drafts_dir` | directory | Where `linkedin-drafts` lives. Here: `E:\ProjectsPVT\autoLinkIN\linkedin-drafts` |
| `style_sources` | file, multiple | Read-only writing-style files. Here: the eureka `user-writing-style-and-mindset.md` memory |
| `protected_paths` | string, multiple | Paths guarded by section 10. Here: the eureka project memory folder |
| `display_name`, `headline` | string | Shown on the preview card |

Hooks receive these as `CLAUDE_PLUGIN_OPTION_<KEY>`. Install as a local marketplace pointed at the repo folder, so the plugin loads in place and edits apply after a plugin reload.

## 10. Hooks

1. **Milestone hook** (`PostToolUse`, matcher `Bash|PowerShell`). On a successful command that releases or deploys (deploys and package publishes only the first time per project, see 15.1), it adds context for Claude naming the milestone and the project, and Claude asks the owner in one line whether they want a draft. Covered commands:
   - `git tag <name>`, push with tags
   - `gh release create`
   - npm, pnpm or yarn publish; `npm version`
   - `cargo publish`; PyPI uploads through twine, uv or poetry
   - `vercel --prod`, `netlify deploy --prod`, `firebase deploy`, `fly deploy`, `wrangler deploy`

   The hook records the event so the end-of-turn check does not ask twice.
2. **End-of-turn check** (`Stop`). Exits at once if `stop_hook_active` is true, the folder is not a git repo, the project is ineligible, or HEAD equals `last_seen_sha`. Otherwise it adds context (`hookSpecificOutput.additionalContext`, not a block) listing the commits from `since_sha` to HEAD with a short diffstat. Claude judges whether that bundle is an important feature or enough small ones for a post, and only then asks the owner. The hook moves `last_seen_sha` to HEAD.
   - When the owner declines, or a draft is made, `since_sha` moves to HEAD.
   - When Claude decides the work is not enough yet, `since_sha` stays put, so small features keep accumulating into a bundle.
3. **Protection guard** (`PreToolUse`, matcher `Write|Edit|MultiEdit|NotebookEdit|Bash|PowerShell`). If a file tool targets a path under `protected_paths`, it returns `permissionDecision: "ask"` with a reason that contains the change:
   - Edit: old and new text
   - Write: a diff against the current file, truncated sensibly

   For shell tools, any command that mentions a protected path and contains a write-like operation (redirects, `sed -i`, `tee`, `Set-Content`, `Out-File`, `Add-Content`, move, copy or remove) gets `ask`, with the command as the preview. The docs say `ask` still prompts in auto mode and shows the reason in the permission prompt.

## 11. Constraints

- Windows 10, Claude desktop app, Git Bash and PowerShell both in use. Hook scripts must work from both.
- The browser panel cannot open `file://` or local servers, so previews go to the side panel as a rendered file.
- LinkedIn limits: post 3000 characters, comment 1250.
- INSPI and ElevenLabs MCPs may be disabled at any time. Degrade gracefully.
- Never click Post, Comment, Save or any other submit control on LinkedIn for the owner.
- Public repo: no personal data, no machine paths in code (configuration only).

## 12. Later (not v1)

Other activity on LinkedIn: hackathons, seminars, certificates, volunteering, Experience entries. A manual test on 2026-10-19 showed Experience can be added through the browser panel. Two traps:
- Adding a current position silently replaced the profile headline.
- The organisation field suggests real companies as you type, so the automation must close the list rather than pick one by accident.

## 13. Left to the builder

- Exact regexes for milestone commands and write-like shell operations.
- Checker word lists and density thresholds.
- Preview card look, as long as it shows the fold, the media and the first comment.
- How published text is read back for learning.
- Whether video production runs in a subagent to keep the main session's context clean.
- State file format and history fields beyond those listed.

## 14. Risks and early spikes

1. **Media attachment.** Whether the browser tool can attach images and video in LinkedIn's composer, which goes through a file picker. Test first. Fallback in 6.6.
2. **Command names.** Whether `/lndraft` resolves without the `autolinkin:` prefix. Fallback in section 4.
3. **End-of-turn check cost.** It adds one short model step on turns that produce new commits. Watch the noise in real use and tighten if needed (for example, ignore commits that only touch docs or tests).
4. **Bypass permissions.** Whether the guard's `ask` prompts in bypass-permissions mode is undocumented. Test it. If it does not prompt, deny and tell the owner instead.
5. **LinkedIn UI drift.** Changes can break the composer flow. Keep its selectors in one place.

## 15. Calls made without the owner (check these)

1. **Deploys and package publishes count only the first time per project.** Tags and GitHub releases count every time. "First deploy or publish" reads as the moment a project first goes live. Later versions are covered by tags and releases, and asking on every `vercel --prod` would nag.
2. **Asks wait for the current task to finish.** When a hook fires mid-task, Claude finishes what it is doing and then asks, so the owner's work is not interrupted.
3. **On a conflict, `linkedin-voice.md` beats the eureka style memory** for LinkedIn posts, because it is learned from the owner's real edits.
4. **Projects with no remote are eligible.** Only private GitHub repos and NDA-flagged projects are skipped.
5. **Parallel sessions on one project** write state atomically. Two sessions may occasionally both ask about the same work, and that is accepted over the cost of locking.
6. **Uncommitted work never triggers the end-of-turn check,** because the check reads commits. `lndraft` works manually at any time.
