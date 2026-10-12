import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL || "postgresql://gid:gid@127.0.0.1:5432/graceindesign";

declare global {
  var __gidPool: Pool | undefined;
}

function createPool() {
  const needsSsl = /neon\.tech|sslmode=require|\.replit\.dev|amazonaws\.com|supabase\.co/i.test(connectionString) && !/localhost|127\.0\.0\.1/.test(connectionString);
  return new Pool({
    connectionString,
    max: Number(process.env.PG_POOL_MAX || 5),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    ssl: needsSsl ? { rejectUnauthorized: false } : undefined,
  });
}

export const pool: Pool = global.__gidPool ?? createPool();
if (process.env.NODE_ENV !== "production") global.__gidPool = pool;

export const db: NodePgDatabase<typeof schema> = drizzle(pool, { schema });
export { schema };
export * from "./schema";
