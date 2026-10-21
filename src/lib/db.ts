import { Pool } from "pg";

// Small pool: Liara's Postgres has a low connection limit and filter changes fire many requests.
const g = globalThis as unknown as { pool?: Pool };
export const pool = (g.pool ??= new Pool({ connectionString: process.env.DATABASE_URL, max: 5 }));
