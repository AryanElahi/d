import { NextRequest, NextResponse } from "next/server";
import { alternatives } from "@/lib/followup";

export async function GET(req: NextRequest) {
  const offerId = req.nextUrl.searchParams.get("offer") ?? "";
  const device = req.nextUrl.searchParams.get("device");
  if (!/^offer_\w{1,40}$/.test(offerId)) return NextResponse.json({ error: "bad_request" }, { status: 400 });
  const alts = await alternatives(offerId, device && /^[\w-]{8,64}$/.test(device) ? device : null);
  return alts ? NextResponse.json(alts) : NextResponse.json({ error: "unknown_offer" }, { status: 404 });
}
