import { rateLimit } from "express-rate-limit";
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

export function createAuthRateLimiter() {
  return rateLimit({
    windowMs: FIFTEEN_MINUTES_IN_MS,
    limit: 20,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    skipSuccessfulRequests: false,
    handler: rateLimitHandler,
  });
}
