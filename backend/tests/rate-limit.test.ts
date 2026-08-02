import pino from "pino";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";

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
