import pino from "pino";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { MetricsService } from "../src/services/metrics.service.js";
import { JwtTokenService } from "../src/services/token.service.js";
import { InMemoryUserRepository } from "./helpers/in-memory-user.repository.js";

const adminId = "11111111-1111-1111-1111-111111111111";
const customerId = "22222222-2222-2222-2222-222222222222";

describe("Metrics API", () => {
  const tokenService = new JwtTokenService();

  let app: ReturnType<typeof createApp>;
  let metricsService: MetricsService;
  let adminToken: string;
  let customerToken: string;

  beforeEach(() => {
    metricsService = new MetricsService();

    const users = new InMemoryUserRepository();
    users.addUser({
      id: adminId,
      name: "Admin User",
      role: "ADMIN",
    });
    users.addUser({
      id: customerId,
      name: "Customer User",
      role: "CUSTOMER",
    });

    app = createApp({
      userRepository: users,
      tokenService,
      metricsService,
      logger: pino({ level: "silent" }),
    });

    adminToken = tokenService.createAccessToken({
      userId: adminId,
      role: "ADMIN",
    });
    customerToken = tokenService.createAccessToken({
      userId: customerId,
      role: "CUSTOMER",
    });
  });

  describe("GET /api/metrics", () => {
    it("returns 401 for unauthenticated requests", async () => {
      await request(app).get("/api/metrics").expect(401);
    });

    it("returns 403 for non-admin users", async () => {
      await request(app)
        .get("/api/metrics")
        .set("Authorization", `Bearer ${customerToken}`)
        .expect(403);
    });

    it("returns metrics for admin users", async () => {
      // Generate some traffic first
      await request(app).get("/").expect(200);
      await request(app).get("/health").expect(200);
      // Customer accessing admin-only POST category returns 403
      await request(app)
        .post("/api/categories")
        .set("Authorization", `Bearer ${customerToken}`)
        .send({ name: "New Category" })
        .expect(403);

      const response = await request(app)
        .get("/api/metrics")
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          totalRequests: expect.any(Number),
          statusCounts: expect.any(Object),
          latencyMs: {
            total: expect.any(Number),
            min: expect.any(Number),
            max: expect.any(Number),
            avg: expect.any(Number),
          },
          routes: expect.any(Array),
          startTime: expect.any(String),
          uptimeMs: expect.any(Number),
        },
      });

      const data = response.body.data;
      expect(data.totalRequests).toBeGreaterThan(0);
      expect(data.statusCounts["2xx"]).toBeGreaterThan(0);
    });

    it("includes route-specific metrics with status counts and latency", async () => {
      // Customer POST to categories returns 403 (admin-only)
      await request(app)
        .post("/api/categories")
        .set("Authorization", `Bearer ${customerToken}`)
        .send({ name: "New Category" })
        .expect(403);

      const response = await request(app)
        .get("/api/metrics")
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(200);

      const routeMetrics = response.body.data.routes.find(
        (r: { method: string; route: string }) =>
          r.method === "POST" && r.route.startsWith("/api/categories"),
      );

      expect(routeMetrics).toBeDefined();
      expect(routeMetrics.count).toBeGreaterThanOrEqual(1);
      expect(routeMetrics.statusCounts["4xx"]).toBe(1);
      expect(routeMetrics.statusCounts["403"]).toBe(1);
    });
  });

  describe("GET /api/metrics/prometheus", () => {
    it("returns 403 for non-admin users", async () => {
      await request(app)
        .get("/api/metrics/prometheus")
        .set("Authorization", `Bearer ${customerToken}`)
        .expect(403);
    });

    it("returns Prometheus-formatted metrics for admin users", async () => {
      await request(app).get("/").expect(200);

      const response = await request(app)
        .get("/api/metrics/prometheus")
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(200);

      const text = response.text;
      expect(text).toContain("# HELP cmm_http_requests_total");
      expect(text).toContain("# TYPE cmm_http_requests_total counter");
      expect(text).toContain('cmm_http_requests_total{status="2xx"');
      expect(text).toContain("# HELP cmm_http_request_duration_ms");
      expect(text).toContain(
        "# HELP cmm_http_request_min_latency_ms",
      );
    });
  });

  describe("DELETE /api/metrics", () => {
    it("returns 403 for non-admin users", async () => {
      await request(app)
        .delete("/api/metrics")
        .set("Authorization", `Bearer ${customerToken}`)
        .expect(403);
    });

    it("resets metrics for admin users", async () => {
      // Generate traffic
      await request(app).get("/").expect(200);
      await request(app).get("/health").expect(200);

      // Verify metrics are present
      const beforeReset = await request(app)
        .get("/api/metrics")
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(200);
      expect(beforeReset.body.data.totalRequests).toBeGreaterThan(0);

      // Reset
      await request(app)
        .delete("/api/metrics")
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(200)
        .expect({ success: true, data: null });

      // The reset clears the service state, but the GET request for
      // verification is still recorded. So we verify total is small.
      const afterReset = await request(app)
        .get("/api/metrics")
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(200);
      expect(afterReset.body.data.totalRequests).toBeLessThanOrEqual(1);
    });
  });
});
