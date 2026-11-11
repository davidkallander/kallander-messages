import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent, type ReactNode } from "react";
import { dayName } from "./rules";
import { useLook } from "./look";
import { markMentions } from "./mentions";
import { foldReactions, type Tapback } from "./reactions";

// A conversation, like Messages (David, Oct 31, 2026): oldest at the top, theirs on the left in grey and ours on the
// right in the app's color, a line for each day, calls and other events in the middle, private notes in their own color.
// It opens at the newest, at the bottom.

export type ThreadItem =
  | {
    kind: "message"; key: string; at: string; side: "us" | "them"; subject?: string; body: string;
    /** The small line under the bubble: "Email · Ann · 3:04 PM". */
    meta?: ReactNode;
    /** Didn't send: true, or why. */
    failed?: boolean | string;
    sending?: boolean;
    /** Pictures and files sent with it, shown in the bubble under the words (v1.6.0). */
    attachments?: ReactNode;
    /** Who sent it, by first name: "Amanda liked this" on a reaction (v1.8.0). */
    from?: string;
    /** Clicking the bubble opens it: an email, in <EmailWindow> as the customer saw it (v1.9.0). */
    onOpen?: () => void;
  }
  | { kind: "note"; key: string; at: string; head?: ReactNode; body: string }
  | { kind: "event"; key: string; at: string; text: ReactNode };

export function Thread({ items: all, empty, long = 280, className, mentions, reactions = true }: {
  items: ThreadItem[];
  /** What it says when there's nothing yet. */
  empty?: ReactNode;
  /** Messages and notes longer than two lines fold to two, with Show all and Show less (David, Nov 3, 2026). 0 never folds. */
  long?: number;
  className?: string;
  /** Teammates' first names: an @mention of one in a note is highlighted (v1.7.0). */
  mentions?: string[];
  /** A "👍 to …" or "Liked …" text shows as the emoji on the text it's about, as on a phone (v1.8.0). false: as texts. */
  reactions?: boolean;
}) {
  const { items, reactions: tapbacks } = useMemo(() => (reactions ? foldReactions(all) : { items: all, reactions: new Map<string, Tapback[]>() }), [all, reactions]);
  const box = useRef<HTMLDivElement>(null);
  // Opens at the newest, once the layout has its height (a phone sizes it a moment later)
  useEffect(() => {
    const down = () => { const b = box.current; if (b) b.scrollTop = b.scrollHeight; };
    down(); const f = requestAnimationFrame(down); const t = setTimeout(down, 250);
    return () => { cancelAnimationFrame(f); clearTimeout(t); };
  }, [items.length]);
  // And it stays at the newest as its size changes, unless someone has scrolled up to read: a folded conversation
  // opened (David, Nov 7, 2026; hidden, it has no height and can't scroll), the window resized, the page fitting it in
  useEffect(() => {
    const b = box.current;
    if (!b || typeof ResizeObserver === "undefined") return;
    let stick = true;
    const onScroll = () => { if (b.clientHeight) stick = b.scrollHeight - b.clientHeight - b.scrollTop < 24; };
    const down = () => { if (stick && b.clientHeight) b.scrollTop = b.scrollHeight; };
    // Its own size, what's in it (long messages folding, Show all appearing) and pictures loading all change the height
    const ro = new ResizeObserver(down);
    ro.observe(b);
    const mo = typeof MutationObserver === "undefined" ? null : new MutationObserver(down);
    mo?.observe(b, { childList: true, subtree: true, characterData: true });
    b.addEventListener("scroll", onScroll, { passive: true });
    b.addEventListener("load", down, true);
    return () => { ro.disconnect(); mo?.disconnect(); b.removeEventListener("scroll", onScroll); b.removeEventListener("load", down, true); };
  }, []);
  return (
    <div className={`km-thread${className ? ` ${className}` : ""}`} ref={box} aria-label="Conversation">
      {!items.length && <p className="km-thread-empty">{empty ?? "Nothing yet."}</p>}
      {items.map((i, n) => (
        <Fragment key={i.key}>
          {(n === 0 || dayName(items[n - 1].at) !== dayName(i.at)) && <div className="km-day">{dayName(i.at)}</div>}
          {i.kind === "event" ? <div className="km-ev">{i.text}</div>
            : i.kind === "note" ? <div className="km-note">{i.head && <small>{i.head}</small>}<Folded text={i.body} fold={long > 0} mentions={mentions} /></div>
            : <Bubble i={i} long={long} tapbacks={tapbacks.get(i.key)} />}
        </Fragment>
      ))}
    </div>
  );
}

/** Words that fold to two lines when there are more (measured, so it fits the bubble's width), with Show all and back. */
function Folded({ text, fold, mentions }: { text: string; fold: boolean; mentions?: string[] }) {
  const look = useLook();
  const box = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [long, setLong] = useState(false);
  useLayoutEffect(() => {
    const el = box.current;
    if (!fold || !el || open) return;
    const check = () => setLong(el.scrollHeight > el.clientHeight + 1);
    check();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(check) : null;
    ro?.observe(el);
    return () => ro?.disconnect();
  }, [text, fold, open]);
  if (!text) return <div className="km-pre"><span className="km-faint">(nothing in it)</span></div>;
  return (
    <>
      <div ref={box} className={`km-pre${fold && !open ? " km-fold" : ""}`}>{mentions?.length ? markMentions(text, mentions) : text}</div>
      {fold && (long || open) && <button type="button" className={`${look.link} km-more`} onClick={() => setOpen(!open)}>{open ? "Show less" : "Show all"}</button>}
    </>
  );
}

const VERB: Record<string, string> = { "👍": "liked", "❤️": "loved", "👎": "disliked", "😂": "laughed at", "‼️": "emphasized", "❓": "questioned" };
const said = (t: Tapback) => `${t.who ?? (t.side === "us" ? "You" : "They")} ${VERB[t.emoji] ?? `reacted ${t.emoji} to`} this · ${new Date(t.at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}`;

function Bubble({ i, long, tapbacks }: { i: Extract<ThreadItem, { kind: "message" }>; long: number; tapbacks?: Tapback[] }) {
  // An email opens like one in Mail: click (or Enter on) the bubble. A button inside it (Show all) still does its own thing.
  const open = i.onOpen;
  const opens = open ? {
    role: "button", tabIndex: 0, title: "Open the email as they saw it", "aria-label": `Open the email${i.subject ? ` “${i.subject}”` : ""}`,
    onClick: (e: MouseEvent) => { if (!(e.target as HTMLElement).closest("button, a") && !getSelection()?.toString()) open(); },
    onKeyDown: (e: KeyboardEvent) => { if ((e.key === "Enter" || e.key === " ") && e.target === e.currentTarget) { e.preventDefault(); open(); } },
  } : {};
  return (
    <div className={`km-msg ${i.side}${i.failed ? " failed" : ""}${tapbacks?.length ? " km-has-tap" : ""}`}>
      <div className={`km-b${open ? " km-opens" : ""}`} {...opens}>
        {tapbacks?.length ? (
          // Like a phone: the reaction on the bubble's top corner, on the side away from the person who sent it. Inside
          // the bubble, not the message, whose width is the line under it when that's wider (v1.8.3)
          <span className="km-tap" role="img" aria-label={tapbacks.map(said).join("; ")} title={tapbacks.map(said).join("\n")}>
            {tapbacks.map((t, n) => <span key={n} className={`km-tap-one ${t.side}`}>{t.emoji}</span>)}
          </span>
        ) : null}
        {i.subject && <b className="km-subject">{i.subject}</b>}
        {(i.body || !i.attachments) && <Folded text={i.body} fold={long > 0} />}
        {i.attachments && <div className="km-attach">{i.attachments}</div>}
      </div>
      {i.meta && <div className="km-meta">{i.meta}</div>}
      {i.failed && <div className="km-failed">Didn't send{typeof i.failed === "string" && i.failed ? `: ${i.failed}` : ""}</div>}
      {i.sending && <div className="km-meta">Sending…</div>}
    </div>
  );
}
