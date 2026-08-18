// lib/google.ts（節錄：改 DB 部分；其餘保留）
import "server-only";
import { google } from "googleapis";
import type { OAuth2Client, Credentials } from "google-auth-library";
import type { youtube_v3 } from "googleapis";
import { logger } from "./logger";
import { query } from "@/lib/db";

const APP_BASE_URL = process.env.APP_BASE_URL ?? "http://localhost:3000";

const { GOOGLE_CLIENT_ID = "", GOOGLE_CLIENT_SECRET = "" } = process.env;

// 用 APP_BASE_URL 自動組出 redirect URI
const GOOGLE_REDIRECT_URI =
  process.env.GOOGLE_REDIRECT_URI ??
  `${APP_BASE_URL.replace(/\/$/, "")}/api/auth/callback`;

export interface StoredTokens {
  user_id: string;
  access_token: string | null;
  refresh_token: string | null;
  scope: string | null;
  token_type: string | null;
  expiry_date: number | null; // epoch ms
  id_token: string | null;
  updated_at: number | null; // epoch ms
}

export function isGoogleConfigured(): boolean {
  return !!(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET && GOOGLE_REDIRECT_URI);
}

function getOAuthClient(): OAuth2Client {
  return new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI,
  );
}

export function buildAuthUrl(state: string): string | null {
  if (!isGoogleConfigured()) return null;
  const oauth2 = getOAuthClient();
  const scopes = [
    "openid",
    // "https://www.googleapis.com/auth/userinfo.email",
    // "https://www.googleapis.com/auth/youtube",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/youtube.readonly",
    "https://www.googleapis.com/auth/youtube.force-ssl",
  ];
  return oauth2.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: true,
    scope: scopes,
    state,
  });
}

export async function exchangeCodeForTokens(
  code: string,
): Promise<Credentials> {
  const oauth2 = getOAuthClient();
  const { tokens } = await oauth2.getToken(code);
  return tokens;
}

export async function getEmailFromTokens(
  tokens: Credentials,
): Promise<string | null> {
  const oauth2 = getOAuthClient();
  oauth2.setCredentials(tokens);
  const oauth = google.oauth2("v2");
  const me = await oauth.userinfo.get({ auth: oauth2 as any });
  return me.data.email ?? null;
}

/* ===================== PG 版 Token 存取 ===================== */

async function ensureUserTokensTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS user_tokens (
      user_id TEXT PRIMARY KEY,
      access_token  TEXT,
      refresh_token TEXT,
      scope         TEXT,
      token_type    TEXT,
      expiry_date   BIGINT,
      id_token      TEXT,
      updated_at    BIGINT
    )
  `);
}

export async function saveUserTokens(
  userId: string,
  tokens: Credentials,
): Promise<void> {
  await ensureUserTokensTable();
  await query(
    `INSERT INTO user_tokens (user_id, access_token, refresh_token, scope, token_type, expiry_date, id_token, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     ON CONFLICT (user_id) DO UPDATE SET
       access_token  = EXCLUDED.access_token,
       refresh_token = COALESCE(EXCLUDED.refresh_token, user_tokens.refresh_token),
       scope         = EXCLUDED.scope,
       token_type    = EXCLUDED.token_type,
       expiry_date   = EXCLUDED.expiry_date,
       id_token      = EXCLUDED.id_token,
       updated_at    = EXCLUDED.updated_at`,
    [
      userId,
      tokens.access_token ?? null,
      tokens.refresh_token ?? null,
      tokens.scope ?? null,
      tokens.token_type ?? null,
      tokens.expiry_date ?? null,
      tokens.id_token ?? null,
      Date.now(),
    ],
  );
}

export async function getUserTokens(
  userId: string,
): Promise<StoredTokens | null> {
  await ensureUserTokensTable();
  const { rows } = await query<StoredTokens>(
    `SELECT user_id, access_token, refresh_token, scope, token_type, expiry_date, id_token, updated_at
     FROM user_tokens WHERE user_id = $1`,
    [userId],
  );
  return rows[0] ?? null;
}

/* ===================== YouTube Client ===================== */

export async function getYouTubeClientEx(opts: {
  userId: string;
  requireReal?: boolean;
}): Promise<{ yt: youtube_v3.Youtube | null; mock: boolean }> {
  const { userId, requireReal } = opts;

  try {
    const row = await getUserTokens(userId);

    if (!row || (!row.access_token && !row.refresh_token)) {
      const msg = "getYouTubeClient: no tokens found";
      if (requireReal) {
        const err: any = new Error(msg);
        err.code = "NO_TOKENS";
        throw err;
      } else {
        logger.warn({ userId }, `${msg}, falling back to mock`);
        return { yt: null, mock: true };
      }
    }

    const oauth2 = getOAuthClient();
    oauth2.setCredentials({
      access_token: row.access_token ?? undefined,
      refresh_token: row.refresh_token ?? undefined,
      expiry_date: row.expiry_date ?? undefined,
    });

    oauth2.on("tokens", async (t) => {
      try {
        const merged: Credentials = {
          access_token: t.access_token ?? row.access_token ?? undefined,
          refresh_token: t.refresh_token ?? row.refresh_token ?? undefined,
          scope: t.scope ?? row.scope ?? undefined,
          token_type: t.token_type ?? row.token_type ?? undefined,
          expiry_date: t.expiry_date ?? row.expiry_date ?? undefined,
          id_token: t.id_token ?? row.id_token ?? undefined,
        };
        await saveUserTokens(userId, merged);
      } catch (e) {
        logger.error({ e, userId }, "failed to persist refreshed tokens");
      }
    });

    const yt = google.youtube({ version: "v3", auth: oauth2 });
    return { yt, mock: false };
  } catch (err: any) {
    if (err?.code === "NO_TOKENS") throw err;
    logger.error(
      { err, userId: opts.userId },
      "getYouTubeClient failed; falling back to mock",
    );
    if (opts.requireReal) throw err;
    return { yt: null, mock: true };
  }
}

export async function getYouTubeClient(
  userId: string,
): Promise<youtube_v3.Youtube | null> {
  const { yt } = await getYouTubeClientEx({ userId, requireReal: false });
  return yt;
}
