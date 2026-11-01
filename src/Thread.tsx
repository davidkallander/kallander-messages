import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
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
  }
  | { kind: "note"; key: string; at: string; head?: ReactNode; body: string }
  | { kind: "event"; key: string; at: string; text: ReactNode };

export function Thread({ items, empty, long = 280, className }: {
  items: ThreadItem[];
  /** What it says when there's nothing yet. */
  empty?: ReactNode;
  /** Longer messages fold to this many letters, with Show all. 0 never folds. */
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
            : i.kind === "note" ? <div className="km-note">{i.head && <small>{i.head}</small>}<div className="km-pre">{i.body}</div></div>
            : <Bubble i={i} long={long} />}
        </Fragment>
      ))}
    </div>
  );
}

function Bubble({ i, long }: { i: Extract<ThreadItem, { kind: "message" }>; long: number }) {
  const look = useLook();
  const [more, setMore] = useState(false);
  const fold = long > 0 && i.body.length > long && !more;
  return (
    <div className={`km-msg ${i.side}${i.failed ? " failed" : ""}`}>
      <div className="km-b">
        {i.subject && <b className="km-subject">{i.subject}</b>}
        <div className="km-pre">{fold ? `${i.body.slice(0, long - 20).trim()}…` : i.body || <span className="km-faint">(nothing in it)</span>}</div>
        {fold && <button type="button" className={look.link} onClick={() => setMore(true)}>Show all</button>}
      </div>
      {i.meta && <div className="km-meta">{i.meta}</div>}
      {i.failed && <div className="km-failed">Didn't send{typeof i.failed === "string" && i.failed ? `: ${i.failed}` : ""}</div>}
      {i.sending && <div className="km-meta">Sending…</div>}
    </div>
  );
}
