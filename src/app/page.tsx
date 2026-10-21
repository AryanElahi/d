import { SearchApp } from "@/components/SearchApp";
import { pool } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function Home() {
  const { rows } = await pool.query<{ name: string }>("SELECT name FROM areas ORDER BY shop_count DESC, name");
  return <SearchApp areas={rows.map((r) => r.name)} />;
}
