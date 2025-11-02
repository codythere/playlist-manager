import pRetry, { AbortError } from "p-retry";
import { logger } from "./logger";

export interface BatchOptions<T> {
  batchSize?: number;
  concurrency?: number;
  retryCodes?: Array<number | string>;
  onItemComplete?: (payload: {
    item: T;
    index: number;
    result?: unknown;
    error?: unknown;
  }) => void;
}

const DEFAULT_BATCH_SIZE = 20;
const DEFAULT_CONCURRENCY = 35;
const DEFAULT_RETRY_CODES = [403, 429, "EAI_AGAIN", "ETIMEDOUT"]; // Retry on quota and rate errors

function extractCode(value: unknown): number | string | undefined {
  if (typeof value === "number" || typeof value === "string") {
    return value;
  }
  return undefined;
}

function shouldRetry(error: unknown, retryCodes: Array<number | string>) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const record = error as Record<string, unknown>;
  const direct =
    extractCode(record.status) ??
    extractCode(record.code) ??
    extractCode(record.errno);
  if (direct !== undefined) {
    return retryCodes.includes(direct);
  }

  const response = record.response;
  if (response && typeof response === "object") {
    const responseRecord = response as Record<string, unknown>;
    const nested = extractCode(responseRecord.status);
    if (nested !== undefined) {
      return retryCodes.includes(nested);
    }
  }

  return false;
}

export interface BatchResult<R> {
  values: Array<R | undefined>;
  errors: Array<{ index: number; error: unknown }>;
}

export async function runInBatches<T, R>(
  items: readonly T[],
  handler: (item: T, index: number) => Promise<R>,
  options: BatchOptions<T> = {}
): Promise<BatchResult<R>> {
  const batchSize = options.batchSize ?? DEFAULT_BATCH_SIZE;
  const concurrency = Math.min(
    options.concurrency ?? DEFAULT_CONCURRENCY,
    items.length || 1
  );
  const retryCodes = options.retryCodes ?? DEFAULT_RETRY_CODES;

  const values: Array<R | undefined> = new Array(items.length);
  const errors: Array<{ index: number; error: unknown }> = [];

  let cursor = 0;

  const worker = async () => {
    while (true) {
      const start = cursor;
      if (start >= items.length) {
        return;
      }
      cursor += batchSize;
      const batch = items.slice(start, start + batchSize);
      const promises = batch.map(async (item, offset) => {
        const index = start + offset;
        try {
          const result = await pRetry(() => handler(item, index), {
            retries: 5,
            factor: 2,
            minTimeout: 300,
            maxTimeout: 2000,
            onFailedAttempt: (attempt) => {
              if (!shouldRetry(attempt, retryCodes)) {
                throw new AbortError(attempt);
              }
              logger.warn(
                {
                  attempt: attempt.attemptNumber,
                  retriesLeft: attempt.retriesLeft,
                  index,
                },
                "Retrying batch item"
              );
            },
          });
          values[index] = result;
          options.onItemComplete?.({ item, index, result });
        } catch (error) {
          errors.push({ index, error });
          options.onItemComplete?.({ item, index, error });
        }
      });
      await Promise.all(promises);
    }
  };

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  return { values, errors };
}
