import { useEffect, useRef, useState, type ReactNode } from "react";
import { useLook } from "./look";
import { loadDraft, saveDraft } from "./drafts";

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

/** A saved reply (David, Nov 6, 2026): words kept by the app, put into the box at the cursor from the reply box's
 *  Saved replies menu, like GHL's snippets. */
export interface SavedReply {
  id: string;
  name: string;
  body: string;
}

export type SendResult = null | undefined | string | { problem: string; sent: boolean };

/** A picture or file put on a message from the reply box (v1.6.0): uploaded by the app, sent as the app decides. */
export interface Attachment { name: string; url: string; size: number; type?: string }

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
  send: (p: { channel: string; to: string[]; subject: string; body: string; files: Attachment[] }) => Promise<SendResult>;
  onSent?: (channel: string) => void;
  /** Email can open in a larger window. */
  bigWindow?: boolean;
  /** The app's own sheet for the larger window; a plain one otherwise. */
  renderWindow?: (p: { title: string; onClose: () => void; children: ReactNode }) => ReactNode;
  /** One line until it's clicked into, like Messages on a Mac, so the conversation gets the room (David, Nov 3, 2026).
   *  Who it's to, Text / Email / Note and the subject show once it's open; it folds back when left empty. On by default. */
  compact?: boolean;
  /** Saved replies to put in the box (a menu beside Text / Email / Note). Leave out to show none. */
  replies?: SavedReply[];
  /** Fills a reply in for who it's to (their first name…) before it goes in the box. */
  fill?: (body: string, p: { channel: string; to: string[] }) => string;
  /** Keeps what's written as a draft for this conversation (the same key as its row in the inbox), so it's still there
   *  after leaving the page or reloading. Leave out to keep no drafts. */
  draftKey?: string;
  /** Pictures and files (a 📎 beside the box): the app uploads each and says what's allowed. Leave out for none. */
  attach?: {
    upload: (file: File) => Promise<Attachment>;
    /** The file picker's types ("image/*,.pdf"). */
    accept?: string;
    /** What a way does with them, under the box ("Photos go as pictures"); a way with no note can't take files. */
    note?: (channel: string) => string | undefined;
  };
}

export function Composer(p: ComposerProps) {
  const look = useLook();
  const touched = useRef(false);
  const first = p.channels.find((c) => c.key === p.channel) ?? p.channels[0];
  // A draft left in this conversation picks up where it was (its way, who, subject and words)
  const kept = (() => { const d = loadDraft(p.draftKey); return d && p.channels.some((c) => c.key === d.channel) ? d : null; })();
  if (kept) touched.current = true;
  const [channel, setChannel] = useState(kept?.channel ?? first.key);
  const [to, setTo] = useState<string[]>(() => kept?.to ?? p.defaultTo?.(first.key) ?? []);
  const [subject, setSubject] = useState(kept?.subject ?? p.subject ?? "");
  const [body, setBodyState] = useState(kept?.body ?? "");
  const [files, setFilesState] = useState<Attachment[]>(kept?.files ?? []);
  const [uploading, setUploading] = useState(false);
  const picker = useRef<HTMLInputElement>(null);
  // Every change to the words, way, who or subject is kept as the draft
  const now = useRef({ channel: kept?.channel ?? first.key, to: kept?.to ?? [] as string[], subject: kept?.subject ?? p.subject ?? "", body: kept?.body ?? "", files: kept?.files ?? [] as Attachment[] });
  const keep = (patch: Partial<typeof now.current>) => {
    now.current = { ...now.current, ...patch };
    if (p.draftKey) saveDraft(p.draftKey, now.current.body.trim() || now.current.files.length ? now.current : null);
  };
  const setBody = (v: string) => { setBodyState(v); keep({ body: v }); };
  const setFiles = (v: Attachment[]) => { setFilesState(v); keep({ files: v }); };
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState("");
  const [big, setBig] = useState(false);
  const [open, setOpen] = useState(false);
  const text = useRef<HTMLTextAreaElement>(null);
  const area = useRef<HTMLTextAreaElement | null>(null);
  const [menu, setMenu] = useState(false);
  const menuBox = useRef<HTMLSpanElement>(null);
  // The menu closes on a click anywhere else (the box keeps the typing focus, so leaving it isn't a blur)
  useEffect(() => {
    if (!menu) return;
    const away = (e: MouseEvent) => { if (!menuBox.current?.contains(e.target as Node)) setMenu(false); };
    document.addEventListener("mousedown", away);
    return () => document.removeEventListener("mousedown", away);
  }, [menu]);
  const ch = p.channels.find((c) => c.key === channel) ?? first;
  const pick = (k: string, who?: string[]) => { const t = who?.length ? who : p.defaultTo?.(k) ?? []; setChannel(k); setTo(t); setProblem(""); now.current = { ...now.current, channel: k, to: t }; if (now.current.body.trim() || now.current.files.length) keep({}); };
  // Another conversation in the same box: its own draft, or an empty box
  const shownKey = useRef(p.draftKey);
  useEffect(() => {
    if (shownKey.current === p.draftKey) return;
    shownKey.current = p.draftKey;
    const d = loadDraft(p.draftKey);
    const k = d && p.channels.some((c) => c.key === d.channel) ? d : null;
    touched.current = !!k;
    const c = k?.channel ?? (p.channels.find((x) => x.key === p.channel) ?? p.channels[0]).key;
    const t = k?.to ?? p.defaultTo?.(c) ?? [];
    now.current = { channel: c, to: t, subject: k?.subject ?? p.subject ?? "", body: k?.body ?? "", files: k?.files ?? [] };
    setChannel(c); setTo(t); setSubject(now.current.subject); setBodyState(now.current.body); setFilesState(now.current.files); setProblem("");
  }, [p.draftKey]);

  // Until someone picks, the box follows the app's choice of way (and who, as the conversation changes)
  useEffect(() => { if (!touched.current && p.channel && p.channel !== channel) pick(p.channel); }, [p.channel]);
  const dflt = (p.defaultTo?.(channel) ?? []).join(" ");
  useEffect(() => { if (!touched.current) { setTo(dflt ? dflt.split(" ") : []); now.current.to = dflt ? dflt.split(" ") : []; } }, [dflt]);
  useEffect(() => { if (!touched.current && p.subject !== undefined) { setSubject(p.subject); now.current.subject = p.subject; } }, [p.subject]);
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
  const canAttach = !!p.attach && !!p.attach.note?.(channel);
  const sending = canAttach ? files : [];
  const disabled = busy || uploading || (!body.trim() && !sending.length) || !!ch.off || (!!ch.subject && !subject.trim()) || (people.length > 0 && !picked.length);
  const addFiles = async (list: FileList | null) => {
    if (!list?.length || !p.attach) return;
    setUploading(true); setProblem("");
    const added: Attachment[] = [];
    try { for (const f of Array.from(list)) added.push(await p.attach.upload(f)); }
    catch (e) { setProblem((e as Error).message || "That file didn't upload."); }
    if (added.length) setFiles([...now.current.files, ...added]);
    setUploading(false);
    if (picker.current) picker.current.value = "";
    setOpen(true);
  };

  const send = async () => {
    if (disabled) return false;
    setBusy(true); setProblem("");
    let ok = false;
    try {
      const out = await p.send({ channel, to: picked, subject: ch.subject ? subject.trim() : "", body: body.trim(), files: sending });
      const why = typeof out === "string" ? out : out?.problem ?? "";
      const sent = !out || (typeof out === "object" && out.sent);
      if (why) setProblem(why);
      if (sent) { setBodyState(""); setFilesState([]); if (ch.subject) setSubject(p.subject ?? ""); now.current = { ...now.current, body: "", subject: p.subject ?? "", files: [] }; saveDraft(p.draftKey, null); p.onSent?.(channel); }
      ok = sent && !why;
    } catch (e) { setProblem((e as Error).message || "That didn't send. Try again."); }
    setBusy(false);
    return ok;
  };
  const go = () => void send().then((ok) => ok && setBig(false));
  // A saved reply goes in where the cursor is (in place of anything selected), and the cursor ends up after it
  const putReply = (r: SavedReply) => {
    setMenu(false);
    const words = p.fill ? p.fill(r.body, { channel, to: picked }) : r.body;
    const el = area.current;
    const out = insertAt(body, el ? el.selectionStart : body.length, el ? el.selectionEnd : body.length, words);
    setBody(out.text);
    requestAnimationFrame(() => { const t = area.current; if (t) { t.focus(); t.setSelectionRange(out.caret, out.caret); } });
  };
  const replies = !ch.private && p.replies?.length ? p.replies : [];
  // One line until it's clicked into (and while nothing's written)
  const small = (p.compact ?? true) && !open && !big && !body.trim() && !files.length;

  const top = (
    <div className={`km-compose-row${people.length ? " has-to" : ""}`}>
      {people.length > 0 && (
        <span className="km-to"><span className="km-faint">To</span>
          {people.map((x) => {
            const on = to.includes(x.id) && !x.why;
            return <button key={x.id} type="button" className={`km-chip${on ? " on" : ""}`} disabled={!!x.why} title={x.why ? `${x.title ?? x.name}: ${x.why}` : x.title}
              aria-pressed={on} onClick={() => { touched.current = true; const t = on ? to.filter((y) => y !== x.id) : [...to, x.id]; setTo(t); keep({ to: t }); }}>{x.name}{x.why && <small> · {x.why}</small>}</button>;
          })}
        </span>
      )}
      {!big && p.channels.length > 1 && (
        <span className={`${look.segment} km-how`} role="group" aria-label="Send as">
          {p.channels.map((c) => <button key={c.key} type="button" className={channel === c.key ? "on" : ""} aria-pressed={channel === c.key} onClick={() => { touched.current = true; pick(c.key); }}>{c.label}</button>)}
        </span>
      )}
      {replies.length > 0 && (
        <span className="km-replies" ref={menuBox} onKeyDown={(e) => { if (e.key === "Escape" && menu) { e.stopPropagation(); setMenu(false); } }}
          onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setMenu(false); }}>
          <button type="button" className="km-expand km-replies-btn" aria-haspopup="menu" aria-expanded={menu} onClick={() => setMenu(!menu)} aria-label="Saved replies" title="Saved replies">
            <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M5 4h14v16l-7-4-7 4z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /></svg>
          </button>
          {menu && (
            <span className="km-replies-menu" role="menu" aria-label="Saved replies">
              <b className="km-replies-head">Saved replies</b>
              {replies.map((r) => (
                <button key={r.id} type="button" role="menuitem" onClick={() => putReply(r)} title={r.body}>
                  <span>{r.name}</span><small>{(p.fill ? p.fill(r.body, { channel, to: picked }) : r.body).replace(/\s+/g, " ").slice(0, 90)}</small>
                </button>
              ))}
            </span>
          )}
        </span>
      )}
      {canAttach && (
        <>
          <button type="button" className="km-expand km-attach-btn" disabled={uploading} onClick={() => picker.current?.click()} aria-label="Add a picture or file" title="Add a picture or file">
            <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M21 11.5l-8.6 8.6a5 5 0 0 1-7.1-7.1l8.6-8.6a3.3 3.3 0 0 1 4.7 4.7l-8.6 8.6a1.7 1.7 0 0 1-2.4-2.4l7.9-7.9" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
          <input ref={picker} type="file" multiple hidden accept={p.attach!.accept} onChange={(e) => void addFiles(e.target.files)} />
        </>
      )}
      {p.bigWindow && ch.subject && !big && <button type="button" className="km-expand" onClick={() => setBig(true)} aria-label="Write in a larger window" title="Write in a larger window">⤢</button>}
    </div>
  );
  const fields = (
    <>
      {ch.subject && !small && <input className="km-subj" aria-label="Subject" placeholder="Subject" value={subject} onChange={(e) => { setSubject(e.target.value); keep({ subject: e.target.value }); }} />}
      {files.length > 0 && (
        <div className="km-files">
          {files.map((f, i) => (
            <span key={f.url} className={`km-file${canAttach ? "" : " off"}`} title={canAttach ? f.name : `${f.name}: ${ch.label} can't take files`}>
              {/\.(jpe?g|png|gif|webp|heic)$/i.test(f.name) ? <img src={f.url} alt="" /> : <span aria-hidden="true">📎</span>}
              <span className="km-file-name">{f.name}</span>
              <button type="button" aria-label={`Remove ${f.name}`} onClick={() => setFiles(files.filter((_, j) => j !== i))}>×</button>
            </span>
          ))}
        </div>
      )}
      <div className={`km-write${(ch.rows ?? 2) > 2 && !small ? " tall" : ""}${big ? " big" : ""}`}>
        <textarea ref={(el) => { area.current = el; if (!big) text.current = el; }} rows={big ? 16 : small ? 1 : ch.rows ?? 2} value={body} placeholder={place} aria-label={place} onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); go(); } }} />
        <button type="button" className="km-send" disabled={disabled} onClick={go} aria-label={ch.private ? `Add ${ch.label.toLowerCase()}` : "Send"} title={`${ch.private ? `Add ${ch.label.toLowerCase()}` : "Send"} (⌘ Enter)`}>
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
      </div>
      {(ch.off || problem || uploading || (files.length > 0 && !small)) && <p className={`km-compose-note${problem ? " km-err" : ""}`} role={problem ? "alert" : undefined}>
        {problem || ch.off || (uploading ? "Uploading…" : canAttach ? p.attach!.note!(channel) : `${ch.label} can't take files: they stay here for a text or email.`)}</p>}
    </>
  );
  const title = `${ch.label}${names.length ? ` ${names.join(" and ")}` : ""}`;

  return (
    <div className={`km-compose${small ? " small" : ""}`} onFocus={() => setOpen(true)}
      onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null) && !body.trim()) setOpen(false); }}
      // Its buttons (To, Text / Email / Note) keep the typing where it is: Safari doesn't focus a clicked button, which
      // would otherwise look like leaving the box and fold it before the click lands
      onMouseDown={(e) => { if (open && !(e.target as HTMLElement).closest("textarea, input")) e.preventDefault(); }}>
      {big ? (
        <>
          <p className="km-compose-note">Writing in the larger window. <button type="button" className={look.link} onClick={() => setBig(false)}>Bring it back here</button></p>
          {p.renderWindow
            ? p.renderWindow({ title, onClose: () => setBig(false), children: <div className="km-window-body">{top}{fields}</div> })
            : <PlainWindow title={title} onClose={() => setBig(false)}><div className="km-window-body">{top}{fields}</div></PlainWindow>}
        </>
      ) : <>{!small && top}{fields}</>}
    </div>
  );
}

/** The box's words with `piece` put in from `a` to `b` (a selection is replaced), and where the cursor goes after it.
 *  A piece going into the middle of words gets a space on either side where it needs one. */
export function insertAt(text: string, a: number, b: number, piece: string) {
  const start = Math.max(0, Math.min(a, text.length)), end = Math.max(start, Math.min(b, text.length));
  const before = text.slice(0, start), after = text.slice(end);
  const lead = before && !/\s$/.test(before) ? " " : "";
  const trail = after && !/^\s/.test(after) ? " " : "";
  const put = lead + piece + trail;
  return { text: before + put + after, caret: (before + lead + piece).length };
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
