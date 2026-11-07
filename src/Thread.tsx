import { Fragment, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { dayName } from "./rules";
import { useLook } from "./look";

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
  }
  | { kind: "note"; key: string; at: string; head?: ReactNode; body: string }
  | { kind: "event"; key: string; at: string; text: ReactNode };

export function Thread({ items, empty, long = 280, className }: {
  items: ThreadItem[];
  /** What it says when there's nothing yet. */
  empty?: ReactNode;
  /** Messages and notes longer than two lines fold to two, with Show all and Show less (David, Nov 3, 2026). 0 never folds. */
  long?: number;
  className?: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  // Opens at the newest, once the layout has its height (a phone sizes it a moment later)
  useEffect(() => {
    const down = () => { const b = box.current; if (b) b.scrollTop = b.scrollHeight; };
    down(); const f = requestAnimationFrame(down); const t = setTimeout(down, 250);
    return () => { cancelAnimationFrame(f); clearTimeout(t); };
  }, [items.length]);
  return (
    <div className={`km-thread${className ? ` ${className}` : ""}`} ref={box} aria-label="Conversation">
      {!items.length && <p className="km-thread-empty">{empty ?? "Nothing yet."}</p>}
      {items.map((i, n) => (
        <Fragment key={i.key}>
          {(n === 0 || dayName(items[n - 1].at) !== dayName(i.at)) && <div className="km-day">{dayName(i.at)}</div>}
          {i.kind === "event" ? <div className="km-ev">{i.text}</div>
            : i.kind === "note" ? <div className="km-note">{i.head && <small>{i.head}</small>}<Folded text={i.body} fold={long > 0} /></div>
            : <Bubble i={i} long={long} />}
        </Fragment>
      ))}
    </div>
  );
}

/** Words that fold to two lines when there are more (measured, so it fits the bubble's width), with Show all and back. */
function Folded({ text, fold }: { text: string; fold: boolean }) {
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
      <div ref={box} className={`km-pre${fold && !open ? " km-fold" : ""}`}>{text}</div>
      {fold && (long || open) && <button type="button" className={`${look.link} km-more`} onClick={() => setOpen(!open)}>{open ? "Show less" : "Show all"}</button>}
    </>
  );
}

function Bubble({ i, long }: { i: Extract<ThreadItem, { kind: "message" }>; long: number }) {
  return (
    <div className={`km-msg ${i.side}${i.failed ? " failed" : ""}`}>
      <div className="km-b">
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
