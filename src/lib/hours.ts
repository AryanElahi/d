// Opening-hours status in Tehran time. Mirrors the SQL shop_open_at(): 00:00-00:00 shifts are empty slots.
import { toFaDigits } from "./normalize";

type Shift = { start_time: string; end_time: string };
type Day = { status: string; shifts: Shift[] };
export type Week = Record<string, Day> | null;

export type HoursState = "open" | "closing_soon" | "closed" | "unknown";
export type HoursNow = { state: HoursState; label: string; today: string | null };

const DAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

function tehranNow(now: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Tehran",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  return { day: get("weekday").toLowerCase(), min: +get("hour") * 60 + +get("minute") };
}

const toMin = (t: string) => +t.slice(0, 2) * 60 + +t.slice(3, 5);
const hhmm = (m: number) => toFaDigits(`${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`);

export function hoursNow(week: Week, now = new Date()): HoursNow {
  const { day, min } = tehranNow(now);
  const d = week?.[day];
  if (!d || !DAYS.includes(day)) return { state: "unknown", label: "ساعت کاری ثبت نشده", today: null };
  if (d.status === "closed") return { state: "closed", label: "امروز تعطیل است", today: "تعطیل" };
  const shifts = d.status === "declared" ? d.shifts.filter((s) => s.start_time !== s.end_time) : [];
  if (!shifts.length) return { state: "unknown", label: "ساعت کاری ثبت نشده", today: null };

  const ranges = shifts
    .map((s) => {
      const st = toMin(s.start_time);
      let en = toMin(s.end_time);
      if (en <= st) en += 1440; // overnight
      return [st, en] as const;
    })
    .sort((a, b) => a[0] - b[0]);
  const today = ranges.map(([st, en]) => `${hhmm(st)} تا ${hhmm(en)}`).join(" و ");

  for (const [st, en] of ranges) {
    if (min >= st && min < en) {
      const left = en - min;
      if (left <= 60) return { state: "closing_soon", label: `${toFaDigits(left)} دقیقه دیگر می‌بندد`, today };
      return { state: "open", label: `باز است تا ${hhmm(en)}`, today };
    }
  }
  const next = ranges.find(([st]) => st > min);
  if (next) return { state: "closed", label: `الان بسته · از ${hhmm(next[0])} باز می‌شود`, today };
  return { state: "closed", label: `امروز بسته شده · تا ${hhmm(ranges.at(-1)![1])} باز بود`, today };
}
