import { describe, expect, it } from "vitest";
import type { HoursNow } from "./hours";
import { outcomeOdds, simulateReply, type SimInput } from "./simulate";

const open: HoursNow = { state: "open", label: "باز است تا ۱۹:۰۰", today: "۱۰:۰۰ تا ۱۹:۰۰" };
const unknown: HoursNow = { state: "unknown", label: "ساعت کاری ثبت نشده", today: null };
const base: SimInput = { offerId: "offer_a", day: "2026-10-22", price: 2_480_000, priceAgeDays: 5, hours: open, othersUnavailable: 0, warranty: null };

describe("simulateReply", () => {
  it("deterministic for same offer and day", () =>
    expect(simulateReply(base, "stock")).toEqual(simulateReply(base, "stock")));

  it("produces all three outcomes across offers", () => {
    const outcomes = new Set(
      Array.from({ length: 200 }, (_, k) => simulateReply({ ...base, offerId: `offer_${k}`, priceAgeDays: 40 }, "stock").outcome),
    );
    expect(outcomes).toEqual(new Set(["confirmed", "price_changed", "unavailable"]));
  });

  it("price change is upward, rounded, and reported", () => {
    for (let k = 0; k < 200; k++) {
      const r = simulateReply({ ...base, offerId: `offer_${k}`, priceAgeDays: 90 }, "stock");
      if (r.outcome === "price_changed") {
        expect(r.reportedPrice! % 10000).toBe(0);
        expect(r.reportedPrice!).toBeGreaterThan(base.price!);
        expect(r.reportedPrice!).toBeLessThanOrEqual(base.price! * 1.16);
        expect(r.text).toContain("۹۰ روز");
        return;
      }
    }
    throw new Error("no price change in 200 offers");
  });

  it("no price → never price_changed", () => {
    for (let k = 0; k < 100; k++) expect(simulateReply({ ...base, offerId: `o${k}`, price: null }, "stock").outcome).not.toBe("price_changed");
  });

  it("does not invent hours", () => {
    for (let k = 0; k < 50; k++) {
      const r = simulateReply({ ...base, offerId: `o${k}`, hours: unknown, othersUnavailable: 0 }, "stock");
      if (r.outcome === "confirmed") return expect(r.text).toContain("ساعت کاری‌مون توی ترب ثبت نشده");
    }
  });

  it("warranty answer comes from data", () => {
    expect(simulateReply({ ...base, warranty: { provider: "شرکتی", period_months: 24 } }, "warranty").text).toContain("۲۴ ماهه «شرکتی»");
    expect(simulateReply(base, "warranty").text).toContain("در ترب گارانتی");
  });

  it("can't hold what's unavailable", () => expect(simulateReply(base, "hold", "unavailable").text).toContain("موجود نداریم"));
});

describe("outcomeOdds", () => {
  it("stale prices change more often", () => expect(outcomeOdds({ priceAgeDays: 90, othersUnavailable: 0 }).priceChanged).toBeGreaterThan(outcomeOdds({ priceAgeDays: 3, othersUnavailable: 0 }).priceChanged));
  it("other users' reports raise unavailability, capped", () => {
    expect(outcomeOdds({ priceAgeDays: 3, othersUnavailable: 2 }).unavailable).toBeGreaterThan(outcomeOdds({ priceAgeDays: 3, othersUnavailable: 0 }).unavailable);
    expect(outcomeOdds({ priceAgeDays: 90, othersUnavailable: 10 }).unavailable).toBeLessThanOrEqual(0.6);
  });
});
