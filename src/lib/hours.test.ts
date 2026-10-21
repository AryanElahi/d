import { describe, expect, it } from "vitest";
import { hoursNow, type Week } from "./hours";

const day = (...shifts: [string, string][]) => ({
  status: "declared",
  shifts: shifts.map(([start_time, end_time]) => ({ start_time, end_time })),
});
const week: Week = {
  wed: day(["10:00:00", "19:00:00"], ["00:00:00", "00:00:00"]),
  thu: day(["10:00:00", "14:00:00"], ["16:00:00", "20:00:00"]),
  fri: { status: "closed", shifts: [] },
  sat: day(["18:00:00", "02:00:00"]),
  sun: day(["00:00:00", "00:00:00"]),
};

// Tehran is UTC+3:30. Wed 2026-10-21.
const at = (iso: string) => new Date(iso);

describe("hoursNow", () => {
  it("open, ignoring the empty 00:00 slot", () =>
    expect(hoursNow(week, at("2026-10-21T08:00:00Z"))).toMatchObject({ state: "open", label: "باز است تا ۱۹:۰۰" }));
  it("closing soon", () =>
    expect(hoursNow(week, at("2026-10-21T15:00:00Z"))).toMatchObject({ state: "closing_soon", label: "۳۰ دقیقه دیگر می‌بندد" }));
  it("before opening", () =>
    expect(hoursNow(week, at("2026-10-21T05:00:00Z"))).toMatchObject({ state: "closed", label: "الان بسته · از ۱۰:۰۰ باز می‌شود" }));
  it("after closing", () =>
    expect(hoursNow(week, at("2026-10-21T17:00:00Z")).label).toBe("امروز بسته شده · تا ۱۹:۰۰ باز بود"));
  it("lunch break between two shifts", () =>
    expect(hoursNow(week, at("2026-10-22T11:00:00Z")).label).toBe("الان بسته · از ۱۶:۰۰ باز می‌شود"));
  it("two shifts in today text", () =>
    expect(hoursNow(week, at("2026-10-22T08:00:00Z")).today).toBe("۱۰:۰۰ تا ۱۴:۰۰ و ۱۶:۰۰ تا ۲۰:۰۰"));
  it("closed day", () => expect(hoursNow(week, at("2026-10-23T08:00:00Z")).state).toBe("closed"));
  it("overnight shift", () => expect(hoursNow(week, at("2026-10-24T19:00:00Z")).state).toBe("open"));
  it("only empty slots → unknown", () => expect(hoursNow(week, at("2026-10-25T08:00:00Z")).state).toBe("unknown"));
  it("no hours → unknown", () => expect(hoursNow(null).state).toBe("unknown"));
  it("day missing → unknown", () => expect(hoursNow({}, at("2026-10-21T08:00:00Z")).state).toBe("unknown"));
});
