# kallander-messages

Messages for every CRM David builds: the conversation list, the conversation, and the reply box, working like Messages
on a Mac and iPhone. Ranger Ops and the Legacy CRM use it today. Change it here once and each app picks up the change
when it moves to the new version.

What's shared: how the screen is laid out and how it behaves. That covers Needs reply, the unread dot, Done, Mark
unread, the round Read and Done buttons, the right-click menu, the iPhone swipe, the arrow keys, ⌘ Enter to send, and
the larger email window.

What each app keeps: its own database tables, how it sends (GHL, Twilio, Resend…), its colors and font, and its own
buttons.

## The pieces

| Piece | What it is |
|---|---|
| `buildInbox(messages, states)` | Groups messages into conversations and works out Needs reply, unread and Done. |
| `<MessagesInbox>` | The whole page: search, filters, the list, and a slot for the right side. |
| `<PaneHead>`, `<MarkButtons>` | The top of a conversation: back, picture, name, Mark read / Mark as Done. |
| `<Thread items>` | The bubbles: theirs left, ours right, a line per day, calls in the middle, notes. |
| `<Composer>` | The reply box: Text / Email / Note, who it's to, subject, ⌘ Enter, saved replies (`replies`, `fill`), drafts kept in the browser (`draftKey`: the conversation's key), and pictures and files (`attach`: the app uploads; `send` gets `files`, v1.6.0). |
| `drafts` on `<MessagesInbox>` | Shows a red **Draft:** in place of a conversation's last message when its reply box has one (v1.5.0). |
| `attachments` on a Thread message | Pictures and files shown in the bubble under the words (v1.6.0). |
| `mentions` on `<Composer>` and `<Thread>` | Teammates' first names: an @mention in a private note is highlighted as it's typed, the box says who'll be told, and the saved note shows it highlighted (v1.7.0). The app does the telling. `findMentions` / `mentionedNames` find them. Color: `--km-mention`. |
| `mentions` on `<Composer>` and `<Thread>` | Teammates' first names: an @mention is highlighted as it's typed in a private note, with "Deborah will be told" under the box, and in the saved note (v1.7.0). The app does the telling. `findMentions`, `mentionedNames`, `markMentions` are exported too. |
| Reactions on `<Thread>` | A "👍 to “…”" (Android) or "Liked “…”" (iPhone) text shows as the emoji on the corner of the text it's about, like a phone, instead of its own bubble; one that matches no earlier text stays a bubble. Give each message `from` (a first name) for "Amanda liked this" on hover. `reactions={false}` turns it off (v1.8.0). |
| A thumbs-up is "got it" | `buildInbox` doesn't put a conversation on Needs reply (or unread) for a 👍 reaction, iPhone's "Liked …", or a text that's only 👍; words before it still count, and other reactions (❓, ❤️) still do. `isAcknowledgement(body)` is the test, also from `@kallander/messages/reactions` for an app's server, which has no React (v1.8.1). |
| `request.focus` on `<Composer>` | `false` sets who it's to and the way (Text, Email) without moving the cursor into the box: for a To: line where someone is still typing names (v1.8.2). |
| `<EmailWindow>`, `onOpen` on a Thread message | An email as the customer saw it: give an email's message `onOpen` and clicking its bubble (or Enter on it) calls it; the app finds the email's HTML and shows `<EmailWindow subject lines html text loading onClose>`. The HTML sits in a frame that runs nothing in it, its links open in a new tab, and with no copy its words show with a line saying so. On a phone it fills the screen. Render it through a portal (`createPortal(…, document.body)`) so nothing on the page clips it (v1.9.0). |
| `<MessagesLook>` | Hands the package the app's own button, segmented-control, tag and link classes. |

## Dropping it into a new CRM

1. Install it (one line in a terminal, in the CRM's folder):

   ```bash
   npm install github:davidkallander/kallander-messages#v1.0.0
   ```

2. Database: copy `sql/messages-starter.sql` into the CRM's numbered SQL files and change the lines marked `CHANGE`.

3. In the app's entry file (`src/main.tsx`), load the styles before the app's own and pass its controls:

   ```tsx
   import { MessagesLook } from "@kallander/messages";
   import "@kallander/messages/messages.css";
   import "./styles.css";
   // …
   <MessagesLook value={{ button: "btn small", segment: "seg", tag: "pill", link: "link" }}><App /></MessagesLook>
   ```

4. Your colors: in the app's `styles.css`, set the `--km-…` variables to the app's own colors. The top of
   `src/messages.css` lists every variable with a note on what it colors. Ranger Ops maps them to its green, Legacy to
   navy and gold.

5. Write one small file that loads the CRM's messages, turns each one into the package's shape (`conversation`,
   `direction`, `channel`, `body`, `sent_at`…), and calls `buildInbox`. Then render `<MessagesInbox>` with a pane that
   holds `<PaneHead>`, `<Thread>` and `<Composer>`. Copy from a working example:
   - Ranger Ops: `src/lib/inbox.ts`, `src/components/MessagesPage.tsx`, `src/components/Conversation.tsx`
   - Legacy CRM: `src/lib/inbox.ts`, `src/components/InboxPage.tsx`, `src/components/FamilyThread.tsx`

6. Give the page a height in the app's CSS (it fills the box it's given): `.km-inbox.your-class { height: … }`.

## Changing it

1. Make the change here and run `npm test` and `npm run typecheck`.
2. Try it in both apps before releasing. Each app links to this folder while it's being worked on:
   `npm install ../kallander-messages` (Legacy: `../../kallander-messages`). Put it back to the GitHub version before
   committing the app.
3. Raise the version in `package.json` (1.0.1 for a fix, 1.1.0 for something new), commit, push, and tag it:
   `git tag v1.1.0 && git push origin v1.1.0`.
4. In each app, move to the new version when you're ready: `npm install github:davidkallander/kallander-messages#v1.1.0`,
   check it in the preview, and release the app as usual.

An app only changes when it's moved to a new version, so a change made for one app can't break the other by surprise.

## Rules every app follows

- Opening a conversation doesn't mark it read in Ranger Ops (Mark read is a choice). The Legacy CRM still marks it read
  when opened. The package supports both ways; each app decides.
- A message that didn't send isn't an answer: the conversation stays on Needs reply.
- Done marks it read. Mark unread takes Done off. Mark read clears Mark unread.
- Never put real customers' or families' details in this repository's tests. Use made-up people.
