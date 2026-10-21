"use client";

import { Copy, MessageCircle, MessageSquareText, Phone, X } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { report } from "@/lib/device";
import { draftMessage, mobileIntl, smsHref, telHref, whatsappHref, type Status } from "@/lib/message";
import { StatusButtons } from "./StatusButtons";

type Props = {
  open: boolean;
  onClose: () => void;
  offerId: string;
  shopName: string;
  phone: string | null;
  price: number | null;
  productTitle: string;
  status?: Status;
};

// Step 1: send an editable stock-check message. Step 2: record the answer (alternatives follow if needed).
export function FollowUpSheet({ open, onClose, offerId, shopName, phone, price, productTitle, status }: Props) {
  const [text, setText] = useState("");
  const [sent, setSent] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (open) {
      setText(draftMessage({ productTitle, price, shopName }));
      setSent(!!status && status !== "saved");
      setCopied(false);
    }
  }, [open, productTitle, price, shopName, status]);

  const intl = mobileIntl(phone);
  const contacted = () => {
    setSent(true);
    if (!status || status === "saved") report(offerId, "contacted").catch(() => {});
  };

  // Portal: the card may be dimmed (opacity), which would dim the sheet too.
  if (typeof document === "undefined") return null;
  return createPortal(
    <div className={`fixed inset-0 z-40 ${open ? "" : "pointer-events-none"}`} aria-hidden={!open}>
      <div className={`absolute inset-0 bg-black/30 transition-opacity ${open ? "opacity-100" : "opacity-0"}`} onClick={onClose} />
      <div
        className={`absolute inset-x-0 bottom-0 mx-auto max-h-[90vh] max-w-md overflow-y-auto rounded-t-3xl bg-white p-4 pb-8 shadow-xl transition-transform ${open ? "translate-y-0" : "translate-y-full"}`}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-bold">استعلام از {shopName}</h2>
          <button onClick={onClose} className="rounded-full p-1.5 hover:bg-neutral-100" aria-label="بستن"><X className="size-5" /></button>
        </div>

        <label className="text-xs font-semibold text-neutral-600" htmlFor={`msg-${offerId}`}>متن پیام (قابل ویرایش)</label>
        <textarea
          id={`msg-${offerId}`}
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={4}
          className="mt-1 w-full rounded-xl border border-neutral-200 p-3 text-sm leading-6"
        />

        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
          {intl ? (
            <>
              <a href={whatsappHref(intl, text)} target="_blank" rel="noreferrer" onClick={contacted} className="flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 py-2.5 font-medium text-white">
                <MessageCircle className="size-4" />واتساپ
              </a>
              <a href={smsHref(intl, text)} onClick={contacted} className="flex items-center justify-center gap-1.5 rounded-xl bg-white py-2.5 font-medium ring-1 ring-black/10">
                <MessageSquareText className="size-4" />پیامک
              </a>
            </>
          ) : (
            <p className="col-span-2 rounded-xl bg-neutral-50 p-2 text-neutral-600">شماره ثبت‌شده تلفن ثابت است؛ پیام‌رسان ندارد. تماس بگیرید یا متن را کپی کنید.</p>
          )}
          <button
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(text);
                setCopied(true);
              } catch {}
              contacted();
            }}
            className="flex items-center justify-center gap-1.5 rounded-xl bg-white py-2.5 font-medium ring-1 ring-black/10"
          >
            <Copy className="size-4" />{copied ? "کپی شد" : "کپی برای بله"}
          </button>
          {phone && (
            <a href={telHref(phone)} onClick={contacted} className="flex flex-col items-center justify-center rounded-xl bg-white py-1.5 ring-1 ring-black/10">
              <span className="flex items-center gap-1.5 font-medium"><Phone className="size-4" />تماس</span>
              <span className="text-[10px] text-neutral-400">شماره نمونه</span>
            </a>
          )}
        </div>
        <p className="mt-2 text-[11px] leading-5 text-neutral-500">
          شماره‌های این نسخه نمونه‌اند. بعد از ارسال، این فروشنده به «پیگیری‌ها» اضافه می‌شود تا جوابش را ثبت کنید.
        </p>

        {sent && (
          <div className="mt-4 border-t border-neutral-100 pt-4">
            <StatusButtons offerId={offerId} status={status} />
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
