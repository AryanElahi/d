"use client";

import { LocateFixed } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

// Puts the user's position into the URL so the server page recomputes distances.
export function LocateButton({ label = "فاصله از موقعیت من" }: { label?: string }) {
  const router = useRouter();
  const path = usePathname();
  const [msg, setMsg] = useState<string | null>(null);

  return (
    <div>
      <button
        onClick={() => {
          if (!navigator.geolocation) return setMsg("مرورگر شما موقعیت‌یابی ندارد.");
          setMsg("در حال گرفتن موقعیت…");
          navigator.geolocation.getCurrentPosition(
            (p) => router.replace(`${path}?lat=${p.coords.latitude}&lon=${p.coords.longitude}&place=${encodeURIComponent("موقعیت شما")}`),
            () => setMsg("به موقعیت شما دسترسی نداریم."),
            { timeout: 8000 },
          );
        }}
        className="flex items-center gap-1 rounded-full bg-white px-3 py-1.5 text-xs ring-1 ring-black/10"
      >
        <LocateFixed className="size-3.5" />
        {label}
      </button>
      {msg && <p className="mt-1 text-[11px] text-neutral-500">{msg}</p>}
    </div>
  );
}
