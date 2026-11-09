import type { ReactNode } from "react";

// @mentions (v1.7.0; David, Nov 8, 2026: "it would be tough to be confident without some functionality that highlighted
// the name once it was mentioned"). The app says who can be mentioned (teammates' first names); the package finds
// "@Name" in what's written, highlights it in the reply box as it's typed and in the note once it's saved, and the box
// says who'll be told. Sending the notification is the app's (Legacy does it in its database).

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Where each @mention is in the text, and whose: only names on the list, as a whole word, any capitals. */
export function findMentions(text: string, names: string[]): { start: number; end: number; name: string }[] {
  const list = names.map((n) => n.trim()).filter(Boolean);
  if (!list.length || !text.includes("@")) return [];
  const re = new RegExp(`(^|[^\\p{L}\\p{N}_])@(${list.map(escape).join("|")})(?![\\p{L}\\p{N}])`, "giu");
  const out: { start: number; end: number; name: string }[] = [];
  for (const m of text.matchAll(re)) {
    const start = (m.index ?? 0) + m[1].length;
    const said = m[2].toLowerCase();
    out.push({ start, end: start + 1 + m[2].length, name: list.find((n) => n.toLowerCase() === said) ?? m[2] });
  }
  return out;
}

/** The names a text mentions, each once, in the order they first appear. */
export const mentionedNames = (text: string, names: string[]) => [...new Set(findMentions(text, names).map((m) => m.name))];

/** The text with each @mention wrapped in <mark className="km-mention">. */
export function markMentions(text: string, names: string[]): ReactNode[] {
  const found = findMentions(text, names);
  if (!found.length) return [text];
  const out: ReactNode[] = [];
  let at = 0;
  found.forEach((m, i) => {
    if (m.start > at) out.push(text.slice(at, m.start));
    out.push(<mark key={i} className="km-mention">{text.slice(m.start, m.end)}</mark>);
    at = m.end;
  });
  if (at < text.length) out.push(text.slice(at));
  return out;
}
