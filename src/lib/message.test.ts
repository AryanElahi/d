import { describe, expect, it } from "vitest";
import { draftMessage, mobileIntl, smsHref, telHref, whatsappHref } from "./message";

describe("mobileIntl", () => {
  it("Persian-digit mobile", () => expect(mobileIntl("۰۹۳۶۳۰۰۳۶۳۶")).toBe("989363003636"));
  it("already international", () => expect(mobileIntl("+98 936 300 3636")).toBe("989363003636"));
  it("landline has no messenger", () => expect(mobileIntl("۰۲۱۳۹۲۵۵۸۷۳")).toBeNull());
  it("null", () => expect(mobileIntl(null)).toBeNull());
});

describe("links", () => {
  it("tel strips formatting", () => expect(telHref("۰۲۱-۳۹۲۵۵۸۷۳")).toBe("tel:02139255873"));
  it("whatsapp encodes text", () => expect(whatsappHref("989123456789", "سلام ؟")).toBe("https://wa.me/989123456789?text=%D8%B3%D9%84%D8%A7%D9%85%20%D8%9F"));
  it("sms", () => expect(smsHref("989123456789", "a b")).toBe("sms:+989123456789?body=a%20b"));
});

describe("draftMessage", () => {
  it("includes price as recorded, not confirmed", () => {
    const m = draftMessage({ productTitle: "دوربین داهوا", price: 2_480_000, shopName: "x" });
    expect(m).toContain("«دوربین داهوا»");
    expect(m).toContain("۲.۵ میلیون تومان");
    expect(m).toContain("قیمت ثبت‌شده در ترب");
  });
  it("no price", () => expect(draftMessage({ productTitle: "a", price: null, shopName: "x" })).not.toContain("قیمت"));
  it("truncates long titles", () => expect(draftMessage({ productTitle: "ب".repeat(100), price: null, shopName: "x" })).toContain("…"));
});
