"use client";

import { useCallback, useEffect, useState } from "react";
import { deviceId } from "@/lib/device";
import type { Tracked } from "@/lib/followup";

// This browser's follow-up list; refreshes whenever a report is sent anywhere on the page.
export function useTracked() {
  const [items, setItems] = useState<Tracked[] | null>(null);
  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/track?device=${encodeURIComponent(deviceId())}`);
      if (res.ok) setItems((await res.json()).items);
    } catch {
      setItems((x) => x ?? []);
    }
  }, []);
  useEffect(() => {
    load();
    window.addEventListener("kharidyar:tracked", load);
    return () => window.removeEventListener("kharidyar:tracked", load);
  }, [load]);
  return { items, reload: load };
}
