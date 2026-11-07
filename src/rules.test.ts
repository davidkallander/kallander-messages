// Which conversations need a reply, are unread or done (rules.ts). Made-up people only.
import { describe, expect, it } from "vitest";
import { buildInbox, initials, preview, type Message } from "./rules";

const msg = (p: Partial<Message>): Message => ({ id: Math.random().toString(), conversation: "a", channel: "sms", direction: "in", body: "", sent_at: "2026-10-31T10:00:00Z", ...p });
const st = (p: Record<string, string | null>) => ({ conversation: "a", read_at: null, done_at: null, ...p });

describe("buildInbox", () => {
  it("groups by conversation, newest first", () => {
    const out = buildInbox([
      msg({ conversation: "a", sent_at: "2026-10-30T10:00:00Z" }),
      msg({ conversation: "b", sent_at: "2026-10-31T09:00:00Z", direction: "out" }),
      msg({ conversation: "a", sent_at: "2026-10-31T11:00:00Z" }),
    ], []);
    expect(out.map((c) => [c.key, c.count])).toEqual([["a", 2], ["b", 1]]);
  });
  it("needs a reply when they wrote last, until someone answers or marks it Done", () => {
    const ms = [msg({ sent_at: "2026-10-31T10:00:00Z" })];
    expect(buildInbox(ms, [])[0]).toMatchObject({ needsReply: true, unread: true });
    // Marked read: the dot goes, but it still needs a reply until someone answers or taps Done
    expect(buildInbox(ms, [st({ read_at: "2026-10-31T10:05:00Z" })])[0]).toMatchObject({ needsReply: true, unread: false });
    expect(buildInbox(ms, [st({ read_at: "2026-10-31T10:05:00Z", done_at: "2026-10-31T10:05:00Z" })])[0]).toMatchObject({ needsReply: false, unread: false });
    expect(buildInbox([...ms, msg({ direction: "out", sent_at: "2026-10-31T10:10:00Z" })], [])[0]).toMatchObject({ needsReply: false, unread: false });
  });
  it("waits on them when we wrote last, and stops once they answer or ours didn't send", () => {
    const asked = [msg({ sent_at: "2026-10-31T10:00:00Z" }), msg({ direction: "out", sent_at: "2026-10-31T10:10:00Z" })];
    expect(buildInbox(asked, [])[0]).toMatchObject({ needsReply: false, waitingOnThem: true });
    expect(buildInbox([msg({ direction: "out" })], [])[0]).toMatchObject({ waitingOnThem: true });
    expect(buildInbox([...asked, msg({ sent_at: "2026-10-31T11:00:00Z" })], [])[0]).toMatchObject({ needsReply: true, waitingOnThem: false });
    expect(buildInbox([msg({ direction: "out", status: "failed" })], [])[0]).toMatchObject({ waitingOnThem: false });
  });
  it("doesn't count a reply that didn't send", () => {
    const ms = [msg({ sent_at: "2026-10-31T10:00:00Z" }), msg({ direction: "out", status: "failed", sent_at: "2026-10-31T10:10:00Z" })];
    expect(buildInbox(ms, [])[0]).toMatchObject({ needsReply: true, unread: true });
  });
  it("brings it back when they write again after Done", () => {
    const out = buildInbox([msg({ sent_at: "2026-10-31T12:00:00Z" })], [st({ read_at: "2026-10-31T10:00:00Z", done_at: "2026-10-31T10:00:00Z" })]);
    expect(out[0]).toMatchObject({ needsReply: true, unread: true });
  });
  it("waits on nobody for what the app says to ignore (an opt-out, old history)", () => {
    expect(buildInbox([msg({ body: "Stop", ignore: true })], [])[0]).toMatchObject({ needsReply: false, unread: false });
  });
});

describe("Mark unread", () => {
  it("brings the dot and Needs reply back until someone answers or taps Done", () => {
    const answered = [msg({ sent_at: "2026-10-31T10:00:00Z" }), msg({ direction: "out", sent_at: "2026-10-31T10:05:00Z" })];
    const s = st({ unread_at: "2026-10-31T10:10:00Z" });
    expect(buildInbox(answered, [s])[0]).toMatchObject({ unread: true, needsReply: true });
    expect(buildInbox([...answered, msg({ direction: "out", sent_at: "2026-10-31T10:20:00Z" })], [s])[0]).toMatchObject({ unread: false, needsReply: false });
    expect(buildInbox(answered, [{ ...s, done_at: "2026-10-31T10:15:00Z" }])[0]).toMatchObject({ unread: false, needsReply: false });
    expect(buildInbox(answered, [{ ...s, read_at: "2026-10-31T10:15:00Z" }])[0]).toMatchObject({ unread: false, needsReply: false });
  });
});

describe("done", () => {
  it("is Done since they last wrote; writing again, or taking it back, undoes it", () => {
    const ms = [msg({ sent_at: "2026-10-31T10:00:00Z" })];
    expect(buildInbox(ms, [st({ read_at: "2026-10-31T10:05:00Z", done_at: "2026-10-31T10:05:00Z" })])[0]).toMatchObject({ done: true, needsReply: false });
    expect(buildInbox([...ms, msg({ sent_at: "2026-10-31T11:00:00Z" })], [st({ done_at: "2026-10-31T10:05:00Z" })])[0]).toMatchObject({ done: false, needsReply: true });
    expect(buildInbox(ms, [st({ read_at: "2026-10-31T10:05:00Z" })])[0]).toMatchObject({ done: false, needsReply: true });
  });
  it("is never done and unread: Mark unread after Done takes Done off", () => {
    const ms = [msg({ sent_at: "2026-10-31T10:00:00Z" })];
    expect(buildInbox(ms, [st({ read_at: "2026-10-31T10:05:00Z", done_at: "2026-10-31T10:05:00Z", unread_at: "2026-10-31T10:10:00Z" })])[0])
      .toMatchObject({ done: false, unread: true, needsReply: true });
  });
});

describe("the list's words", () => {
  it("says who wrote last and what", () => {
    expect(preview({ last: msg({ direction: "out", body: "See you Tuesday" }) })).toBe("You: See you Tuesday");
    expect(preview({ last: msg({ direction: "out", automatic: true, body: "Reminder:  your visit" }) })).toBe("Automatic: Reminder: your visit");
    expect(preview({ last: msg({ channel: "email", subject: "Your proposal", body: "…" }) })).toBe("Email: Your proposal");
    expect(preview({ last: msg({ channel: "call", body: "" }) })).toBe("Call");
    expect(preview({ name: "Mike Neely", last: msg({ channel: "call", body: "" }) })).toBe("Call from Mike");
    expect(preview({ name: "(360) 447-2268", last: msg({ channel: "call", body: "" }) })).toBe("Call");
    expect(preview({ name: "Mike Neely", last: msg({ channel: "call", direction: "out", body: "" }) })).toBe("You: Call");
  });
  it("makes letters for the picture", () => {
    expect(initials("Leah Helms")).toBe("LH");
    expect(initials("Bob & Sue Ray")).toBe("BR");
    expect(initials("the Smith family")).toBe("SM");
    expect(initials("")).toBe("?");
  });
});

import { insertAt } from "./Composer";
describe("putting a saved reply in the box", () => {
  it("goes in an empty box as it is", () => {
    expect(insertAt("", 0, 0, "Hi Ann!")).toEqual({ text: "Hi Ann!", caret: 7 });
  });
  it("goes where the cursor is, with spaces where words would run together", () => {
    expect(insertAt("Thanks.See you", 7, 7, "Here's the link.")).toEqual({ text: "Thanks. Here's the link. See you", caret: 24 });
    expect(insertAt("Thanks. ", 8, 8, "Bye")).toEqual({ text: "Thanks. Bye", caret: 11 });
  });
  it("replaces what's selected", () => {
    expect(insertAt("Hi XX there", 3, 5, "Ann")).toEqual({ text: "Hi Ann there", caret: 6 });
  });
});

describe("drafts", () => {
  it("are kept per conversation, and cleared when emptied", async () => {
    const store = new Map<string, string>();
    Object.assign(globalThis, {
      localStorage: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) },
      window: Object.assign(globalThis.window ?? {}, { dispatchEvent: () => true }),
    });
    const { loadDraft, saveDraft } = await import("./drafts");
    saveDraft("fam-1", { channel: "sms", to: ["p1"], subject: "", body: "Hi Anna, about Monday" });
    expect(loadDraft("fam-1")).toMatchObject({ channel: "sms", to: ["p1"], body: "Hi Anna, about Monday" });
    expect(loadDraft("fam-2")).toBeNull();
    saveDraft("fam-1", { channel: "sms", to: ["p1"], subject: "", body: "   " });
    expect(loadDraft("fam-1")).toBeNull();
  });
});
