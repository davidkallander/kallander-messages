import { useEffect, useRef, type ReactNode } from "react";
import { useLook } from "./look";

// An email as the customer saw it (v1.9.0; David, Nov 11, 2026): clicking an email's bubble opens it like Mail opens
// one, the subject at the top, who it was from and to, and the email itself with its logo, colors and buttons. The app
// finds the email's HTML (each keeps its own copy) and hands it here. The HTML is shown in a frame that can't run
// anything in it (no scripts), and its links open in a new tab.

/** The frame's page: the email, with links opening in a new tab and pictures kept inside the frame's width. */
export function emailPage(html: string) {
  const head = `<meta charset="utf-8"><base target="_blank"><style>html{background:#fff}body{margin:0;padding:16px;color:#1c1c1e;font:15px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif;overflow-wrap:anywhere}img{max-width:100%;height:auto}</style>`;
  if (/<head[\s>]/i.test(html)) return html.replace(/<head([^>]*)>/i, `<head$1>${head}`);
  if (/<html[\s>]/i.test(html)) return html.replace(/<html([^>]*)>/i, `<html$1><head>${head}</head>`);
  return `<!doctype html><html><head>${head}</head><body>${html}</body></html>`;
}

export function EmailWindow({ subject, lines, html, text, loading, onClose }: {
  subject: string;
  /** Under the subject: who it was from and to, and when ("From Joe · To caleb@… · Nov 3, 4:12 PM"). */
  lines?: ReactNode;
  /** The email as sent. Empty: no copy was kept, so its words (`text`) show instead, with a line saying so. */
  html?: string | null;
  /** The email's words, shown while its copy loads and when there's none. */
  text: string;
  loading?: boolean;
  onClose: () => void;
}) {
  const look = useLook();
  const done = useRef<HTMLButtonElement>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  useEffect(() => {
    done.current?.focus();
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); onClose(); } };
    window.addEventListener("keydown", key, true);
    return () => window.removeEventListener("keydown", key, true);
  }, [onClose]);
  // The frame as tall as the email (the window scrolls, not the frame), and again as its pictures load.
  useEffect(() => {
    const f = frame.current;
    if (!f || !html) return;
    let ro: ResizeObserver | null = null;
    const fit = () => { const doc = f.contentDocument; if (doc?.documentElement) f.style.height = `${Math.max(120, doc.documentElement.scrollHeight)}px`; };
    // An email made wider than the window (most are 600 wide) shrinks to fit, as a phone's Mail does.
    const shrink = () => {
      const doc = f.contentDocument;
      if (!doc?.body) return;
      doc.body.style.zoom = "";
      const wide = doc.documentElement.scrollWidth, room = f.clientWidth;
      if (room && wide > room + 1) doc.body.style.zoom = String(room / wide);
    };
    const loaded = () => {
      shrink(); fit();
      const doc = f.contentDocument;
      if (doc?.body && typeof ResizeObserver !== "undefined") { ro?.disconnect(); ro = new ResizeObserver(fit); ro.observe(doc.body); }
    };
    f.addEventListener("load", loaded);
    if (f.contentDocument?.readyState === "complete" && f.contentDocument.body?.childNodes.length) loaded();
    return () => { f.removeEventListener("load", loaded); ro?.disconnect(); };
  }, [html]);
  return (
    <div className="km-window-back" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="km-window km-mail" role="dialog" aria-modal="true" aria-label={subject || "Email"}>
        <div className="km-window-head">
          <b className="km-mail-subject">{subject || "(no subject)"}</b>
          <button ref={done} type="button" className={look.button} onClick={onClose}>Done</button>
        </div>
        {lines && <div className="km-mail-lines">{lines}</div>}
        {html
          // allow-same-origin without allow-scripts: nothing in the email can run, and the frame can be measured
          ? <iframe ref={frame} className="km-mail-frame" title={subject || "Email"} sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox" srcDoc={emailPage(html)} />
          : <>
            {loading ? <p className="km-mail-note">Loading the email…</p>
              : <p className="km-mail-note">There's no copy of how this email looked, so here are its words.</p>}
            <div className="km-mail-text">{text || <span className="km-faint">(nothing in it)</span>}</div>
          </>}
      </div>
    </div>
  );
}
