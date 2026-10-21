"use client";

import { useEffect, useState } from "react";
import { mapsUrl } from "@/lib/format";

type Props = { lat: number; lon: number; className?: string; children: React.ReactNode; "aria-label"?: string };

export function MapLink({ lat, lon, children, ...rest }: Props) {
  const [android, setAndroid] = useState(false);
  useEffect(() => setAndroid(/Android/i.test(navigator.userAgent)), []);
  return (
    <a href={mapsUrl(lat, lon, android)} target="_blank" rel="noreferrer" {...rest}>
      {children}
    </a>
  );
}
