// Reactions (v1.8.0; David, Nov 8, 2026): when someone "likes" a text, their phone sends it as a text of its own:
// an Android phone as `👍 to "Hi Amanda! There is…"`, an iPhone as `Liked "Hi Amanda!…"` or `Reacted 😂 to "…"`.
// The conversation shows it the way a phone does instead: the emoji on the corner of the text they reacted to, and no
// separate bubble. One whose quoted text can't be found (an older text, or one sent from somewhere else) stays a
// plain bubble, so nothing is ever hidden.

/** iPhone's words for its six reactions. */
const WORDS: [RegExp, string][] = [
  [/^liked$/i, "👍"], [/^loved$/i, "❤️"], [/^disliked$/i, "👎"], [/^laughed at$/i, "😂"],
  [/^emphasi[sz]ed$/i, "‼️"], [/^questioned$/i, "❓"],
];
const REMOVED: [RegExp, string][] = [
  [/^a like$/i, "👍"], [/^a heart$/i, "❤️"], [/^a dislike$/i, "👎"], [/^a laugh$/i, "😂"],
  [/^an exclamation$/i, "‼️"], [/^a question mark$/i, "❓"],
];
// One emoji (with skin tones, joiners and the like) and nothing else
const EMOJI = /^(?:\p{Extended_Pictographic}|\p{Regional_Indicator}|[‍️⃣]|\p{Emoji_Modifier})+$/u;
const QUOTE = `["“”„«»']`;

export interface Reaction { emoji: string; quote: string; removed: boolean }

/** What a reaction text says, or null when it's an ordinary text. */
export function parseReaction(body: string): Reaction | null {
  const t = body.trim();
  // The closing quote is optional: a phone that shortens the text may leave it off after the "…"
  const m = t.match(new RegExp(`^(.{1,40}?)\\s+(?:to|from)?\\s*${QUOTE}([\\s\\S]+?)${QUOTE}?$`, "u"));
  if (!m) return null;
  let head = m[1].trim();
  const quote = m[2];
  // "Removed a like from …" / "Removed 👍 from …"
  const removed = /^removed\s+/i.test(head);
  if (removed) head = head.replace(/^removed\s+/i, "").replace(/\s+from$/i, "");
  head = head.replace(/^reacted\s+/i, "").replace(/\s+to$/i, "");
  if (EMOJI.test(head)) return { emoji: head, quote, removed };
  for (const [w, e] of removed ? REMOVED : WORDS) if (w.test(head)) return { emoji: e, quote, removed };
  return null;
}

/** Letters and digits only: a phone's copy drops line breaks, curls quotes, swaps dashes and shortens with "…", so
 *  only the words are compared (v1.8.1). */
const plain = (s: string) => s.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");

/** Which earlier message a quote is from: the newest whose words start with it (or, failing that, hold it). */
export function findQuoted<T extends { body: string }>(quote: string, earlier: T[]): T | null {
  const q = plain(quote);
  if (q.length < 2) return null;
  // A quote shortened mid-word ("so kids h…") still starts the text; one that's the whole text matches too
  for (let n = earlier.length - 1; n >= 0; n--) if (plain(earlier[n].body).startsWith(q)) return earlier[n];
  for (let n = earlier.length - 1; n >= 0; n--) if (plain(earlier[n].body).includes(q)) return earlier[n];
  return null;
}

export interface Tapback { emoji: string; side: "us" | "them"; who?: string; at: string }

/**
 * Moves each reaction onto the message it's about. Returns the messages left to show, and the reactions on each
 * (by key). A reaction someone later took back is dropped; one that matches nothing stays as it was.
 */
export function foldReactions<T extends { kind: string; key: string; at: string; body?: string; side?: "us" | "them"; from?: string }>(items: T[]) {
  const on = new Map<string, Tapback[]>();
  const keep: T[] = [];
  const messages: (T & { body: string })[] = [];
  for (const i of items) {
    const r = i.kind === "message" && i.body ? parseReaction(i.body) : null;
    const target = r ? findQuoted(r.quote, messages) : null;
    if (!r || !target) { keep.push(i); if (i.kind === "message" && typeof i.body === "string") messages.push(i as T & { body: string }); continue; }
    const list = (on.get(target.key) ?? []).filter((t) => !(t.side === i.side && t.who === i.from && (r.removed ? t.emoji === r.emoji : true)));
    if (!r.removed) list.push({ emoji: r.emoji, side: i.side ?? "them", who: i.from, at: i.at });
    on.set(target.key, list);
  }
  return { items: keep, reactions: on };
}

const THUMBS = /^👍(?:[\u{1F3FB}-\u{1F3FF}])?\ufe0f?$/u;
/**
 * A thumbs-up means "got it" (David, Nov 8, 2026): a reaction 👍 (any skin tone, or iPhone's "Liked") or a text that's
 * only 👍. It doesn't put a conversation back on Needs reply or make it unread (v1.8.1). Any other reaction (❓, ❤️…)
 * still does, since it may need an answer.
 */
export function isAcknowledgement(body: string | null | undefined) {
  const t = String(body ?? "").trim();
  if (!t) return false;
  if ([...t.matchAll(/👍/gu)].length && /^(?:👍[\u{1F3FB}-\u{1F3FF}]?\ufe0f?\s*)+$/u.test(t)) return true;
  const r = parseReaction(t);
  return !!r && !r.removed && THUMBS.test(r.emoji);
}
