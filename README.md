# autoLinkIN

A Claude Code plugin that turns work you actually shipped into LinkedIn drafts you review before anything goes out.

## What it does

- Notices a release, a first deploy or publish, an important feature, or a bundle of smaller features that adds up, and asks you once whether you want a post.
- Writes the draft in your own voice, from the writing-style files you point it at. It checks the draft against hard rules: no em dashes, at most 5 emoji, at most 5 hashtags, and LinkedIn's length limits.
- Picks the audience per project and says why.
- Tells you whether a video would help and why. You decide.
- Shows a LinkedIn-style feed-card preview.
- Fills the LinkedIn composer in the Claude desktop app's browser panel and stops. You press Post.
- Learns from your edits into its own voice notes, and asks before anything touches the writing-style files you protect.

It never posts, comments or saves anything on LinkedIn by itself.

## Install

Requires Node 22 or later, git, and optionally the `gh` CLI (used to skip private repos).

```bash
claude plugin marketplace add <path-to-this-repo>
claude plugin install autolinkin@autolinkin
```

Then set the options with `/plugin configure autolinkin@autolinkin` in Claude Code. Use forward slashes in paths.

| Option | What it is |
|---|---|
| `drafts_dir` | Folder for drafts, history, learned voice notes and state. Keep it out of any public repo. |
| `style_sources` | Files that describe your writing style. Read only. |
| `protected_paths` | Files or folders that need your approval, with the change shown, before anything edits them. |
| `display_name` | Name shown on the preview card. |
| `headline` | Headline shown on the preview card. |

Start a new session after installing so the hooks load.

## Use

- `/autolinkin:lndraft` makes a draft for what you just shipped. With the optional user-level shortcut skills it is just `/lndraft`.
- `/autolinkin:lnvid` adds a video to an existing draft (`/lnvid` with the shortcut).

The plugin also asks on its own:

- After `git tag`, `gh release create` or `npm version`.
- After the first publish or production deploy of a project (npm, cargo, PyPI, Vercel, Netlify, Firebase, Fly, Wrangler).
- At the end of a turn, when new commits might add up to something worth posting.

If you say no, that work is not offered again.

## Private and NDA projects

Private GitHub repos are skipped. To mark any project, put a `.autolinkin` file in its root:

```json
{ "nda": true }
```

`{ "optIn": true }` overrides both rules. The plugin hides `.autolinkin` from git through the repo's local exclude list.

## Development

```bash
npm test
```

## License

MIT
