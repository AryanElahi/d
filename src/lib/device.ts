"use client";

// Anonymous per-browser id for follow-up tracking. No account, nothing personal.
const KEY = "kharidyar_device";

export function deviceId(): string {
  try {
    let id = localStorage.getItem(KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    return "anonymous-session";
  }
}

export async function report(offerId: string, status: string, reportedPrice?: number) {
  const res = await fetch("/api/reports", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ deviceId: deviceId(), offerId, status, reportedPrice }),
  });
  if (!res.ok) throw new Error(String(res.status));
  window.dispatchEvent(new Event("kharidyar:tracked"));
}
