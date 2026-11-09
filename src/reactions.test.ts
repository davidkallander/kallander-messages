import { describe, expect, it } from "vitest";
import { findQuoted, foldReactions, parseReaction } from "./reactions";

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
