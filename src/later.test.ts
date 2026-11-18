import { describe, expect, it } from "vitest";
import { laterChoices, laterProblem, localInput } from "./later";

const d = (s: string) => new Date(s);

describe("laterChoices", () => {
  it("offers tomorrow morning, tomorrow afternoon and Monday morning", () => {
    const c = laterChoices(d("2026-11-18T15:20:00")); // a Wednesday
    expect(c.map((x) => x.label)).toEqual(["Tomorrow morning", "Tomorrow afternoon", "Monday morning"]);
    expect(localInput(c[0].at)).toBe("2026-11-19T08:15");
    expect(localInput(c[1].at)).toBe("2026-11-19T13:15");
    expect(localInput(c[2].at)).toBe("2026-11-23T08:15");
  });
  it("leaves out Monday when tomorrow is Monday", () => {
    expect(laterChoices(d("2026-11-22T10:00:00")).map((x) => x.label)).toEqual(["Tomorrow morning", "Tomorrow afternoon"]);
  });
  it("on a Monday, Monday means next week", () => {
    expect(localInput(laterChoices(d("2026-11-23T10:00:00"))[2].at)).toBe("2026-11-30T08:15");
  });
  it("before 7 AM it's this morning and this afternoon", () => {
    const c = laterChoices(d("2026-11-18T05:30:00"));
    expect(c.map((x) => x.label)).toEqual(["This morning", "This afternoon", "Monday morning"]);
    expect(localInput(c[0].at)).toBe("2026-11-18T08:15");
  });
  it("crosses the end of the month", () => {
    expect(localInput(laterChoices(d("2026-11-30T12:00:00"))[0].at)).toBe("2026-12-01T08:15");
  });
});

describe("laterProblem", () => {
  const now = d("2026-11-18T15:00:00");
  it("wants at least 5 minutes ahead and within a year", () => {
    expect(laterProblem(d("2026-11-18T15:03:00"), now)).toMatch(/5 minutes/);
    expect(laterProblem(d("2026-11-18T15:10:00"), now)).toBe("");
    expect(laterProblem(d("2028-01-01T08:00:00"), now)).toMatch(/year/);
    expect(laterProblem(d("nonsense"), now)).toMatch(/Pick/);
  });
});
