// lib/db.ts (Postgres 版 - Neon 友善版本)
import type { Pool, PoolClient, QueryResult, QueryResultRow } from "pg";
import { Pool as PgPool } from "pg";

let _pool: Pool | null = null;

/**
 * 判斷是否為 Neon 雲端資料庫（看 URL）
 */
function isNeonConnection(url?: string | null): boolean {
  return !!url && url.includes("neon.tech");
}

/**
 * 取得單例 Pool
 */
export function getPool(): Pool {
  if (_pool) return _pool;

  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set");
  }

  _pool = new PgPool({
    connectionString: url,
    // Neon 推薦使用 SSL
    ssl: isNeonConnection(url) ? { rejectUnauthorized: false } : undefined,
  });

  return _pool;
}

/**
 * 一般查詢
 */
export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: any[]
): Promise<QueryResult<T>> {
  const pool = getPool();
  const res = await pool.query<T>(text, params);
  return res; // 使用 res.rows 的地方再各自取用
}

/**
 * 交易輔助：確保 BEGIN/COMMIT/ROLLBACK
 */
export async function withTransaction<T>(
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
