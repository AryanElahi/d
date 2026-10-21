// Spec table for comparing products of one category: union of keys, flagging rows that differ.
// Specs are free-form per product, so rows recorded for every product ("shared") come first.
import { normalizeFa } from "./normalize";

export type Spec = { section: string; key: string; value: string };
export type SpecRow = { section: string; key: string; values: (string | null)[]; differs: boolean; shared: boolean };

export function diffSpecs(products: { specs: Spec[] }[]): SpecRow[] {
  const order: string[] = [];
  const rows = new Map<string, SpecRow>();
  products.forEach((p, i) => {
    for (const s of p.specs) {
      if (!s.value?.trim()) continue;
      const id = `${s.section}|${s.key}`;
      let row = rows.get(id);
      if (!row) {
        row = { section: s.section, key: s.key, values: products.map(() => null), differs: false, shared: false };
        rows.set(id, row);
        order.push(id);
      }
      row.values[i] = row.values[i] ? `${row.values[i]}، ${s.value}` : s.value;
    }
  });
  for (const row of rows.values()) {
    const norm = row.values.map((v) => (v == null ? null : normalizeFa(v)));
    row.differs = norm.some((v) => v !== norm[0]);
    row.shared = norm.every((v) => v != null);
  }
  // Keep each section together, sections in first-seen order.
  const sections = [...new Set(order.map((id) => rows.get(id)!.section))];
  const grouped = sections.flatMap((sec) => order.map((id) => rows.get(id)!).filter((r) => r.section === sec));
  return [...grouped.filter((r) => r.shared), ...grouped.filter((r) => !r.shared)];
}
