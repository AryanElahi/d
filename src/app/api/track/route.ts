import { NextRequest, NextResponse } from "next/server";
import { trackedFor } from "@/lib/followup";

export async function GET(req: NextRequest) {
  const device = req.nextUrl.searchParams.get("device") ?? "";
  if (!/^[\w-]{8,64}$/.test(device)) return NextResponse.json({ error: "bad_request" }, { status: 400 });
  return NextResponse.json({ items: await trackedFor(device) });
}
