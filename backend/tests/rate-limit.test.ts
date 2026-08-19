import pino from "pino";
import request from "supertest";
import express from "express";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import {
  createAuthRateLimiter,
  createGlobalRateLimiter,
} from "../src/middleware/rate-limit.js";

// ── Global rate limiter ────────────────────────────────────────────────────

describe("global rate limiter", () => {
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    app = createApp({
      logger: pino({ level: "silent" }),
    });
  });

  it("allows normal traffic within the configured limit", async () => {
    const responses = [];

    for (let requestNumber = 0; requestNumber < 100; requestNumber += 1) {
      responses.push(await request(app).get("/health").expect(200));
    }

    expect(responses[0]?.body).toEqual({
      success: true,
      data: { status: "ok" },
    });
    expect(responses.at(-1)?.body).toEqual({
      success: true,
      data: { status: "ok" },
    });
  });

  it("returns the API error contract when the limit is exceeded", async () => {
    for (let requestNumber = 0; requestNumber < 100; requestNumber += 1) {
      await request(app).get("/health").expect(200);
    }

    const response = await request(app).get("/health").expect(429);

    expect(response.body).toEqual({
      success: false,
      message: "Too many requests. Please try again later.",
      errors: [],
    });
  });
});

// ── Auth rate limiter ──────────────────────────────────────────────────────

/**
 * Builds a minimal Express app that applies the auth rate limiter to a
 * single POST /test endpoint that returns:
 *   200 when body.succeed === true
 *   401 otherwise
 *
 * This lets us test the limiter in isolation without invoking the real
 * auth service or database.
 */
function buildAuthLimiterApp(forceEnable: boolean) {
  const app = express();
  app.use(express.json());
  app.use(createAuthRateLimiter({ forceEnable }));
  app.post("/test", (req, res) => {
    if (req.body?.succeed) {
      res.status(200).json({ ok: true });
    } else {
      res.status(401).json({ ok: false });
    }
  });
  // Minimal error handler so TooManyRequestsError serialises correctly.
  app.use(
    (
      err: { statusCode?: number; message?: string },
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ) => {
      res
        .status(err.statusCode ?? 500)
        .json({ success: false, message: err.message ?? "Error", errors: [] });
    },
  );
  return app;
}

describe("auth rate limiter", () => {
  // ── Development / test environment bypass ─────────────────────────────

  it("does not rate-limit requests in the test environment (NODE_ENV=test)", async () => {
    // forceEnable:false → limiter uses skip() → NODE_ENV=test → bypassed
    const app = buildAuthLimiterApp(false);

    // Send 30 failed requests — well above the 20-request production cap.
    for (let i = 0; i < 30; i++) {
      await request(app).post("/test").send({ succeed: false }).expect(401);
    }

    // The 31st request must still pass through — limiter is skipped.
    const response = await request(app)
      .post("/test")
      .send({ succeed: false })
      .expect(401);

    expect(response.status).toBe(401);
  });

  // ── Production rate limiting ───────────────────────────────────────────

  it("enforces the 20-request limit in production (forceEnable)", async () => {
    // forceEnable:true → skip() always returns false → limiter is active.
    const app = buildAuthLimiterApp(true);

    // 20 failed requests should all be allowed (consume the full budget).
    for (let i = 0; i < 20; i++) {
      await request(app).post("/test").send({ succeed: false }).expect(401);
    }

    // The 21st request exceeds the limit.
    const response = await request(app)
      .post("/test")
      .send({ succeed: false })
      .expect(429);

    expect(response.body).toEqual({
      success: false,
      message: "Too many requests. Please try again later.",
      errors: [],
    });
  });

  it("successful requests do not consume the rate-limit budget (skipSuccessfulRequests)", async () => {
    const app = buildAuthLimiterApp(true);

    // 20 successful requests — each is skipped from the counter.
    for (let i = 0; i < 20; i++) {
      await request(app).post("/test").send({ succeed: true }).expect(200);
    }

    // A failed request should still be allowed because the budget was not
    // consumed by the successful requests above.
    const response = await request(app)
      .post("/test")
      .send({ succeed: false })
      .expect(401);

    expect(response.status).toBe(401);
  });

  it("excessive failed attempts are rate-limited even when mixed with successes", async () => {
    const app = buildAuthLimiterApp(true);

    // 10 successes (do not consume budget) + 20 failures (consume all 20 slots).
    for (let i = 0; i < 10; i++) {
      await request(app).post("/test").send({ succeed: true }).expect(200);
    }
    for (let i = 0; i < 20; i++) {
      await request(app).post("/test").send({ succeed: false }).expect(401);
    }

    // The next failed request exceeds the limit.
    const response = await request(app)
      .post("/test")
      .send({ succeed: false })
      .expect(429);

    expect(response.body.message).toBe(
      "Too many requests. Please try again later.",
    );
  });
});
