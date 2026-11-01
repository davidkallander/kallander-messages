import { createElement, useEffect, useRef, useState, type ReactNode } from "react";
import { initials, preview, whenShort, type Conversation, type Message } from "./rules";
import { useLook } from "./look";

// Messages, like Messages on a Mac (David, Oct 31, 2026; first in Ranger Ops): every conversation, newest first, so
// nothing gets missed. Needs reply holds the ones where they wrote last until someone answers or marks them Done; a dot
// stays until someone answers, marks it read or taps Done. On a phone a conversation swipes like iPhone Messages (right:
// Read / Unread, left: Done / not done); on a computer, Read and Done show as small round buttons on the conversation
// under the pointer, and it right-clicks for the same menu. The keyboard works like Mail: ↑ and ↓ move between
// conversations, → goes to the reply box, ← or Esc comes back. On a phone, the list, then the conversation.

export type Mark = "read" | "unread" | "done" | "undone";

export interface InboxRow<M extends Message = Message> extends Conversation<M> {
  name: string;
  /** The round picture's letters; "?" for someone not matched. Defaults to the name's initials. */
  avatar?: string;
  /** Small tags after the name: "lead", "not matched". */
  tags?: { label: string; tone?: "warn" | "gold" }[];
  /** More words the search looks in (a phone number, an email address). */
  search?: string;
}

export interface InboxFilter<R> {
  key: string;
  label: string;
  test: (r: R) => boolean;
  /** Show how many as a badge (Needs reply). */
  badge?: boolean;
  /** What the list says when nothing's in it. */
  empty?: ReactNode;
}

export interface InboxProps<R extends InboxRow> {
  rows: R[];
  loaded: boolean;
  error?: string | null;
  /** The conversation open on the right (its key), if any. */
  selected?: string;
  /** A conversation's address, for its link. */
  href: (key: string) => string;
  /** Go to a conversation without adding to the browser's history (↑ and ↓). */
  open: (key: string) => void;
  filters: InboxFilter<R>[];
  filter: string;
  onFilter: (key: string) => void;
  title?: ReactNode;
  /** Beside the title: ✎ New, Refresh. */
  action?: ReactNode;
  /** Read / unread / Done / not done. Leave it out for people who can only look. */
  mark?: (r: R, what: Mark) => void;
  /** More right-click items after Read and Done (Open customer). */
  menu?: (r: R) => { label: string; run: () => void }[];
  /** → goes to the reply box (people who can reply). */
  canReply?: boolean;
  /** The right side: a PaneHead and the conversation. */
  pane: ReactNode;
  className?: string;
}

export function MessagesInbox<R extends InboxRow>(p: InboxProps<R>) {
  const look = useLook();
  const [q, setQ] = useState("");
  const t = q.trim().toLowerCase();
  const filter = p.filters.find((f) => f.key === p.filter) ?? p.filters[0];
  const list = p.rows.filter((r) => !filter || filter.test(r)).filter((r) => !t || `${r.name} ${r.search ?? ""}`.toLowerCase().includes(t));
  const [menu, setMenu] = useState<{ r: R; x: number; y: number } | null>(null);
  const page = useRef<HTMLDivElement>(null);

  // The keyboard, like Mail (David, Oct 31, 2026): ↑ and ↓ go to the conversation above or below; → goes to the reply
  // box, and ← (at the start of the box) or Esc comes back to the list.
  const keys = useRef({ list, selected: p.selected, canReply: !!p.canReply, menu, open: p.open });
  keys.current = { list, selected: p.selected, canReply: !!p.canReply, menu, open: p.open };
  const follow = useRef(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const { list, selected, canReply, menu, open } = keys.current;
      if (e.defaultPrevented || menu || e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
      if (document.querySelector("dialog[open], [aria-modal=true], .sheet-back, .alert-back")) return;
      const el = e.target as HTMLElement;
      const row = () => page.current?.querySelector<HTMLElement>(".km-row.on");
      if (el.closest?.(".km-write")) {
        const box = el as HTMLTextAreaElement;
        if (e.key === "Escape" || (e.key === "ArrowLeft" && box.selectionStart === 0 && box.selectionEnd === 0)) { e.preventDefault(); box.blur(); row()?.focus(); }
        return;
      }
      if (el.closest?.("input, textarea, select, [contenteditable=true]")) return;
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        if (!list.length) return;
        e.preventDefault();
        const at = list.findIndex((c) => c.key === selected);
        const next = at < 0 ? 0 : Math.min(list.length - 1, Math.max(0, at + (e.key === "ArrowDown" ? 1 : -1)));
        if (list[next].key === selected) return;
        follow.current = true;
        open(list[next].key);
      } else if (e.key === "ArrowRight" && selected && canReply) {
        // The box shows once the conversation has loaded: wait a moment for it.
        e.preventDefault();
        const until = Date.now() + 3000, at = selected;
        const go = () => {
          const box = page.current?.querySelector<HTMLTextAreaElement>(".km-write textarea");
          if (box) box.focus();
          else if (Date.now() < until && keys.current.selected === at) requestAnimationFrame(go);
        };
        go();
      } else if (e.key === "ArrowLeft" && selected) {
        e.preventDefault(); row()?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  // After ↑ or ↓, the list scrolls to the conversation and the keyboard stays on it.
  useEffect(() => {
    if (!follow.current) return;
    follow.current = false;
    const r = page.current?.querySelector<HTMLElement>(".km-row.on");
    r?.scrollIntoView({ block: "nearest" }); r?.focus({ preventScroll: true });
  }, [p.selected]);

  return (
    <div ref={page} className={`km-inbox${p.selected ? " picked" : ""}${p.className ? ` ${p.className}` : ""}`}>
      <section className="km-list" aria-label="Conversations">
        <div className="km-top">
          <h1>{p.title ?? "Messages"}</h1>
          {p.action}
        </div>
        <input className="km-search" type="search" placeholder="Search conversations" aria-label="Search conversations" value={q} onChange={(e) => setQ(e.target.value)} />
        {p.filters.length > 1 && (
          <div className={`${look.segment} km-filter`} role="group" aria-label="Show">
            {p.filters.map((f) => {
              const n = f.badge ? p.rows.filter(f.test).length : 0;
              return (
                <button key={f.key} type="button" className={f.key === filter?.key ? "on" : ""} aria-pressed={f.key === filter?.key} onClick={() => p.onFilter(f.key)}>
                  {f.label}{n > 0 && <b className="km-badge">{n}</b>}
                </button>
              );
            })}
          </div>
        )}
        {p.error && <p className="km-empty km-err">Couldn't load messages: {p.error}</p>}
        {!p.loaded && !p.error && <p className="km-empty">Loading…</p>}
        {p.loaded && !list.length && (
          <p className="km-empty">{t ? "No conversations match." : filter?.empty ?? "No messages yet."}</p>
        )}
        <ul className="km-rows">
          {list.map((r) => <Row key={r.key} r={r} on={r.key === p.selected} href={p.href(r.key)} mark={p.mark} onMenu={(x, y) => setMenu({ r, x, y })} />)}
        </ul>
        {menu && <RowMenu r={menu.r} x={menu.x} y={menu.y} mark={p.mark} more={p.menu} open={() => p.open(menu.r.key)} onClose={() => setMenu(null)} />}
      </section>
      <section className="km-pane" aria-label="Conversation">{p.pane}</section>
    </div>
  );
}

/** The top of the conversation: ‹ back (on a phone), the picture, the name and a line under it, and buttons. */
export function PaneHead({ back, backLabel = "Messages", avatar, name, sub, children }: {
  back: string; backLabel?: string; avatar?: string; name: ReactNode; sub?: ReactNode; children?: ReactNode;
}) {
  return (
    <div className="km-pane-head">
      <a className="km-back" href={back}>‹ {backLabel}</a>
      <span className="km-av" aria-hidden="true">{avatar ?? (typeof name === "string" ? initials(name) : "?")}</span>
      <span className="km-pane-name"><b>{name}</b>{sub && <small>{sub}</small>}</span>
      {children}
    </div>
  );
}

/** Mark read (once read it says ✓ Read, and clicking marks it unread) and Mark as Done (✓ Done takes it back). */
export function MarkButtons<R extends InboxRow>({ r, mark }: { r: R; mark: (r: R, what: Mark) => void }) {
  const look = useLook();
  return (
    <>
      <button type="button" className={`${look.button}${r.unread ? "" : " km-is-on"}`} aria-pressed={!r.unread}
        title={r.unread ? "Take the dot off (it stays on Needs reply until someone answers or marks it done)" : "Read. Click to mark it unread: the dot comes back, and it goes back on Needs reply, as a reminder"}
        onClick={() => mark(r, r.unread ? "read" : "unread")}>{r.unread ? "Mark read" : "✓ Read"}</button>
      <button type="button" className={`${look.button}${r.done ? " km-is-on" : ""}`} aria-pressed={r.done}
        title={r.done ? "Done: no reply needed. Click to mark it not done (back on Needs reply)" : "No reply needed: take it off Needs reply"}
        onClick={() => mark(r, r.done ? "undone" : "done")}>{r.done ? "✓ Done" : "Mark as Done"}</button>
    </>
  );
}

// The row's two actions as round icons (iPhone Messages' look): Read / Unread, and Done / not done.
const ReadIcon = ({ unread }: { unread: boolean }) => (
  <svg viewBox="0 0 24 24" aria-hidden="true">{unread
    ? <><path d="M4 5h16v11H9l-5 4z" /><path d="M8.5 10.5l2.2 2.2 4.8-4.8" /></>
    : <><path d="M4 7h11v9H9l-5 4z" /><circle cx="18.5" cy="6" r="3" className="fill" /></>}</svg>);
const DoneIcon = ({ done }: { done: boolean }) => (
  <svg viewBox="0 0 24 24" aria-hidden="true">{done
    ? <><path d="M4 7h16v3H4zM5.5 10v9h13v-9" /><path d="M12 17.5v-5M9.5 15l2.5-2.5 2.5 2.5" /></>
    : <path d="M4 7h16v3H4zM5.5 10v9h13v-9M10 13.5h4" />}</svg>);

/** A touch screen (a phone or tablet): the list swipes, as on an iPhone. */
const touchScreen = () => typeof matchMedia !== "undefined" && matchMedia("(pointer: coarse)").matches;

// Ionic's sliding item (David, Oct 31, 2026: "a proven copy of the iPhone swipe"), only on touch screens and loaded only
// then: speed-aware opening, springs, rubber-banding and the full swipe, in iOS's style.
let ionic: Promise<void> | null = null;
const loadIonic = () => (ionic ??= import("@ionic/core/components").then(({ initialize }) => initialize({ mode: "ios" })).then(() => Promise.all([
  import("@ionic/core/components/ion-item-sliding.js"), import("@ionic/core/components/ion-item.js"),
  import("@ionic/core/components/ion-item-options.js"), import("@ionic/core/components/ion-item-option.js"),
]).then((ms) => { ms.forEach((m) => m.defineCustomElement()); })));

type Sliding = HTMLElement & { close: () => Promise<void> };

function Row<R extends InboxRow>({ r, on, href, mark, onMenu }: { r: R; on: boolean; href: string; mark?: (r: R, what: Mark) => void; onMenu: (x: number, y: number) => void }) {
  const look = useLook();
  const [touch] = useState(touchScreen);
  const [ready, setReady] = useState(false);
  useEffect(() => { if (touch && mark) void loadIonic().then(() => setReady(true)); }, [touch, !!mark]);
  const sliding = useRef<Sliding>(null);
  const start = useRef<HTMLElement>(null), end = useRef<HTMLElement>(null);
  const read = () => mark?.(r, r.unread ? "read" : "unread");
  const done = () => mark?.(r, r.done ? "undone" : "done");
  // A full swipe (Ionic says so on the side's options) or a tap on the round button; listened for directly, since React
  // doesn't pass a click on Ionic's elements to onClick.
  useEffect(() => {
    if (!ready) return;
    const s = start.current, e = end.current;
    const onRead = () => { void sliding.current?.close(); read(); }, onDone = () => { void sliding.current?.close(); done(); };
    const sb = s?.querySelector("ion-item-option"), eb = e?.querySelector("ion-item-option");
    s?.addEventListener("ionSwipe", onRead); e?.addEventListener("ionSwipe", onDone);
    sb?.addEventListener("click", onRead); eb?.addEventListener("click", onDone);
    return () => {
      s?.removeEventListener("ionSwipe", onRead); e?.removeEventListener("ionSwipe", onDone);
      sb?.removeEventListener("click", onRead); eb?.removeEventListener("click", onDone);
    };
  });
  const row = (
    <a href={href} className={`km-row${on ? " on" : ""}`} aria-current={on ? "true" : undefined} draggable={false}
      onContextMenu={mark ? (e) => { e.preventDefault(); onMenu(e.clientX, e.clientY); } : undefined}>
      <span className={`km-dot${r.unread ? "" : " off"}`} aria-label={r.unread ? "Unread" : undefined} />
      <span className="km-av" aria-hidden="true">{r.avatar ?? initials(r.name)}</span>
      <span className="km-main">
        <span className="km-name"><span className="km-name-text">{r.name}</span>{r.tags?.map((g) => <span key={g.label} className={`${look.tag}${g.tone ? ` ${g.tone}` : ""}`}>{g.label}</span>)}</span>
        <span className="km-preview">{preview(r)}</span>
      </span>
      <span className="km-when">{whenShort(r.last.sent_at)}</span>
      {mark && !touch && <span className="km-hover">
        <button type="button" className="km-hb read" aria-label={r.unread ? "Mark read" : "Mark unread"} title={r.unread ? "Mark read" : "Mark unread"}
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); read(); }}><ReadIcon unread={r.unread} /></button>
        <button type="button" className="km-hb done" aria-label={r.done ? "Mark not done" : "Mark as done"} title={r.done ? "Mark not done (back on Needs reply)" : "Mark as done: no reply needed"}
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); done(); }}><DoneIcon done={r.done} /></button>
      </span>}
    </a>
  );
  if (!touch || !mark || !ready) return <li className="km-li">{row}</li>;
  // Ionic's web components, made with createElement so no app needs their JSX types
  return (
    <li className="km-li">
      {createElement("ion-item-sliding", { ref: sliding, class: "km-slide" },
        createElement("ion-item-options", { side: "start", ref: start },
          createElement("ion-item-option", { expandable: true, class: "km-opt read", "aria-label": r.unread ? "Mark read" : "Mark unread" }, <ReadIcon unread={r.unread} />)),
        createElement("ion-item", { lines: "none", mode: "ios", class: "km-ion" }, row),
        createElement("ion-item-options", { side: "end", ref: end },
          createElement("ion-item-option", { expandable: true, class: "km-opt done", "aria-label": r.done ? "Mark not done" : "Mark as done" }, <DoneIcon done={r.done} />)))}
    </li>
  );
}

/** Right-click on a conversation (a computer): its actions, like Mail's menu. */
function RowMenu<R extends InboxRow>({ r, x, y, mark, more, open, onClose }: {
  r: R; x: number; y: number; mark?: (r: R, what: Mark) => void; more?: (r: R) => { label: string; run: () => void }[]; open: () => void; onClose: () => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const away = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) onClose(); };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("mousedown", away); window.addEventListener("keydown", key);
    box.current?.querySelector("button")?.focus();
    return () => { document.removeEventListener("mousedown", away); window.removeEventListener("keydown", key); };
  }, []);
  const left = Math.min(x, window.innerWidth - 220), top = Math.min(y, window.innerHeight - 160);
  const item = (label: string, run: () => void) => <button key={label} type="button" role="menuitem" onClick={() => { onClose(); run(); }}>{label}</button>;
  return (
    <div className="km-menu" role="menu" aria-label={r.name} ref={box} style={{ left, top }}>
      {mark && item(r.unread ? "Mark as Read" : "Mark as Unread", () => mark(r, r.unread ? "read" : "unread"))}
      {mark && item(r.done ? "Mark as Not Done" : "Mark as Done", () => mark(r, r.done ? "undone" : "done"))}
      {item("Open", open)}
      {more?.(r).map((m) => item(m.label, m.run))}
    </div>
  );
}
