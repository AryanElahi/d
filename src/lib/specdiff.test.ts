import { describe, expect, it } from "vitest";
import { diffSpecs } from "./specdiff";

const s = (section: string, key: string, value: string) => ({ section, key, value });

describe("diffSpecs", () => {
  const rows = diffSpecs([
    { specs: [s("کلی", "رنگ", "سفید"), s("تصویر", "رزولوشن", "2MP"), s("کلی", "وزن", "300 گرم")] },
    { specs: [s("کلی", "رنگ", "سفيد"), s("تصویر", "رزولوشن", "5MP"), s("تصویر", "دید در شب", "دارد")] },
  ]);
  const get = (k: string) => rows.find((r) => r.key === k)!;

  it("same value despite Arabic ي is not a difference", () => expect(get("رنگ").differs).toBe(false));
  it("different values differ", () => expect(get("رزولوشن")).toMatchObject({ values: ["2MP", "5MP"], differs: true }));
  it("missing on one side differs and is null", () => expect(get("دید در شب")).toMatchObject({ values: [null, "دارد"], differs: true }));
  it("shared rows first, sections grouped in first-seen order", () =>
    expect(rows.map((r) => [r.key, r.shared])).toEqual([
      ["رنگ", true],
      ["رزولوشن", true],
      ["وزن", false],
      ["دید در شب", false],
    ]));
  it("skips empty values", () => expect(diffSpecs([{ specs: [s("a", "b", " ")] }])).toEqual([]));
  it("joins repeated keys", () => expect(diffSpecs([{ specs: [s("a", "پورت", "USB"), s("a", "پورت", "HDMI")] }])[0].values).toEqual(["USB، HDMI"]));
});
