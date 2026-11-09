import { describe, expect, it } from "vitest";
import { findQuoted, foldReactions, isAcknowledgement, parseReaction } from "./reactions";
import { buildInbox } from "./rules";

// Made-up people and words only
const msg = (key: string, side: "us" | "them", body: string, from?: string) => ({ kind: "message" as const, key, at: `2026-11-08T0${key.length}:00:00Z`, side, body, from });

describe("reaction texts", () => {
  it("reads Android's and iPhone's ways of sending one", () => {
    expect(parseReaction("👍 to “Hi Jo! No class Friday because…”")).toEqual({ emoji: "👍", quote: "Hi Jo! No class Friday because…", removed: false });
    expect(parseReaction('Liked "See you at 9"')).toMatchObject({ emoji: "👍", quote: "See you at 9" });
    expect(parseReaction("Laughed at “ha that's funny”")).toMatchObject({ emoji: "😂" });
    expect(parseReaction("Emphasized “Bring a lunch”")).toMatchObject({ emoji: "‼️" });
    expect(parseReaction("Reacted 🙏 to “Thanks for helping”")).toMatchObject({ emoji: "🙏" });
    expect(parseReaction("❤️ to “Great day”")).toMatchObject({ emoji: "❤️" });
    expect(parseReaction("👍🏽 to “Great day”")).toMatchObject({ emoji: "👍🏽" });
    expect(parseReaction("Removed a like from “See you at 9”")).toMatchObject({ emoji: "👍", removed: true });
    expect(parseReaction("👍 to “Hi Jo! No class Friday because…")).toMatchObject({ emoji: "👍", quote: "Hi Jo! No class Friday because…" });
  });
  it("leaves ordinary texts alone", () => {
    expect(parseReaction("Ok! I will take a look")).toBeNull();
    expect(parseReaction('She said "yes" to the dress')).toBeNull();
    expect(parseReaction("👍")).toBeNull();
  });
  it("finds the text a shortened quote is from, newest first", () => {
    const earlier = [{ body: "Hi Jo! No class Friday because of the storm." }, { body: "Other" }];
    expect(findQuoted("Hi Jo! No class Friday because…", earlier)).toBe(earlier[0]);
    expect(findQuoted("nothing like it", earlier)).toBeNull();
  });
  it("moves a reaction onto its text; one that matches nothing stays a bubble", () => {
    const items = [msg("a", "us", "Hi Jo! No class Friday because of the storm."), msg("bb", "them", "👍 to “Hi Jo! No class Friday because…”", "Jo"), msg("ccc", "them", "Liked “something we never sent”", "Jo")];
    const out = foldReactions(items);
    expect(out.items.map((i) => i.key)).toEqual(["a", "ccc"]);
    expect(out.reactions.get("a")).toEqual([{ emoji: "👍", side: "them", who: "Jo", at: items[1].at }]);
  });
  it("a new reaction replaces that person's last one; a removed one goes", () => {
    const items = [msg("a", "us", "See you at 9"), msg("bb", "them", "Liked “See you at 9”", "Jo"), msg("ccc", "them", "Loved “See you at 9”", "Jo")];
    expect(foldReactions(items).reactions.get("a")?.map((t) => t.emoji)).toEqual(["❤️"]);
    const gone = [...items, msg("dddd", "them", "Removed a heart from “See you at 9”", "Jo")];
    expect(foldReactions(gone).reactions.get("a")).toEqual([]);
  });
});

describe("matching a phone's copy of the text", () => {
  it("ignores line breaks, curly quotes, dashes and where it was cut", () => {
    const sent = [{ body: "Hi Jo! There's a mix-up for art tomorrow.\n\nIt says to do the fields but we need weeks 9 and 10" }];
    expect(findQuoted("Hi Jo! There’s a mix‑up for art tomorrow.It says to do the fields but we need w…", sent)).toBe(sent[0]);
    expect(findQuoted("Hi Jo! There's a mix-up for art tomorrow. It says to do the fields but we need weeks 9 and 10", sent)).toBe(sent[0]);
  });
});

describe("a thumbs-up is got it", () => {
  it("knows a thumbs-up from other reactions", () => {
    expect(isAcknowledgement("👍 to “See you at 9”")).toBe(true);
    expect(isAcknowledgement("👍🏻 to “See you at 9”")).toBe(true);
    expect(isAcknowledgement("Liked “See you at 9”")).toBe(true);
    expect(isAcknowledgement("👍🏽")).toBe(true);
    expect(isAcknowledgement("❓ to “See you at 9”")).toBe(false);
    expect(isAcknowledgement("Loved “See you at 9”")).toBe(false);
    expect(isAcknowledgement("👍 sounds good, but can we do 10?")).toBe(false);
    expect(isAcknowledgement("Removed a like from “See you at 9”")).toBe(false);
  });
  it("doesn't put a conversation back on Needs reply; words before it still do", () => {
    const m = (id: string, direction: "in" | "out", body: string, at: string) => ({ id, conversation: "c", direction, channel: "sms", body, sent_at: at, status: "sent" });
    const liked = buildInbox([m("1", "out", "See you at 9", "2026-11-08T01:00:00Z"), m("2", "in", "👍 to “See you at 9”", "2026-11-08T02:00:00Z")], []);
    expect(liked[0].needsReply).toBe(false);
    expect(liked[0].unread).toBe(false);
    const asked = buildInbox([m("1", "out", "See you at 9", "2026-11-08T01:00:00Z"), m("2", "in", "Can we do 10?", "2026-11-08T02:00:00Z"), m("3", "in", "👍 to “See you at 9”", "2026-11-08T03:00:00Z")], []);
    expect(asked[0].needsReply).toBe(true);
    const question = buildInbox([m("1", "out", "See you at 9", "2026-11-08T01:00:00Z"), m("2", "in", "❓ to “See you at 9”", "2026-11-08T02:00:00Z")], []);
    expect(question[0].needsReply).toBe(true);
  });
});
