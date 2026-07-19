import express from "express";
import pino from "pino";
import request, { type Response } from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { authenticate } from "../src/middleware/authentication.js";
import { authorizeRoles } from "../src/middleware/authorize-role.js";
import { createErrorHandler } from "../src/middleware/error-handler.js";
import { JwtTokenService } from "../src/services/token.service.js";
import { InMemoryUserRepository } from "./helpers/in-memory-user.repository.js";

const validRegistration = {
  firstName: "Amina",
  lastName: "Kamau",
  email: "amina@example.com",
  password: "StrongPass1",
  phone: "+254712345678",
  company: "Kamau Builders",
  role: "BUYER",
};

function readRefreshCookie(response: Response): string {
  const setCookie = response.headers["set-cookie"] as unknown;
  const cookies = Array.isArray(setCookie)
    ? (setCookie as string[])
    : typeof setCookie === "string"
      ? [setCookie]
      : [];
  const refreshCookie = cookies.find((cookie) =>
    cookie.startsWith("refreshToken="),
  );

  if (!refreshCookie) {
    throw new Error("Response did not include a refresh token cookie.");
  }

  return refreshCookie;
}

function cookiePair(setCookie: string): string {
  return setCookie.split(";", 1)[0] ?? "";
}

describe("authentication API", () => {
  let app: ReturnType<typeof createApp>;
  let agent: ReturnType<typeof request.agent>;

  beforeEach(() => {
    app = createApp({
      userRepository: new InMemoryUserRepository(),
      logger: pino({ level: "silent" }),
    });
    agent = request.agent(app);
  });

  describe("POST /api/auth/register", () => {
    it("registers a user, returns an access token, and sets the refresh cookie", async () => {
      const response = await agent
        .post("/api/auth/register")
        .send(validRegistration)
        .expect(201);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          user: {
            name: "Amina Kamau",
            firstName: "Amina",
            lastName: "Kamau",
            email: "amina@example.com",
            role: "CUSTOMER",
            emailVerified: false,
          },
        },
      });
      expect(response.body.data.accessToken).toEqual(expect.any(String));
      expect(response.body.data.user).not.toHaveProperty("passwordHash");
      expect(response.body.data).not.toHaveProperty("refreshToken");

      const refreshCookie = readRefreshCookie(response);
      expect(refreshCookie).toContain("HttpOnly");
      expect(refreshCookie).toContain("Path=/api/auth");
      expect(refreshCookie).toContain("SameSite=Strict");
    });

    it("registers with canonical name input and defaults to CUSTOMER", async () => {
      const response = await request(app)
        .post("/api/auth/register")
        .send({
          name: "Njeri Wanjiku",
          email: "njeri@example.com",
          password: "StrongPass1",
        })
        .expect(201);

      expect(response.body.data.user).toMatchObject({
        name: "Njeri Wanjiku",
        firstName: null,
        lastName: null,
        email: "njeri@example.com",
        role: "CUSTOMER",
      });
    });

    it("rejects invalid input and duplicate email addresses", async () => {
      const invalidResponse = await request(app)
        .post("/api/auth/register")
        .send({ ...validRegistration, role: "ADMIN", password: "weak" })
        .expect(400);

      expect(invalidResponse.body).toMatchObject({
        success: false,
        message: "Request validation failed.",
      });
      expect(invalidResponse.body.errors.length).toBeGreaterThan(0);

      const inconsistentNameResponse = await request(app)
        .post("/api/auth/register")
        .send({
          ...validRegistration,
          name: "Different Person",
          role: "CUSTOMER",
        })
        .expect(400);

      expect(inconsistentNameResponse.body.errors).toContainEqual({
        field: "body.name",
        message:
          "name must match firstName and lastName when both are provided.",
      });

      await request(app)
        .post("/api/auth/register")
        .send(validRegistration)
        .expect(201);

      const duplicateResponse = await request(app)
        .post("/api/auth/register")
        .send({ ...validRegistration, email: "  AMINA@EXAMPLE.COM " })
        .expect(409);

      expect(duplicateResponse.body).toEqual({
        success: false,
        message: "A user with that email already exists.",
        errors: [],
      });
    });
  });

  describe("POST /api/auth/login", () => {
    it("authenticates valid credentials and rejects an invalid password", async () => {
      await request(app)
        .post("/api/auth/register")
        .send(validRegistration)
        .expect(201);

      const invalidResponse = await request(app)
        .post("/api/auth/login")
        .send({ email: validRegistration.email, password: "WrongPass1" })
        .expect(401);

      expect(invalidResponse.body).toEqual({
        success: false,
        message: "Invalid email or password.",
        errors: [],
      });

      const response = await agent
        .post("/api/auth/login")
        .send({
          email: "AMINA@EXAMPLE.COM",
          password: validRegistration.password,
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.accessToken).toEqual(expect.any(String));
      expect(response.body.data.user.email).toBe("amina@example.com");
      expect(response.body.data.user.role).toBe("CUSTOMER");
      expect(readRefreshCookie(response)).toContain("HttpOnly");
    });
  });

  describe("POST /api/auth/refresh", () => {
    it("rotates the refresh token and refuses the previous token", async () => {
      const registration = await agent
        .post("/api/auth/register")
        .send(validRegistration)
        .expect(201);
      const originalCookie = readRefreshCookie(registration);

      const response = await agent.post("/api/auth/refresh").send({}).expect(200);
      const rotatedCookie = readRefreshCookie(response);

      expect(response.body).toMatchObject({
        success: true,
        data: { accessToken: expect.any(String) },
      });
      expect(cookiePair(rotatedCookie)).not.toBe(cookiePair(originalCookie));

      const reuseResponse = await request(app)
        .post("/api/auth/refresh")
        .set("Cookie", cookiePair(originalCookie))
        .send({})
        .expect(401);

      expect(reuseResponse.body.message).toBe(
        "Refresh token reuse was detected. Please sign in again.",
      );
    });

    it("does not revoke a rotated session when an old token is logged out", async () => {
      const registration = await agent
        .post("/api/auth/register")
        .send(validRegistration)
        .expect(201);
      const originalCookie = readRefreshCookie(registration);

      const refreshResponse = await agent
        .post("/api/auth/refresh")
        .send({})
        .expect(200);
      const rotatedCookie = readRefreshCookie(refreshResponse);

      await request(app)
        .post("/api/auth/logout")
        .set("Cookie", cookiePair(originalCookie))
        .send({})
        .expect(200);

      await request(app)
        .post("/api/auth/refresh")
        .set("Cookie", cookiePair(rotatedCookie))
        .send({})
        .expect(200);
    });
  });

  describe("POST /api/auth/logout", () => {
    it("revokes the refresh token and clears its cookie", async () => {
      const registration = await agent
        .post("/api/auth/register")
        .send(validRegistration)
        .expect(201);
      const refreshCookie = readRefreshCookie(registration);

      const response = await agent.post("/api/auth/logout").send({}).expect(200);

      expect(response.body).toEqual({ success: true, data: null });
      expect(readRefreshCookie(response)).toMatch(/Expires=Thu, 01 Jan 1970/);

      await request(app)
        .post("/api/auth/refresh")
        .set("Cookie", cookiePair(refreshCookie))
        .send({})
        .expect(401);
    });
  });

  describe("GET /api/auth/me", () => {
    it("returns the authenticated profile and rejects missing tokens", async () => {
      const registration = await request(app)
        .post("/api/auth/register")
        .send(validRegistration)
        .expect(201);
      const accessToken = registration.body.data.accessToken as string;

      const response = await request(app)
        .get("/api/auth/me")
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          user: {
            email: validRegistration.email,
            company: validRegistration.company,
          },
        },
      });
      expect(response.body.data.user).not.toHaveProperty("passwordHash");
      expect(response.body.data.user).not.toHaveProperty("refreshToken");

      const unauthorizedResponse = await request(app)
        .get("/api/auth/me")
        .expect(401);

      expect(unauthorizedResponse.body).toEqual({
        success: false,
        message: "A valid Bearer access token is required.",
        errors: [],
      });
    });
  });

  describe("role authorization middleware", () => {
    it("allows SELLER access and rejects CUSTOMER access", async () => {
      const tokenService = new JwtTokenService();
      const roleApp = express();
      roleApp.get(
        "/seller-only",
        authenticate(tokenService),
        authorizeRoles("SELLER"),
        (_req, res) => {
          res.status(200).json({ success: true, data: null });
        },
      );
      roleApp.use(createErrorHandler(pino({ level: "silent" })));

      const sellerToken = tokenService.createAccessToken({
        userId: "seller-user",
        role: "SELLER",
      });
      await request(roleApp)
        .get("/seller-only")
        .set("Authorization", `Bearer ${sellerToken}`)
        .expect(200);

      const customerToken = tokenService.createAccessToken({
        userId: "customer-user",
        role: "CUSTOMER",
      });
      const forbiddenResponse = await request(roleApp)
        .get("/seller-only")
        .set("Authorization", `Bearer ${customerToken}`)
        .expect(403);

      expect(forbiddenResponse.body).toEqual({
        success: false,
        message: "You do not have permission to perform this action.",
        errors: [],
      });
    });
  });
});
