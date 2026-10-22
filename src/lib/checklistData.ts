import { buildChecklist, GUIDES, type CheckItem } from "./checklist";
import { pool } from "./db";
import { askChecklist } from "./llm";
import { VALID_PRICE } from "./product";

// Facts about this product's listings that a buyer should check in the shop.
export async function getChecklist(p: { id: string; title: string; model: string | null; category: string | null }): Promise<CheckItem[]> {
  const { rows } = await pool.query(
    `SELECT min(o.price_toman) FILTER (WHERE ${VALID_PRICE}) pmin, max(o.price_toman) FILTER (WHERE ${VALID_PRICE}) pmax,
       count(DISTINCT o.shop_id)::int sellers,
       count(DISTINCT o.shop_id) FILTER (WHERE o.seller_title ~ '(طرح|کپی|استوک|ریفربیش|درجه ?یک)')::int copies,
       array_remove(array_agg(DISTINCT o.warranty->>'provider') FILTER (WHERE o.warranty->>'provider' <> 'بدون گارانتی'), NULL) warranties
     FROM offers o WHERE o.product_id = $1`,
    [p.id],
  );
  const r = rows[0];
  const ai = p.category && !GUIDES[p.category] ? await askChecklist(p.category) : null;
  return buildChecklist(
    p.category,
    {
      title: p.title,
      model: p.model,
      priceMin: r.pmin == null ? null : +r.pmin,
      priceMax: r.pmax == null ? null : +r.pmax,
      copyListings: r.copies,
      sellers: r.sellers,
      warranties: r.warranties ?? [],
    },
    ai,
  );
}
