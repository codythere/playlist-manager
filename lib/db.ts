// lib/db.ts (Postgres 版 - Neon 友善版本)
import { Pool, PoolClient } from "pg";

let _pool: Pool | null = null;

/**
 * 判斷是否為 Neon 雲端資料庫（看 URL 是否包含 neon.tech）
 */
function isNeonConnection(url?: string | null): boolean {
  return !!url && url.includes("neon.tech");
}

export function getPool() {
  if (!_pool) {
    const url = process.env.DATABASE_URL ?? "";
    const isNeon = isNeonConnection(url);

    _pool = new Pool({
      connectionString: url,
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,

      // Neon → 必須使用 SSL
      // 本機（localhost / Docker）→ 禁用 SSL
      ssl: isNeon ? { rejectUnauthorized: false } : false,
    });
  }
  return _pool;
}

/**
 * 一般查詢
 */
export async function query<T = any>(text: string, params?: any[]) {
  const pool = getPool();
  const res = await pool.query<T>(text, params);
  return res; // 使用 res.rows
}

/**
 * 交易（與原本的行為完全一致）
 */
export async function withTransaction<T>(
  fn: (client: PoolClient) => Promise<T>
) {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}
