import pino from "pino";
import request, { type Response } from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app.js";
import { InMemoryUserRepository } from "./helpers/in-memory-user.repository.js";

vi.mock("../src/config/env.js", async (importOriginal) => {
  const original = await importOriginal<typeof import("../src/config/env.js")>();
  return {
    ...original,
    env: {
      ...original.env,
      NODE_ENV: "production",
      CLIENT_URL: "https://cmm.onrender.com",
    },
  };
});

const origin = "https://cmm.onrender.com";
const credentials = { email: "cookie@example.com", password: "StrongPass1" };

function refreshCookie(response: Response): string {
  const cookies = response.headers["set-cookie"] as unknown as string[];
  const cookie = cookies?.find((value) => value.startsWith("refreshToken="));
  expect(cookie).toBeDefined();
  return cookie!;
}

function pair(cookie: string): string {
  return cookie.split(";", 1)[0]!;
}

function expectCookieAttributes(cookie: string): void {
  expect(cookie).toContain("HttpOnly");
  expect(cookie).toContain("Secure");
  expect(cookie).toContain("SameSite=None");
  expect(cookie).toContain("Path=/api/auth");
  expect(cookie).not.toContain("Domain=");
}

describe("production refresh cookies", () => {
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    app = createApp({
      userRepository: new InMemoryUserRepository(),
      logger: pino({ level: "silent" }),
    });
  });

  it("preserves cookie attributes through login, rotation and logout", async () => {
    const registration = await request(app)
      .post("/api/auth/register")
      .set("Origin", origin)
      .send({ ...credentials, name: "Cookie Test" })
      .expect(201);
    expectCookieAttributes(refreshCookie(registration));

    const login = await request(app)
      .post("/api/auth/login")
      .set("Origin", origin)
      .send(credentials)
      .expect(200);
    const original = refreshCookie(login);
    expectCookieAttributes(original);
    expect(original).toContain("Max-Age=604800");
    expect(login.body.data).not.toHaveProperty("refreshToken");
    expect(login.headers["access-control-allow-origin"]).toBe(origin);
    expect(login.headers["access-control-allow-credentials"]).toBe("true");

    await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${login.body.data.accessToken}`)
      .expect(200);

    const refreshed = await request(app)
      .post("/api/auth/refresh")
      .set("Origin", origin)
      .set("Cookie", pair(original))
      .send({})
      .expect(200);
    const rotated = refreshCookie(refreshed);
    expectCookieAttributes(rotated);
    expect(pair(rotated)).not.toBe(pair(original));
    expect(refreshed.body.data).not.toHaveProperty("refreshToken");

    await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${refreshed.body.data.accessToken}`)
      .expect(200);

    const logout = await request(app)
      .post("/api/auth/logout")
      .set("Origin", origin)
      .set("Cookie", pair(rotated))
      .send({})
      .expect(200);
    const cleared = refreshCookie(logout);
    expectCookieAttributes(cleared);
    expect(cleared).toContain("Expires=Thu, 01 Jan 1970");
    expect(cleared).not.toContain("Max-Age=");

    await request(app)
      .post("/api/auth/refresh")
      .set("Origin", origin)
      .set("Cookie", pair(rotated))
      .send({})
      .expect(401);
    await request(app)
      .post("/api/auth/refresh")
      .set("Origin", origin)
      .send({})
      .expect(401);
  });

  it("permits credentialed preflight from the configured frontend", async () => {
    const response = await request(app)
      .options("/api/auth/refresh")
      .set("Origin", origin)
      .set("Access-Control-Request-Method", "POST")
      .set("Access-Control-Request-Headers", "content-type")
      .expect(204);
    expect(response.headers["access-control-allow-origin"]).toBe(origin);
    expect(response.headers["access-control-allow-credentials"]).toBe("true");
    expect(response.headers["access-control-allow-headers"]).toContain("Content-Type");
  });

  it.each(["register", "login", "refresh", "logout"])(
    "rejects untrusted browser origins on %s before mutating a session",
    async (endpoint) => {
      for (const untrusted of ["https://untrusted.example", "null"]) {
        const response = await request(app)
          .post(`/api/auth/${endpoint}`)
          .set("Origin", untrusted)
          .send({})
          .expect(403);
        expect(response.headers["set-cookie"]).toBeUndefined();
        expect(response.headers["access-control-allow-origin"]).not.toBe(untrusted);
      }
    },
  );

  it("rejects cross-site browser POSTs without Origin", async () => {
    await request(app)
      .post("/api/auth/logout")
      .set("Sec-Fetch-Site", "cross-site")
      .send({})
      .expect(403);
  });

  it("keeps originless non-browser clients supported", async () => {
    await request(app).post("/api/auth/logout").send({}).expect(200);
  });
});
