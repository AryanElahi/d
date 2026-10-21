"use client";

import { useCallback, useEffect, useState } from "react";

// Products picked for comparison; per-browser, max 3, one category at a time.
export type CompareEntry = { id: string; title: string; category: string | null; image: string | null };

const KEY = "kharidyar_compare";
const EVENT = "kharidyar:compare";
export const MAX = 3;

function read(): CompareEntry[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]");
  } catch {
    return [];
  }
}

function write(list: CompareEntry[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {}
  window.dispatchEvent(new Event(EVENT));
}

export type ToggleResult = "added" | "removed" | "full" | "other_category";

export function useCompare() {
  const [list, setList] = useState<CompareEntry[]>([]);
  useEffect(() => {
    const sync = () => setList(read());
    sync();
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const toggle = useCallback((e: CompareEntry, replace = false): ToggleResult => {
    const cur = read();
    if (cur.some((x) => x.id === e.id)) {
      write(cur.filter((x) => x.id !== e.id));
      return "removed";
    }
    if (cur.length && cur[0].category !== e.category) {
      if (!replace) return "other_category";
      write([e]);
      return "added";
    }
    if (cur.length >= MAX) return "full";
    write([...cur, e]);
    return "added";
  }, []);

  const clear = useCallback(() => write([]), []);
  return { list, toggle, clear, has: (id: string) => list.some((x) => x.id === id) };
}
