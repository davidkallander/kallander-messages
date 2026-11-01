import { useEffect, useRef, useState, type ReactNode } from "react";
import { useLook } from "./look";

// The reply box (David, Oct 31, 2026): how (Text, Email, a private Note…), who (when there's more than one person to
// write to), the subject for an email, and the words. ⌘ Enter sends. An email can open in a larger window, like Mail's.

export interface ChannelOption {
  key: string;
  label: string;
  /** Needs a subject (email). */
  subject?: boolean;
  /** Why it can't send right now ("Texting starts in December"): shown under the box, and Send stays off. */
  off?: string;
  /** What the empty box says. Defaults to the label and who it's to: "Text Ann". */
  placeholder?: string;
  /** Lines tall. */
  rows?: number;
  /** Doesn't go to anyone (a private note): no To. */
  private?: boolean;
}

export interface Person {
  id: string;
  name: string;
  /** Why this way can't reach them ("no mobile number"): shown, and they can't be picked. */
  why?: string;
  /** Their full name, for the tip. */
  title?: string;
}

export type SendResult = null | undefined | string | { problem: string; sent: boolean };

export interface ComposerProps {
  channels: ChannelOption[];
  /** The way it starts on. If it changes before anyone picks, the box follows (texting connected after it loaded). */
  channel?: string;
  /** Who each way can write to. Leave it out when there's only ever one person (the conversation's). */
  people?: (channel: string) => Person[];
  /** Who's picked to begin with, for a way. */
  defaultTo?: (channel: string) => string[];
  /** Start a message from elsewhere (a Text button on the card): bump n to start another. */
  request?: { channel: string; to?: string[]; n: number } | null;
  /** The subject it starts with (Re: their last one). */
  subject?: string;
  /** Sends it. Returns nothing when it went, else what went wrong (and whether some of it went). */
  send: (p: { channel: string; to: string[]; subject: string; body: string }) => Promise<SendResult>;
  onSent?: (channel: string) => void;
  /** Email can open in a larger window. */
  bigWindow?: boolean;
  /** The app's own sheet for the larger window; a plain one otherwise. */
  renderWindow?: (p: { title: string; onClose: () => void; children: ReactNode }) => ReactNode;
}

export function Composer(p: ComposerProps) {
  const look = useLook();
  const touched = useRef(false);
  const first = p.channels.find((c) => c.key === p.channel) ?? p.channels[0];
  const [channel, setChannel] = useState(first.key);
  const [to, setTo] = useState<string[]>(() => p.defaultTo?.(first.key) ?? []);
  const [subject, setSubject] = useState(p.subject ?? "");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState("");
  const [big, setBig] = useState(false);
  const text = useRef<HTMLTextAreaElement>(null);
  const ch = p.channels.find((c) => c.key === channel) ?? first;
  const pick = (k: string, who?: string[]) => { setChannel(k); setTo(who?.length ? who : p.defaultTo?.(k) ?? []); setProblem(""); };

  // Until someone picks, the box follows the app's choice of way (and who, as the conversation changes)
  useEffect(() => { if (!touched.current && p.channel && p.channel !== channel) pick(p.channel); }, [p.channel]);
  const dflt = (p.defaultTo?.(channel) ?? []).join(" ");
  useEffect(() => { if (!touched.current) setTo(dflt ? dflt.split(" ") : []); }, [dflt]);
  useEffect(() => { if (!touched.current && p.subject !== undefined) setSubject(p.subject); }, [p.subject]);
  useEffect(() => {
    if (!p.request) return;
    touched.current = true;
    pick(p.request.channel, p.request.to);
    text.current?.focus();
  }, [p.request?.n]);

  const people = ch.private ? [] : p.people?.(channel) ?? [];
  const picked = to.filter((id) => people.some((x) => x.id === id && !x.why));
  const names = picked.map((id) => people.find((x) => x.id === id)!.name);
  const place = ch.placeholder ?? `${ch.label}${names.length ? ` ${names.join(" and ")}` : people.length ? " …" : ""}`;
  const disabled = busy || !body.trim() || !!ch.off || (!!ch.subject && !subject.trim()) || (people.length > 0 && !picked.length);

  const send = async () => {
    if (disabled) return false;
    setBusy(true); setProblem("");
    let ok = false;
    try {
      const out = await p.send({ channel, to: picked, subject: ch.subject ? subject.trim() : "", body: body.trim() });
      const why = typeof out === "string" ? out : out?.problem ?? "";
      const sent = !out || (typeof out === "object" && out.sent);
      if (why) setProblem(why);
      if (sent) { setBody(""); if (ch.subject) setSubject(p.subject ?? ""); p.onSent?.(channel); }
      ok = sent && !why;
    } catch (e) { setProblem((e as Error).message || "That didn't send. Try again."); }
    setBusy(false);
    return ok;
  };
  const go = () => void send().then((ok) => ok && setBig(false));

  const top = (
    <div className={`km-compose-row${people.length ? " has-to" : ""}`}>
      {people.length > 0 && (
        <span className="km-to"><span className="km-faint">To</span>
          {people.map((x) => {
            const on = to.includes(x.id) && !x.why;
            return <button key={x.id} type="button" className={`km-chip${on ? " on" : ""}`} disabled={!!x.why} title={x.why ? `${x.title ?? x.name}: ${x.why}` : x.title}
              aria-pressed={on} onClick={() => { touched.current = true; setTo(on ? to.filter((y) => y !== x.id) : [...to, x.id]); }}>{x.name}{x.why && <small> · {x.why}</small>}</button>;
          })}
        </span>
      )}
      {!big && p.channels.length > 1 && (
        <span className={`${look.segment} km-how`} role="group" aria-label="Send as">
          {p.channels.map((c) => <button key={c.key} type="button" className={channel === c.key ? "on" : ""} aria-pressed={channel === c.key} onClick={() => { touched.current = true; pick(c.key); }}>{c.label}</button>)}
        </span>
      )}
      {p.bigWindow && ch.subject && !big && <button type="button" className="km-expand" onClick={() => setBig(true)} aria-label="Write in a larger window" title="Write in a larger window">⤢</button>}
    </div>
  );
  const fields = (
    <>
      {ch.subject && <input className="km-subj" aria-label="Subject" placeholder="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} />}
      <div className={`km-write${(ch.rows ?? 2) > 2 ? " tall" : ""}${big ? " big" : ""}`}>
        <textarea ref={big ? undefined : text} rows={big ? 16 : ch.rows ?? 2} value={body} placeholder={place} aria-label={place} onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); go(); } }} />
        <button type="button" className="km-send" disabled={disabled} onClick={go} aria-label={ch.private ? `Add ${ch.label.toLowerCase()}` : "Send"} title={`${ch.private ? `Add ${ch.label.toLowerCase()}` : "Send"} (⌘ Enter)`}>
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
      </div>
      {(ch.off || problem) && <p className={`km-compose-note${problem ? " km-err" : ""}`} role={problem ? "alert" : undefined}>{problem || ch.off}</p>}
    </>
  );
  const title = `${ch.label}${names.length ? ` ${names.join(" and ")}` : ""}`;

  return (
    <div className="km-compose">
      {big ? (
        <>
          <p className="km-compose-note">Writing in the larger window. <button type="button" className={look.link} onClick={() => setBig(false)}>Bring it back here</button></p>
          {p.renderWindow
            ? p.renderWindow({ title, onClose: () => setBig(false), children: <div className="km-window-body">{top}{fields}</div> })
            : <PlainWindow title={title} onClose={() => setBig(false)}><div className="km-window-body">{top}{fields}</div></PlainWindow>}
        </>
      ) : <>{top}{fields}</>}
    </div>
  );
}

/** The larger window when the app has no sheet of its own. */
function PlainWindow({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const look = useLook();
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [onClose]);
  return (
    <div className="km-window-back" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="km-window" role="dialog" aria-modal="true" aria-label={title}>
        <div className="km-window-head"><b>{title}</b><button type="button" className={look.button} onClick={onClose}>Close</button></div>
        {children}
      </div>
    </div>
  );
}
