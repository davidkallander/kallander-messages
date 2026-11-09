// Which conversations need a reply, are unread or are done (David, Oct 31, 2026; first built for Ranger Ops and the
// Legacy CRM). Each CRM keeps its own tables; it hands over its messages in this shape and the marks people made.

import { isAcknowledgement } from "./reactions";

export interface Message {
  id: string;
  /** The conversation it belongs to: one person or record (a customer, a family, a phone number nobody's matched). */
  conversation: string;
  direction: "in" | "out";
  /** "sms", "email", "call", "note" or anything else the CRM has. */
  channel: string;
  subject?: string;
  body: string;
  /** ISO time. */
  sent_at: string;
  /** "sending", "sent", "failed"… A failed message isn't an answer. */
  status?: string;
  /** Sent by the CRM on its own (a reminder): the list says "Automatic:", not "You:". */
  automatic?: boolean;
  /** Waits on nobody: an opt-out ("Stop"), or history copied in from an older system. */
  ignore?: boolean;
}

/** The marks on a conversation, shared by everyone: read, Done (no reply needed), and Mark unread (a reminder). */
export interface MessageState {
  conversation: string;
  read_at?: string | null;
  done_at?: string | null;
  unread_at?: string | null;
}

export interface Conversation<M extends Message = Message> {
  key: string;
  last: M;
  count: number;
  /** They wrote last, and nobody's answered or marked it Done since. */
  needsReply: boolean;
  /** They wrote, and nobody's answered, marked it read or tapped Done since (or someone marked it unread). */
  unread: boolean;
  /** Marked Done since they last wrote. Never done and unread: Mark unread takes Done off. */
  done: boolean;
  /** We wrote last and it went (David, Nov 3, 2026): nothing to answer or mark Done; we're waiting on them. */
  waitingOnThem: boolean;
}

/** One conversation per key, the newest first. */
export function buildInbox<M extends Message>(messages: M[], states: MessageState[]): Conversation<M>[] {
  const st = new Map(states.map((s) => [s.conversation, s]));
  const by = new Map<string, M[]>();
  for (const m of messages) {
    if (!m.conversation) continue;
    const list = by.get(m.conversation) ?? [];
    list.push(m);
    by.set(m.conversation, list);
  }
  const out: Conversation<M>[] = [];
  for (const [key, list] of by) {
    list.sort((a, b) => b.sent_at.localeCompare(a.sent_at));
    const last = list[0];
    // A thumbs-up (👍, or "Liked …") is "got it", not something to answer (v1.8.1; David, Nov 8, 2026)
    const lastIn = list.find((m) => m.direction === "in" && !isAcknowledgement(m.body));
    const answeredAfter = (at: string) => list.some((m) => m.direction === "out" && m.status !== "failed" && m.sent_at > at);
    const s = st.get(key);
    const doneSince = (at: string) => !!s?.done_at && s.done_at >= at;
    // Marked unread, and nobody's answered, marked it read or tapped Done since
    const marked = !!s?.unread_at && !doneSince(s.unread_at) && !answeredAfter(s.unread_at) && !(s.read_at && s.read_at >= s.unread_at);
    const waiting = !!lastIn && !lastIn.ignore && !answeredAfter(lastIn.sent_at) && !doneSince(lastIn.sent_at);
    // The newest message that counts: one of ours that didn't send isn't the last word
    const lastWord = list.find((m) => m.direction === "in" || m.status !== "failed");
    out.push({
      key, last, count: list.length,
      done: !marked && !!s?.done_at && (!lastIn || doneSince(lastIn.sent_at)),
      needsReply: marked || waiting,
      unread: marked || (waiting && !(s?.read_at && s.read_at >= lastIn!.sent_at)),
      waitingOnThem: !marked && !waiting && lastWord?.direction === "out",
    });
  }
  return out.sort((a, b) => b.last.sent_at.localeCompare(a.last.sent_at));
}

const CHANNEL: Record<string, string> = { sms: "Text", email: "Email", call: "Call", note: "Note", facebook: "Facebook", instagram: "Instagram", gmb: "Google", webchat: "Chat", other: "Message" };
export const channelName = (c: string) => CHANNEL[c] ?? "Message";

/** The line under a conversation's name: "You: See you Tuesday" / "Email: Your proposal" / "Automatic: Reminder…" /
 *  "Call from Mike" (a call they made, by the first name of `name`; just "Call" for a phone number). */
export function preview(c: Pick<Conversation, "last"> & { name?: string }) {
  const m = c.last;
  const caller = m.channel === "call" && m.direction === "in" ? firstName(c.name) : "";
  const call = caller ? `Call from ${caller}${m.body ? `: ${m.body}` : ""}` : (m.body || "Call");
  const what = m.channel === "email" ? (m.subject || m.body) : m.channel === "call" ? call : m.body;
  const lead = m.direction === "out" ? (m.automatic ? "Automatic: " : "You: ") : m.channel === "email" ? "Email: " : "";
  return (lead + (what || channelName(m.channel))).replace(/\s+/g, " ").trim().slice(0, 120);
}

/** "Mike" from "Mike Neely"; nothing for a phone number or a blank. */
export function firstName(name?: string | null) {
  const w = (name ?? "").trim().split(/\s+/)[0] ?? "";
  return /^\p{L}/u.test(w) ? w : "";
}

/** When, as Messages shows it in the list: a time today, a weekday this week, else the date. */
export function whenShort(at: string, now = new Date()) {
  const d = new Date(at);
  if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  if (now.getTime() - d.getTime() < 6 * 864e5) return d.toLocaleDateString("en-US", { weekday: "short" });
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** The line between days in a conversation: Today, Yesterday, else "Fri, Oct 30" (with the year if it isn't this one). */
export function dayName(at: string, now = new Date()) {
  const d = new Date(at);
  if (d.toDateString() === now.toDateString()) return "Today";
  if (d.toDateString() === new Date(now.getTime() - 864e5).toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: d.getFullYear() === now.getFullYear() ? undefined : "numeric" });
}

export const clock = (at: string) => new Date(at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

/** Letters for the round picture: "Leah Helms" → "LH", "Bob & Sue Ray" → "BR", "the Smith family" → "SM". */
export function initials(name: string) {
  const words = name.replace(/^the\s+/i, "").replace(/\s+family$/i, "").replace(/&|\band\b/gi, " ").split(/\s+/).filter((w) => /^[a-z0-9]/i.test(w));
  if (!words.length) return "?";
  return (words.length === 1 ? words[0].slice(0, 2) : words[0][0] + words[words.length - 1][0]).toUpperCase();
}
