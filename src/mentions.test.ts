import { describe, expect, it } from "vitest";
import { findMentions, mentionedNames } from "./mentions";

const team = ["Deborah", "David", "Ann"];

describe("@mentions", () => {
  it("finds a teammate's @name however it's capitalised or punctuated", () => {
    expect(mentionedNames("@Deborah- could you answer?", team)).toEqual(["Deborah"]);
    expect(mentionedNames("thanks @deborah, and @DAVID.", team)).toEqual(["Deborah", "David"]);
  });
  it("needs the whole name, and an @ that isn't part of an email address", () => {
    expect(mentionedNames("@Annie and ann@example.com", team)).toEqual([]);
    expect(mentionedNames("ask @Ann", team)).toEqual(["Ann"]);
  });
  it("says where each one is, the @ included", () => {
    expect(findMentions("hi @David", team)).toEqual([{ start: 3, end: 9, name: "David" }]);
  });
  it("names someone once however often they're mentioned, and nobody without a list", () => {
    expect(mentionedNames("@Ann @ann", team)).toEqual(["Ann"]);
    expect(mentionedNames("@Ann", [])).toEqual([]);
  });
});
