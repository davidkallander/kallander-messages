// Drafts (David, Nov 7, 2026): what's written in a conversation's reply box is kept as it's typed, so leaving the page,
// opening another conversation or reloading doesn't lose it, like Messages on a Mac. Kept in this browser only (not the
// database), so a half-written message stays the writer's own. Sending it, or emptying the box, clears it.
import { useEffect, useState } from "react";

export interface Draft { channel: string; to: string[]; subject: string; body: string; files?: { name: string; url: string; size: number; type?: string }[]; at: string }

const KEY = (k: string) => `km.draft:${k}`;
const EVENT = "km-drafts";

/** The draft kept for a conversation, if there is one. */
export function loadDraft(key: string | undefined): Draft | null {
  if (!key) return null;
  try {
    const d = JSON.parse(localStorage.getItem(KEY(key)) ?? "null") as Draft | null;
    return d && typeof d.body === "string" && (d.body.trim() || d.files?.length) ? d : null;
  } catch { return null; }
}

/** Keeps a conversation's draft, or clears it (null, or nothing written). */
export function saveDraft(key: string | undefined, d: Omit<Draft, "at"> | null) {
  if (!key) return;
  try {
    const had = localStorage.getItem(KEY(key)) !== null;
    if (d && (d.body.trim() || d.files?.length)) localStorage.setItem(KEY(key), JSON.stringify({ ...d, at: new Date().toISOString() }));
    else if (had) localStorage.removeItem(KEY(key));
    else return;
    window.dispatchEvent(new Event(EVENT));
  } catch { /* a private window: drafts just aren't kept */ }
}

/** Re-renders when any draft changes, here or in another tab. */
export function useDrafts() {
  const [n, setN] = useState(0);
  useEffect(() => {
    const bump = () => setN((x) => x + 1);
    const other = (e: StorageEvent) => { if (!e.key || e.key.startsWith("km.draft:")) bump(); };
    window.addEventListener(EVENT, bump);
    window.addEventListener("storage", other);
    return () => { window.removeEventListener(EVENT, bump); window.removeEventListener("storage", other); };
  }, []);
  return n;
}
