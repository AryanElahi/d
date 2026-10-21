import { describe, expect, it } from "vitest";
import { matchCategory, mergeLlm, parseLlmJson, shouldAskLlm } from "./llm";
import { parseQuery, type Vocab } from "./parser";

const vocab: Vocab = {
  areas: ["فردوسی", "شیخ هادی", "جمهوری"],
  brands: ["داهوا", "سامسونگ"],
  categories: ["دوربین مدار بسته", "دوربین عکاسی", "کیف و کاور گوشی", "گوشی موبایل"],
};
const p = (q: string) => parseQuery(q, vocab);

describe("shouldAskLlm", () => {
  it("not for clear queries", () => expect(shouldAskLlm("دوربین مدار بسته داهوا", p("دوربین مدار بسته داهوا"))).toBe(false));
  it("not for short keyword", () => expect(shouldAskLlm("هندزفری", p("هندزفری"))).toBe(false));
  it("need-based sentence", () => {
    const q = "یه چیزی برای ضبط تصویر جلوی مغازه";
    expect(shouldAskLlm(q, p(q))).toBe(true);
  });
  it("long descriptive query", () => {
    const q = "گوشی ساده با باتری قوی و دکمه درشت";
    expect(shouldAskLlm(q, p(q))).toBe(true);
  });
});

describe("parseLlmJson", () => {
  it("plain", () => expect(parseLlmJson('{"keywords":"دوربین"}')).toEqual({ keywords: "دوربین" }));
  it("fenced", () => expect(parseLlmJson('```json\n{"area":"فردوسی"}\n```')).toEqual({ area: "فردوسی" }));
  it("garbage", () => expect(parseLlmJson("sorry")).toBeNull());
  it("broken json", () => expect(parseLlmJson("{keywords:")).toBeNull());
});

describe("matchCategory", () => {
  it("exact", () => expect(matchCategory("دوربین مدار بسته", vocab.categories)).toBe("دوربین مدار بسته"));
  it("Arabic letters", () => expect(matchCategory("گوشي موبايل", vocab.categories)).toBe("گوشی موبایل"));
  it("too vague", () => expect(matchCategory("دوربین", vocab.categories)).toBeUndefined());
  it("unknown", () => expect(matchCategory("یخچال", vocab.categories)).toBeUndefined());
});

describe("mergeLlm", () => {
  it("rules win, LLM fills gaps, vocab-checked", () => {
    const rule = p("یه چیزی برای جلوی مغازه زیر ۳ میلیون");
    const f = mergeLlm(
      rule,
      { keywords: "دوربین مدار بسته", category: "دوربین مدار بسته", brand: "هایک", area: "ونک", budget_max: 9_000_000, open_now: true, sort: "price" },
      vocab,
      true,
    );
    expect(f.budgetMax).toBe(3_000_000); // rule's budget kept
    expect(f.category).toBe("دوربین مدار بسته");
    expect(f.brand).toBeUndefined(); // not in vocab
    expect(f.area).toBeUndefined(); // not in vocab
    expect(f.openNow).toBe(true);
    expect(f.sort).toBe("price");
    expect(f.text).toBe(""); // covered by the category
  });
  it("keeps rule text unless replacing", () => {
    expect(mergeLlm(p("گوشی ساده"), { keywords: "گوشی موبایل ساده" }, vocab, false).text).toBe("گوشی ساده");
  });
  it("drops inverted budget", () => {
    expect(mergeLlm(p("گوشی زیر ۵ میلیون"), { budget_min: 9_000_000 }, vocab, false).budgetMin).toBeUndefined();
  });
});
