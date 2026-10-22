import { describe, expect, it } from "vitest";
import { pickCategory } from "./hubs";

const cats = ["گوشی موبایل", "کیف و کاور گوشی", "یخچال و فریزر", "یخچال", "لوستر و چراغ تزئینی"];

describe("pickCategory", () => {
  it("explicit filter preferred", () => expect(pickCategory("یخچال", ["گوشی موبایل"], "x", cats).preferred).toBe("یخچال"));
  it("most common among top results", () =>
    expect(pickCategory(undefined, ["کیف و کاور گوشی", "گوشی موبایل", "گوشی موبایل", null], "", cats).preferred).toBe("گوشی موبایل"));
  it("text candidates by whole words («بای» ≠ «موبایل»)", () =>
    expect(pickCategory(undefined, [], "یخچال ساید بای ساید", cats)).toEqual({ preferred: undefined, candidates: ["یخچال", "یخچال و فریزر"] }));
  it("short tokens ignored", () => expect(pickCategory(undefined, [], "تو یه", cats).candidates).toEqual([]));
});
