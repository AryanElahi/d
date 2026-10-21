import { describe, expect, it } from "vitest";
import { parseQuery, type Vocab } from "./parser";

const vocab: Vocab = {
  areas: ["فردوسی", "شیخ هادی", "جمهوری", "لاله زار", "تجریش"],
  brands: ["سامسونگ", "داهوا", "هایک ویژن", "اپل"],
  categories: ["گوشی موبایل", "دوربین مدار بسته", "کیف و کاور گوشی", "سیم و کابل برق ساختمان"],
};
const p = (q: string) => parseQuery(q, vocab);

describe("parseQuery", () => {
  it("budget max in million, Persian digits", () => {
    const f = p("گوشی سامسونگ زیر ۲۰ میلیون");
    expect(f.budgetMax).toBe(20_000_000);
    expect(f.brand).toBe("سامسونگ");
    expect(f.text).toBe("گوشی");
  });
  it("range", () => {
    const f = p("بین ۱۰ تا ۱۵ میلیون");
    expect([f.budgetMin, f.budgetMax]).toEqual([10_000_000, 15_000_000]);
  });
  it("short range", () => expect(p("هندزفری 500 تا 800 هزار").budgetMin).toBe(500_000));
  it("bare number means million", () => expect(p("زیر 5").budgetMax).toBe(5_000_000));
  it("decimal", () => expect(p("تا ۱.۵ میلیون").budgetMax).toBe(1_500_000));
  it("area + category + brand", () => {
    const f = p("دوربین مدار بسته داهوا نزدیک جمهوری");
    expect(f).toMatchObject({ area: "جمهوری", category: "دوربین مدار بسته", brand: "داهوا", text: "" });
  });
  it("multi-word area", () => expect(p("کابل برق لاله زار").area).toBe("لاله زار"));
  it("near me", () => expect(p("هدفون نزدیک من").nearMe).toBe(true));
  it("conditions", () => {
    const f = p("لپ تاپ قسطی با گارانتی ترب پی الان باز");
    expect(f).toMatchObject({ installments: true, warranty: true, torobpay: true, openNow: true, text: "لپ تاپ" });
  });
  it("cheapest sort", () => expect(p("ارزان ترین کابل").sort).toBe("price"));
  it("بازار is not باز", () => expect(p("بازار موبایل").openNow).toBeUndefined());
  it("keeps plain text", () => expect(p("لامپ ال ای دی").text).toBe("لامپ ال ای دی"));
});
