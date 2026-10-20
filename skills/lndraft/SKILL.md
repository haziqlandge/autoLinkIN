---
name: lndraft
description: Make a LinkedIn draft for work the user just shipped (a release, a deploy, an important feature, or a bundle of smaller ones) in the user's own voice, with a video verdict, a feed-card preview, and the LinkedIn composer filled on approval. Use when an autoLinkIN hook reports a milestone or commit bundle and the user wants a draft, when the user runs /lndraft, or when the user asks for a LinkedIn post about their project.
---

# lndraft

Turn what the user shipped into a LinkedIn draft they review before anything goes out.

## Hard rules

- Never press Post, Comment, Save or any other submit control on LinkedIn. The user does that.
- Never invent numbers, users, results or quotes. Every claim traces back to the project.
- Never edit the writing-style sources. The only voice file you may write is `linkedin-voice.md`.
- No drafts for private or NDA projects unless the project opted in.

## Paths

- CLI: `node "${CLAUDE_PLUGIN_ROOT}/scripts/cli.mjs" <command> ... --drafts-dir "${user_config.drafts_dir}"`
- Writing-style sources (read only): `${user_config.style_sources}`
- Learned voice notes (read and update): `${user_config.drafts_dir}/linkedin-voice.md`
- Writing rules: `${CLAUDE_PLUGIN_ROOT}/skills/lndraft/references/voice-rules.md`
- Composer steps: `${CLAUDE_PLUGIN_ROOT}/skills/lndraft/references/composer.md`

## Steps

1. **Project and eligibility.** The project root is the git top level of the current project, or the one the user names. Run `eligible <root>`. If it is not eligible, tell the user why, and that adding `{"optIn": true}` to `.autolinkin` in the project root opts it in. Then stop.
2. **What shipped.** Run `commits <root>`. Read the README, changelog or release notes, plus what this session just built. Write down what shipped in plain words, with real numbers only.
3. **Voice.** Read the style sources, `linkedin-voice.md` and `voice-rules.md`. When `linkedin-voice.md` conflicts with the style sources, `linkedin-voice.md` wins. Run `history <root>` so you don't repeat an angle, and continue a series when one fits.
4. **Audience.** Decide who the post is for, from what the project is:
   - A free dev tool or MCP: devs and the people who use that tool.
   - A tool that helps a business: clients and customers first, then devs who might build something similar.
   - Anything else: whatever the project clearly calls for.

   The goal is attention and inbound messages, so make it obvious who this helps and how to try it or reach the user.
5. **Draft.** Run `new <root> "<short title>"`. It prints `{id, dir}`. In `dir`, write:
   - `brief.md`: what shipped; the audience and why; the angle; the hooks you considered; the video verdict; every line that recalls a personal event, flagged for review; a reason for any emoji.
   - `post.md`: the post, with hashtags at the end (3 by default, never more than 5).
   - `first-comment.md`: links and extras.
6. **Check.** Run `check <dir>`. Fix until it exits 0, and either fix every WARN or answer it in `brief.md`. Then copy `post.md` to `post.original.md`. Do this once only, for the first passing version, and never edit `post.original.md` afterwards.
7. **Video verdict.** Tell the user, in this shape:

   ```
   Video: yes | no
   - <would it bring real attention, and why>
   - <would it help people understand the app, and why>
   Want me to make it? Your call.
   ```

   If they say yes, follow the `lnvid` skill now or later. There is no default length, ratio or style.
8. **Media.** Take the screenshots the post needs from the real app and save them in `<dir>/media/`. Generate images with the INSPI MCP tools if they are available. If they are not, say so and carry on.
9. **Account stats.** If `${user_config.drafts_dir}/account.json` is missing, more than 7 days old, or marked `"sample": true`, refresh it from `${user_config.stats_profile}` with the built-in browser tools:
   - On the profile, read the follower and connection counts.
   - On its recent-activity page, read the latest 5 to 10 posts: reactions, comments and reposts.
   - When the signed-in account is that same profile, also read impressions from each post's analytics page (`/analytics/post-summary/<urn>/`). Impressions are only visible to the owner.

   Write the file in this shape, with only numbers you actually read:

   ```json
   { "sample": false, "source": "linkedin.com/in/<name>", "capturedAt": "<ISO time>",
     "followers": 0, "connections": 0,
     "recentPosts": [{ "label": "<short topic>", "impressions": 0, "reactions": 0, "comments": 0, "reposts": 0 }] }
   ```

   Leave out `impressions` when you could not read them. If `stats_profile` is not set, skip this step; the preview will say there are no stats yet.
10. **Analysis.** Write `analysis.md` in `<dir>`: two or three short paragraphs in plain words. Cover what will make this post work, its weakest spot, and one concrete change that would likely help. No jargon and no internal details (tests, tools, rule names).
11. **Preview.** Run `preview <dir>`, then show the printed `preview.html` path in the side panel with SendUserFile (display: render). It opens on the post card, with a sidebar of insight pages (Performance, Content, Checks, Analysis) built from:
    - account stats
    - an expected-reach estimate
    - a content score with what is helping and what is holding the post back
    - `analysis.md`
    - plain-language checks

    Add `--style plain` for the quieter single-page layout with the card and dashboard side by side.

    Tell the user they can edit `post.md` directly or reply with changes.
12. **Revise.** After every change, run `check` and `preview` again, and update `analysis.md` when the change affects it.
13. **Approve and post.** On an explicit approval:
    1. Run `status <id> approved`.
    2. Fill the composer on the account signed in to the browser panel, following `composer.md`. Stop before Post.
    3. When the user says it is posted, fill the first comment and stop before Comment.
    4. Run `status <id> posted <postUrl>`, then `drafted <root>`.
14. **Learn.** Compare `post.original.md` with the final text: `post.md`, or the published post read back from LinkedIn if the user edited it in the composer. Turn each real difference into a short dated rule in `linkedin-voice.md`. Merge and prune old rules so the file stays short.

If the user turns down a draft that a hook offered, run `declined <root>` so the same work is not offered again.
