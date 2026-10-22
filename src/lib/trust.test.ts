import { describe, expect, it } from "vitest";
import { trustOf } from "./trust";

const none = { confirmed: 0, unavailable: 0, priceChanged: 0, bought: 0 };
const sig = { offersCount: 120, warrantyShare: 0.6, priceMedianAt: "2026-10-12T00:00:00Z" };
const now = new Date("2026-10-22T00:00:00Z").getTime();

describe("trustOf", () => {
  it("no reports → no report line, data signals still shown", () => {
    const t = trustOf(none, sig, now);
    expect(t.reports).toBeNull();
    expect(t.signals.map((s) => s.text)).toEqual(["قیمت‌هایش معمولاً ۱۰ روز پیش ثبت شده", "گارانتی برای ۶۰٪ کالاهایش ثبت شده", "۱۲۰ کالا در ترب"]);
    expect(t.signals[0].tone).toBe("aging");
  });

  it("good record", () => {
    const t = trustOf({ confirmed: 3, unavailable: 0, priceChanged: 1, bought: 1 }, sig, now);
    expect(t.reports).toMatchObject({ n: 5, tone: "good" });
    expect(t.reports!.text).toBe("گزارش کاربران: ۵ از ۵ بار موجود بود؛ قیمت ۴ از ۵ بار همان قیمت ترب بود");
  });

  it("mostly out of stock is bad", () => expect(trustOf({ ...none, unavailable: 3, confirmed: 1 }, sig, now).reports!.tone).toBe("bad"));

  it("small sample is flagged", () => expect(trustOf({ ...none, confirmed: 1 }, sig, now).reports!.text).toContain("نمونه کم"));

  it("all unavailable has no price part", () =>
    expect(trustOf({ ...none, unavailable: 2 }, sig, now).reports!.text).toBe("گزارش کاربران: ۰ از ۲ بار موجود بود (نمونه کم)"));

  it("zero warranty phrased plainly", () =>
    expect(trustOf(none, { ...sig, warrantyShare: 0 }, now).signals[1].text).toBe("برای هیچ‌کدام از کالاهایش گارانتی ثبت نکرده"));
  it("warranty share hidden for tiny catalogues", () =>
    expect(trustOf(none, { ...sig, offersCount: 3 }, now).signals.some((s) => s.text.includes("گارانتی"))).toBe(false));
});
