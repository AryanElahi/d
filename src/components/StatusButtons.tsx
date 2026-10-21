"use client";

import { Check, PackageX, ShoppingBag, Tag } from "lucide-react";
import { useState } from "react";
import { report } from "@/lib/device";
import type { Status } from "@/lib/message";
import { Alternatives } from "./Alternatives";

type Props = { offerId: string; status?: Status; title?: string; showAlternatives?: boolean };

// One tap records what the shop said (or what happened at the visit). "Not there" / "different price"
// immediately bring up alternatives.
export function StatusButtons({ offerId, status, title = "جواب فروشنده یا نتیجه مراجعه؟", showAlternatives = true }: Props) {
  const [pending, setPending] = useState(false);
  const [priceOpen, setPriceOpen] = useState(false);
  const [price, setPrice] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const send = async (s: Status, reportedPrice?: number) => {
    setPending(true);
    setErr(null);
    try {
      await report(offerId, s, reportedPrice);
      setPriceOpen(false);
    } catch {
      setErr("ثبت نشد؛ دوباره امتحان کنید.");
    } finally {
      setPending(false);
    }
  };

  const btn = (s: Status, label: string, Icon: typeof Check, cls: string, onClick?: () => void) => (
    <button
      disabled={pending}
      onClick={onClick ?? (() => send(s))}
      className={`flex items-center justify-center gap-1 rounded-xl px-2 py-2 text-xs ring-1 disabled:opacity-50 ${status === s ? "font-semibold ring-2 " + cls : "ring-black/10"}`}
    >
      <Icon className="size-3.5" />
      {label}
    </button>
  );

  return (
    <div>
      <p className="mb-2 text-xs font-semibold text-neutral-600">{title}</p>
      <div className="grid grid-cols-2 gap-2">
        {btn("confirmed", "موجود است", Check, "ring-emerald-500 text-emerald-800")}
        {btn("unavailable", "ناموجود بود", PackageX, "ring-rose-500 text-rose-800")}
        {btn("price_changed", "قیمت فرق داشت", Tag, "ring-amber-500 text-amber-800", () => setPriceOpen((o) => !o))}
        {btn("bought", "خریدم", ShoppingBag, "ring-teal-500 text-teal-800")}
      </div>
      {priceOpen && (
        <form
          className="mt-2 flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const v = Number(price.replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d))).replace(/[٫/]/g, "."));
            if (!(v > 0)) return setErr("قیمت را به میلیون تومان بنویسید؛ مثلاً ۲.۷");
            send("price_changed", Math.round(v * 1e6));
          }}
        >
          <input
            inputMode="decimal"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="قیمت گفته‌شده (میلیون تومان)"
            className="min-w-0 flex-1 rounded-xl border border-neutral-200 px-3 py-2 text-xs"
            autoFocus
          />
          <button disabled={pending} className="rounded-xl bg-amber-600 px-3 py-2 text-xs text-white">ثبت</button>
        </form>
      )}
      {err && <p className="mt-2 text-xs text-rose-700">{err}</p>}
      {showAlternatives && (status === "unavailable" || status === "price_changed") && (
        <div className="mt-3">
          <Alternatives offerId={offerId} />
        </div>
      )}
    </div>
  );
}
