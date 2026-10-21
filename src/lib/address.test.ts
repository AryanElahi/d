import { describe, expect, it } from "vitest";
import { parseAddress } from "./address";

describe("parseAddress", () => {
  it("mall, floor, unit", () =>
    expect(parseAddress("خیابان جمهوری، نبش شیخ هادی، پاساژ علالدین 2، طبقه 6، واحد 622")).toEqual({
      mall: "پاساژ علالدین 2", floor: "6", unit: "622",
    }));
  it("named floor", () => expect(parseAddress("مجتمع تجاری کوروش طبقه همکف پلاک ۱۲").floor).toBe("همکف"));
  it("street only", () =>
    expect(parseAddress("خیابان فردوسی، کوچه بهار")).toEqual({ mall: null, floor: null, unit: null }));
});

describe("parseAddress floors", () => {
  it.each([
    ["طبقه ۴، واحد ۴۲۶", "4", "426"],
    ["طبقه منفی یک، پلاک ۳", "منفی یک", "3"],
    ["طبقه زیر همکف، پلاک 7", "زیر همکف", "7"],
    ["طبقه۳، پلاک۴۰۲", "3", "402"],
  ])("%s", (addr, floor, unit) => {
    const p = parseAddress(addr);
    expect([p.floor, p.unit]).toEqual([floor, unit]);
  });
});
