import "server-only";

import { createHash } from "crypto";
import { logger } from "./logger";

const DEFAULT_ORIGIN =
  "https://shell-sphere-api-86533770874.asia-southeast1.run.app";
const VISIT_PATH = "/api/v1/traffic/visit";
const TIMEOUT_MS = 8000;
const VISITOR_MIN = 8;
const VISITOR_MAX = 80;

export const TRAFFIC_EVENTS = ["oauth", "calc", "dashboard"] as const;
export type TrafficEvent = (typeof TRAFFIC_EVENTS)[number];

function sphereOrigin(): string {
  return (
    process.env.SHELL_SPHERE_API_ORIGIN ||
    process.env.SHELL_SPHERE_API_BASE ||
    DEFAULT_ORIGIN
  ).replace(/\/$/, "");
}

function sphereApiKey(): string {
  return (process.env.SHELL_SPHERE_API_KEY ?? "").trim();
}

function isValidVisitorId(value: string): boolean {
  return (
    value.length >= VISITOR_MIN &&
    value.length <= VISITOR_MAX &&
    !value.includes("@")
  );
}

/**
 * 穩定 visitor_id：優先 Google sub，其次非 email 的內部 userId。
 * email 不會送出，改為 sha256 截斷後的固定值。
 */
export function visitorIdForLogin(opts: {
  userId: string;
  googleSub?: string | null;
}): string | null {
  const sub = opts.googleSub?.trim() ?? "";
  if (isValidVisitorId(sub)) return sub;

  const userId = opts.userId.trim();
  if (isValidVisitorId(userId)) return userId;

  if (!userId) return null;

  return createHash("sha256")
    .update(`playlist-manager:${userId}`)
    .digest("hex")
    .slice(0, 32);
}

export async function reportSphereVisit(
  visitorId: string | null,
  event: TrafficEvent,
): Promise<number | null> {
  if (!visitorId || !isValidVisitorId(visitorId)) {
    logger.warn({ event }, "SHELL SPHERE traffic skipped: invalid visitor_id");
    return null;
  }

  if (!(TRAFFIC_EVENTS as readonly string[]).includes(event)) {
    logger.warn({ event }, "SHELL SPHERE traffic skipped: invalid event");
    return null;
  }

  const apiKey = sphereApiKey();
  if (!apiKey) {
    logger.warn("SHELL SPHERE traffic skipped: missing API key");
    return 401;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(`${sphereOrigin()}${VISIT_PATH}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Api-Key": apiKey,
      },
      body: JSON.stringify({ visitor_id: visitorId, event }),
      signal: controller.signal,
      cache: "no-store",
    });

    if (res.status !== 204) {
      logger.warn(
        { status: res.status, event },
        "SHELL SPHERE traffic unexpected status",
      );
    }

    return res.status;
  } catch (err) {
    logger.warn({ err, event }, "SHELL SPHERE traffic request failed");
    return null;
  } finally {
    clearTimeout(timer);
  }
}
