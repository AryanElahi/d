import { describe, expect, it } from "vitest";
import { buildChecklist, dataItems, GUIDES, modelCode, type ChecklistData } from "./checklist";

const d: ChecklistData = {
  title: "دوربین مدار بسته داهوا مدل DH-HAC-HDW1200CLQP-IL-A کیفیت ۲ مگاپیکسل",
  model: null,
  priceMin: 2_480_000,
  priceMax: 9_800_000,
  copyListings: 0,
  sellers: 21,
  warranties: ["شرکتی", "پارس ارتباط افزار"],
};

describe("modelCode", () => {
  it("dataset model wins", () => expect(modelCode("x", " A55 ")).toBe("A55"));
  it("longest Latin code with a digit", () => expect(modelCode(d.title, null)).toBe("DH-HAC-HDW1200CLQP-IL-A"));
  it("ignores words without digits", () => expect(modelCode("هدفون Anker Soundcore", null)).toBeNull());
});

describe("dataItems", () => {
  it("model, warranties and price range from data", () => {
    const t = dataItems(d).map((i) => i.text);
    expect(t[0]).toContain("DH-HAC-HDW1200CLQP-IL-A");
    expect(t.some((x) => x.includes("شرکتی، پارس ارتباط افزار"))).toBe(true);
    expect(t.some((x) => x.includes("۲.۵ میلیون تومان"))).toBe(true);
    expect(dataItems(d).every((i) => i.source === "data")).toBe(true);
  });
  it("copy listings counted", () => expect(dataItems({ ...d, copyListings: 4 }).some((i) => i.text.startsWith("۴ فروشنده از ۲۱"))).toBe(true));
  it("طرح in title flagged", () => expect(dataItems({ ...d, title: "گوشی طرح سامسونگ B310E" }).some((i) => i.text.includes("نسخه اصلی برند نیست"))).toBe(true));
  it("no warranty recorded", () => expect(dataItems({ ...d, warranties: [] }).some((i) => i.text.includes("هیچ فروشنده‌ای"))).toBe(true));
});

describe("buildChecklist", () => {
  it("curated guide for known category", () => {
    const c = buildChecklist("دوربین مدار بسته", d, ["ai tip"]);
    expect(c.filter((i) => i.source === "guide").map((i) => i.text)).toEqual(expect.arrayContaining(GUIDES["دوربین مدار بسته"]));
    expect(c.some((i) => i.source === "ai")).toBe(false);
  });
  it("AI tips for unknown category", () => expect(buildChecklist("یخچال مسافرتی", d, ["چک کن"]).some((i) => i.source === "ai")).toBe(true));
  it("generic fallback without AI", () => expect(buildChecklist("یخچال مسافرتی", d, null).some((i) => i.text.includes("مرجوعی"))).toBe(true));
});
