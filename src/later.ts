// Send later (v1.11.0; David, Nov 18, 2026): the times the reply box offers beside Send, like Gmail's Schedule send and
// Mail's Send Later. All in the computer's own time zone. The app keeps the message and sends it when it's due.

export interface LaterChoice { label: string; at: Date }

const at = (base: Date, days: number, hour: number) => { const d = new Date(base); d.setDate(d.getDate() + days); d.setHours(hour, 0, 0, 0); return d; };

/** "Tomorrow morning" 8 AM, "Tomorrow afternoon" 1 PM, and "Monday morning" 8 AM (left out when tomorrow is Monday).
 *  Before 7 AM the first two are this morning and this afternoon. */
export function laterChoices(now: Date = new Date()): LaterChoice[] {
  const early = now.getHours() < 7;
  const day = early ? 0 : 1, word = early ? "This" : "Tomorrow";
  const out: LaterChoice[] = [
    { label: `${word} morning`, at: at(now, day, 8) },
    { label: `${word} afternoon`, at: at(now, day, 13) },
  ];
  const toMonday = ((8 - now.getDay()) % 7) || 7;
  if (toMonday > day) out.push({ label: "Monday morning", at: at(now, toMonday, 8) });
  return out;
}

/** "Tue, Nov 19, 8:00 AM" */
export function laterWhen(d: Date | string): string {
  return new Date(d).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

/** A date-and-time box's value ("2026-11-19T08:00") for a time, in the computer's time zone. */
export function localInput(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** What's wrong with a picked time, or "" when it's fine: at least 5 minutes ahead and within a year. */
export function laterProblem(d: Date, now: Date = new Date()): string {
  if (Number.isNaN(d.getTime())) return "Pick a date and time.";
  if (d.getTime() < now.getTime() + 5 * 60_000) return "Pick a time at least 5 minutes from now.";
  if (d.getTime() > now.getTime() + 366 * 86_400_000) return "Pick a time within the next year.";
  return "";
}
