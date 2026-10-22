"use client";

import { ChevronDown, Copy, FlaskConical, MessageCircle, MessageSquareText, Phone, Send, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { deviceId, report } from "@/lib/device";
import { draftMessage, mobileIntl, smsHref, telHref, whatsappHref, type Status } from "@/lib/message";
import type { Ask, SimReply } from "@/lib/simulate";
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

type Msg = { from: "me" | "seller"; text: string };

const QUICK: [Ask, string][] = [
  ["hold", "برام نگه دارید، امروز میام."],
  ["warranty", "گارانتی‌اش چیه؟"],
];

const chatKey = (offerId: string) => `kharidyar_chat_${offerId}`;
const loadChat = (offerId: string): Msg[] => {
  try {
    return JSON.parse(localStorage.getItem(chatKey(offerId)) ?? "[]");
  } catch {
    return [];
  }
};

// Dataset phone numbers are fake, so the inquiry runs as a clearly-labelled simulated chat whose
// replies come from this seller's data. Real messengers stay available underneath.
export function FollowUpSheet({ open, onClose, offerId, shopName, phone, price, productTitle, status }: Props) {
  const [text, setText] = useState("");
  const [chat, setChat] = useState<Msg[]>([]);
  const [typing, setTyping] = useState(false);
  const [outcome, setOutcome] = useState<Status | undefined>(status);
  const [asked, setAsked] = useState<Ask[]>([]);
  const [showReal, setShowReal] = useState(false);
  const [copied, setCopied] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setText(draftMessage({ productTitle, price, shopName }));
    setChat(loadChat(offerId));
  }, [open, offerId, productTitle, price, shopName]);

  useEffect(() => setOutcome(status), [status]);

  useEffect(() => {
    try {
      if (chat.length) localStorage.setItem(chatKey(offerId), JSON.stringify(chat));
    } catch {}
    end.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [chat, typing, offerId]);

  const ask = async (kind: Ask, message: string) => {
    setErr(null);
    setChat((c) => [...c, { from: "me", text: message }]);
    setTyping(true);
    try {
      const started = Date.now();
      const res = await fetch("/api/simulate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ deviceId: deviceId(), offerId, ask: kind, lastOutcome: outcome }),
      });
      if (!res.ok) throw new Error(String(res.status));
      const r: SimReply = await res.json();
      await new Promise((ok) => setTimeout(ok, Math.max(0, r.delayMs - (Date.now() - started))));
      setChat((c) => [...c, { from: "seller", text: r.text }]);
      if (r.outcome) {
        setOutcome(r.outcome);
        window.dispatchEvent(new Event("kharidyar:tracked")); // server recorded it; refresh lists
      }
      if (kind !== "stock") setAsked((a) => [...a, kind]);
    } catch {
      setErr("پیام ارسال نشد؛ دوباره امتحان کنید.");
    } finally {
      setTyping(false);
    }
  };

  const intl = mobileIntl(phone);
  const contactedReal = () => {
    if (!status || status === "saved") report(offerId, "contacted").catch(() => {});
  };
  const started = chat.length > 0;

  // Portal: the card may be dimmed (opacity), which would dim the sheet too.
  if (typeof document === "undefined") return null;
  return createPortal(
    <div className={`fixed inset-0 z-40 ${open ? "" : "pointer-events-none"}`} aria-hidden={!open}>
      <div className={`absolute inset-0 bg-black/30 transition-opacity ${open ? "opacity-100" : "opacity-0"}`} onClick={onClose} />
      <div
        className={`absolute inset-x-0 bottom-0 mx-auto max-h-[90vh] max-w-md overflow-y-auto rounded-t-3xl bg-white p-4 pb-8 shadow-xl transition-transform ${open ? "translate-y-0" : "translate-y-full"}`}
      >
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-base font-bold">استعلام از {shopName}</h2>
          <button onClick={onClose} className="rounded-full p-1.5 hover:bg-neutral-100" aria-label="بستن"><X className="size-5" /></button>
        </div>

        <p className="flex items-start gap-1.5 rounded-xl bg-indigo-50 p-2.5 text-[11px] leading-5 text-indigo-900">
          <FlaskConical className="mt-0.5 size-3.5 shrink-0" />
          <span>
            <strong>گفت‌وگوی شبیه‌سازی‌شده.</strong> شماره‌های دیتاست نمونه‌اند؛ پاسخ فروشنده از روی داده‌های همین فروشنده ساخته می‌شود (قیمت و تاریخ ثبت آن،
            ساعت کاری، گارانتی، گزارش کاربران) و به دیگران نشان داده نمی‌شود.
          </span>
        </p>

        {started && (
          <div className="mt-3 flex flex-col gap-2 rounded-2xl bg-neutral-50 p-3" aria-live="polite">
            {chat.map((m, i) => (
              <p
                key={i}
                className={`max-w-[85%] whitespace-pre-line rounded-2xl px-3 py-2 text-sm leading-6 ${
                  m.from === "me" ? "self-start rounded-tr-sm bg-teal-600 text-white" : "self-end rounded-tl-sm bg-white ring-1 ring-black/5"
                }`}
              >
                {m.text}
              </p>
            ))}
            {typing && (
              <p className="self-end rounded-2xl rounded-tl-sm bg-white px-3 py-2 text-xs text-neutral-500 ring-1 ring-black/5">
                {shopName} در حال نوشتن<span className="animate-pulse">…</span>
              </p>
            )}
            <div ref={end} />
          </div>
        )}

        {!started ? (
          <div className="mt-3">
            <label className="text-xs font-semibold text-neutral-600" htmlFor={`msg-${offerId}`}>متن پیام (قابل ویرایش)</label>
            <textarea
              id={`msg-${offerId}`}
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={4}
              className="mt-1 w-full rounded-xl border border-neutral-200 p-3 text-sm leading-6"
            />
            <button
              disabled={!text.trim() || typing}
              onClick={() => ask("stock", text.trim())}
              className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl bg-teal-600 py-2.5 text-sm font-medium text-white disabled:opacity-50"
            >
              <Send className="size-4" />
              ارسال به فروشنده
            </button>
          </div>
        ) : (
          !typing &&
          (outcome === "confirmed" || outcome === "price_changed") && (
            <div className="mt-2 flex flex-wrap gap-2">
              {QUICK.filter(([k]) => !asked.includes(k)).map(([k, label]) => (
                <button key={k} onClick={() => ask(k, label)} className="rounded-full bg-white px-3 py-1.5 text-xs ring-1 ring-teal-600 text-teal-800">
                  {label}
                </button>
              ))}
            </div>
          )
        )}
        {err && <p className="mt-2 text-xs text-rose-700">{err}</p>}

        {started && !typing && (
          <div className="mt-4 border-t border-neutral-100 pt-4">
            <StatusButtons offerId={offerId} status={outcome} title="نتیجه (اگر درست نیست، تغییرش دهید)" />
          </div>
        )}

        <div className="mt-4">
          <button onClick={() => setShowReal((x) => !x)} className="flex w-full items-center justify-between text-xs text-neutral-500">
            ارسال واقعی با پیام‌رسان یا تماس
            <ChevronDown className={`size-4 transition ${showReal ? "rotate-180" : ""}`} />
          </button>
          {showReal && (
            <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
              {intl ? (
                <>
                  <a href={whatsappHref(intl, text)} target="_blank" rel="noreferrer" onClick={contactedReal} className="flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 py-2.5 font-medium text-white">
                    <MessageCircle className="size-4" />واتساپ
                  </a>
                  <a href={smsHref(intl, text)} onClick={contactedReal} className="flex items-center justify-center gap-1.5 rounded-xl bg-white py-2.5 font-medium ring-1 ring-black/10">
                    <MessageSquareText className="size-4" />پیامک
                  </a>
                </>
              ) : (
                <p className="col-span-2 rounded-xl bg-neutral-50 p-2 text-neutral-600">شماره ثبت‌شده تلفن ثابت است؛ پیام‌رسان ندارد.</p>
              )}
              <button
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(text);
                    setCopied(true);
                  } catch {}
                  contactedReal();
                }}
                className="flex items-center justify-center gap-1.5 rounded-xl bg-white py-2.5 font-medium ring-1 ring-black/10"
              >
                <Copy className="size-4" />{copied ? "کپی شد" : "کپی برای بله"}
              </button>
              {phone && (
                <a href={telHref(phone)} onClick={contactedReal} className="flex flex-col items-center justify-center rounded-xl bg-white py-1.5 ring-1 ring-black/10">
                  <span className="flex items-center gap-1.5 font-medium"><Phone className="size-4" />تماس</span>
                  <span className="text-[10px] text-neutral-400">شماره نمونه</span>
                </a>
              )}
              <p className="col-span-2 text-[10px] text-neutral-400">شماره‌های این نسخه نمونه‌اند؛ این گزینه‌ها برای نسخه واقعی است.</p>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
