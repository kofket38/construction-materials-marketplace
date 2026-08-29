import { rateLimit } from "express-rate-limit";
import { env } from "../config/env.js";
import { TooManyRequestsError } from "../utils/api-error.js";

const FIFTEEN_MINUTES_IN_MS = 15 * 60 * 1000;

function rateLimitHandler(): never {
  throw new TooManyRequestsError();
}

export function createGlobalRateLimiter() {
  return rateLimit({
    windowMs: FIFTEEN_MINUTES_IN_MS,
    limit: 100,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler: rateLimitHandler,
  });
}

/**
 * Creates the auth-route rate limiter.
 *
 * @param options.forceEnable - When true, the limiter is always active
 *   regardless of NODE_ENV (used in tests that verify production behaviour).
 *   Defaults to false.
 */
export function createAuthRateLimiter(options?: { forceEnable?: boolean }) {
  const forceEnable = options?.forceEnable ?? false;
  return rateLimit({
    windowMs: FIFTEEN_MINUTES_IN_MS,
    limit: 20,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    // Successful auth requests do not consume the brute-force budget.
    skipSuccessfulRequests: true,
    // Bypass the limiter only in the automated test environment so local
    // development, staging, and production are all protected against
    // brute-force attacks.
    // Pass forceEnable:true in tests that specifically verify rate-limit
    // behaviour without needing to change NODE_ENV.
    skip: forceEnable ? () => false : () => env.NODE_ENV === "test",
    handler: rateLimitHandler,
  });
}
