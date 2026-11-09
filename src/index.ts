// kallander-messages: Messages for every CRM David builds (Ranger Ops, the Legacy CRM, and the next ones). README.md says
// how to drop it in.
export { buildInbox, channelName, clock, dayName, firstName, initials, preview, whenShort, type Conversation, type Message, type MessageState } from "./rules";
export { MessagesInbox, PaneHead, MarkButtons, type InboxFilter, type InboxProps, type InboxRow, type Mark } from "./Inbox";
export { Thread, type ThreadItem } from "./Thread";
export { Composer, insertAt, type Attachment, type ChannelOption, type ComposerProps, type Person, type SavedReply, type SendResult } from "./Composer";
export { MessagesLook, useLook, type Look } from "./look";
export { loadDraft, saveDraft, useDrafts, type Draft } from "./drafts";
export { findMentions, markMentions, mentionedNames } from "./mentions";
