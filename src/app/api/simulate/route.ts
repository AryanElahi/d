import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { addReport, STATUSES } from "@/lib/followup";
import { ageDays } from "@/lib/format";
import { hoursNow, type Week } from "@/lib/hours";
import type { Status } from "@/lib/message";
import { VALID_PRICE } from "@/lib/product";
import { simulateReply, type Ask } from "@/lib/simulate";

const ASKS: Ask[] = ["stock", "hold", "warranty"];

// POST { deviceId, offerId, ask, lastOutcome? } → simulated seller reply.
// A stock answer is also recorded for this device (simulated = true, never shown to others).
export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => null);
  const deviceId = typeof b?.deviceId === "string" ? b.deviceId : "";
  const offerId = typeof b?.offerId === "string" ? b.offerId : "";
  const ask = b?.ask as Ask;
  const last = STATUSES.includes(b?.lastOutcome) ? (b.lastOutcome as Status) : undefined;
  if (!/^[\w-]{8,64}$/.test(deviceId) || !/^offer_\w{1,40}$/.test(offerId) || !ASKS.includes(ask))
    return NextResponse.json({ error: "bad_request" }, { status: 400 });

  const { rows } = await pool.query(
    `SELECT CASE WHEN ${VALID_PRICE} THEN o.price_toman END price, o.last_price_changed_at, o.warranty, s.weekly_hours,
       (SELECT count(*)::int FROM user_reports r WHERE r.offer_id = o.offer_id AND r.status = 'unavailable'
          AND NOT r.simulated AND r.created_at > now() - interval '30 days') others_unavailable
     FROM offers o JOIN shops s ON s.shop_id = o.shop_id WHERE o.offer_id = $1`,
    [offerId],
  );
  if (!rows.length) return NextResponse.json({ error: "unknown_offer" }, { status: 404 });
  const o = rows[0];
  const now = new Date();
  const reply = simulateReply(
    {
      offerId,
      day: now.toLocaleDateString("en-CA", { timeZone: "Asia/Tehran" }),
      price: o.price == null ? null : +o.price,
      priceAgeDays: ageDays(o.last_price_changed_at?.toISOString()),
      hours: hoursNow(o.weekly_hours as Week, now),
      othersUnavailable: o.others_unavailable,
      warranty: o.warranty,
    },
    ask,
    last,
  );
  if (ask === "stock" && reply.outcome)
    await addReport({ deviceId, offerId, status: reply.outcome, reportedPrice: reply.reportedPrice ?? null, simulated: true });
  return NextResponse.json(reply);
}
