---
name: lnvid
description: Add a hyper-animated, infographic-style video to an existing autoLinkIN LinkedIn draft. Use when the user runs /lnvid, or says yes to the video verdict that lndraft gave.
---

# lnvid

Build a video for a draft that already exists. Skip the debate about whether to make one; the user asked.

## Paths

- CLI: `node "${CLAUDE_PLUGIN_ROOT}/scripts/cli.mjs" <command> ... --drafts-dir "${user_config.drafts_dir}"`

## Steps

1. **Pick the draft.** Use the one the user mentions or names. Otherwise run `history <root>` and take the latest entry whose status is `drafting` or `approved`. Read its `brief.md` and `post.md`.
2. **Storyboard.** Propose the length, aspect ratio and style that fit this project and this post, and confirm them with the user. There are no defaults.

   The style is hyper-animated and infographic-like. It can lift the app's real components (cards, charts, buttons, terminal output) and animate them punchily. It does not have to keep the app's original look. A product piece for clients and an explainer for devs will look different.
3. **Voiceover.** Ask whether the user records it themselves or ElevenLabs generates it. Plan captions either way, since most feeds autoplay muted. If ElevenLabs tools are not available in this session, say so and offer the user's own recording or captions only.
4. **Build.** Use the hyperframes skills: `hyperframes` first, then `hyperframes-animation`, `hyperframes-audio` and `media-use` as needed. Generate images with the INSPI MCP tools when they are available, and say so when they are not.
5. **Save.** Render into `<draft dir>/media/`. Add the final length, ratio and voiceover choice to `brief.md`. Run `preview <draft dir>` and show the preview in the side panel.

Any narration or caption text follows `${CLAUDE_PLUGIN_ROOT}/skills/lndraft/references/voice-rules.md`, and the video never shows numbers the project cannot back up.
