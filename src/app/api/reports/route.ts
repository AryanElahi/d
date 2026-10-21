import { NextRequest, NextResponse } from "next/server";
import { addReport, STATUSES } from "@/lib/followup";
import type { Status } from "@/lib/message";

// POST { deviceId, offerId, status, reportedPrice? } → one row in user_reports.
export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => null);
  const deviceId = typeof b?.deviceId === "string" ? b.deviceId : "";
  const offerId = typeof b?.offerId === "string" ? b.offerId : "";
  const status = b?.status as Status;
  const price = b?.reportedPrice == null ? null : Number(b.reportedPrice);
  if (!/^[\w-]{8,64}$/.test(deviceId) || !/^offer_\w{1,40}$/.test(offerId) || !STATUSES.includes(status))
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  if (price != null && !(Number.isInteger(price) && price >= 1000 && price <= 1e11))
    return NextResponse.json({ error: "bad_price" }, { status: 400 });
  const ok = await addReport({ deviceId, offerId, status, reportedPrice: price });
  return ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "unknown_offer" }, { status: 404 });
}
