# Filling the LinkedIn composer

Verified 2026-10-19 on the desktop app's built-in browser panel. Use the built-in browser tools (`mcp__Claude_Browser__*`) on the LinkedIn tab that is already signed in. Never sign in or out, and never press Post or Comment.

## What the flow depends on

Keep this list current when LinkedIn changes. Everything else derives from it.

- **Composer opener:** the element whose accessible name is "Start a post" on `/feed/`. Clicking it changes the URL to `/sharing/compose`.
- **Composer:** a native `<dialog>` element. Its text box is `div[role="textbox"].tiptap.ProseMirror`, with the placeholder "Share your thoughts ...".
- **Media button:** the "Media" icon in the composer toolbar. It opens a second dialog ("Select files to begin") that hands off to the operating system's file picker.
- **Close button:** the X at the top right of the composer. It asks to "Discard" or keep the draft.
- **Post button:** "Post", bottom right. **Never click it.**

## Steps

1. Find the LinkedIn tab with `tabs_context`. If the pane is hidden, ask the user to bring it back (Ctrl+Shift+B). If no LinkedIn tab is signed in, ask the user to sign in themselves.
2. **Check the account.** Read the signed-in name from the feed's profile card. If it is not the configured `display_name`, stop and ask the user whether to fill the composer on that account anyway. Drafts go to the account the user chose, never to a surprise one.
3. On `/feed/`, click "Start a post". Wait about 2 seconds for the dialog.
4. **Click inside the text box before typing.** Typing straight after opening the dialog can land nowhere.
5. Type `post.md` one line at a time:
   - press Shift+Enter between lines inside a paragraph
   - press Enter twice for a blank line between paragraphs
6. Check the text landed: read `document.activeElement.innerText`, or `get_page_text`. A screenshot taken straight after typing can be stale and show the empty placeholder.
7. **Media: the browser tools cannot drive the native file picker,** so media is not attached automatically. Tell the user exactly which files to drag into the composer from the draft's `media/` folder, in order.
8. Stop. Tell the user the composer is filled and that they press Post when they are happy. They can still edit the text in the composer.

## After the user says it is posted

1. Open the new post from the user's activity or the feed, and click into its comment box.
2. Type `first-comment.md` and stop. The user presses Comment.
3. Read the published post text back for the learning step, and record the post URL with `status <id> posted <url>`.

## Fallback

If any step fails because LinkedIn's UI changed: copy `post.md` to the clipboard, tell the user to paste it into "Start a post" themselves, list the files to drag in from `media/`, and note what broke so this file can be updated.

## Discarding a test

Click the X, then "Discard". The tab returns to `/feed/`.
