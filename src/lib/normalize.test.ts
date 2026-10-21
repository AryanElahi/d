import { describe, expect, it } from "vitest";
import { normalizeFa, toFaDigits } from "./normalize";

const fixtures: [string, string][] = [
  ["گوشي سامسونگ", "گوشی سامسونگ"],
  ["کيبورد كامپيوتر", "کیبورد کامپیوتر"],
  ["لپ‌تاپ", "لپ تاپ"],
  ["طبقه ۶، واحد ۶۲۲", "طبقه 6 واحد 622"],
  ["  Galaxy  A55 ", "galaxy a55"],
  ["آداپتور", "اداپتور"],
];

describe("normalizeFa", () => {
  it.each(fixtures)("%s", (input, out) => expect(normalizeFa(input)).toBe(out));
  it("handles null", () => expect(normalizeFa(null)).toBe(""));
});

describe("toFaDigits", () => {
  it("converts", () => expect(toFaDigits(1234)).toBe("۱۲۳۴"));
});
