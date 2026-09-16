import type { RequestHandler } from "express";
import type { MetricsService } from "../services/metrics.service.js";

/**
 * Middleware that measures each HTTP request's duration and records it
 * in the injected MetricsService, using a normalized route pattern
 * (e.g. "/api/products/:id") rather than the raw URL.
 */
export function createMetricsMiddleware(
  metricsService: MetricsService,
): RequestHandler {
  return (req, _res, next) => {
    const start = process.hrtime.bigint();

    // We patch res.on to capture the finish event. At this point the router
    // has already matched and set req.route / req.baseUrl.
    _res.on("finish", () => {
      const end = process.hrtime.bigint();
      const latencyMs = Number(end - start) / 1_000_000;

      const route = normalizeRoute(req);
      metricsService.recordRequest(
        req.method,
        route,
        _res.statusCode,
        latencyMs,
      );
    });

    next();
  };
}

/**
 * Produces a normalized route pattern from the request.
 *
 * Strategy:
 * 1. If Express's `req.route.path` is set AND `req.baseUrl` is non-empty,
 *    combine them to get the full route pattern.
 * 2. Otherwise, fall back to normalizing `req.originalUrl`, converting
 *    UUID-like path segments to ":id" placeholders.
 */
function normalizeRoute(req: {
  route?: { path?: string };
  url: string;
  baseUrl?: string;
  originalUrl?: string;
}): string {
  // When both route path and base URL are available, combine them.
  if (req.route?.path && req.baseUrl) {
    const combined = `${req.baseUrl}${req.route.path}`.replace(/\/+/g, "/");
    return stripTrailingSlash(combined);
  }

  // Fallback: use originalUrl (preserved across subrouter rewrites) and
  // convert UUID-like segments to ":id" placeholders.
  const urlPath = (req.originalUrl ?? req.url).split("?")[0] ?? "";
  const segments = urlPath.split("/");
  const normalized = segments.map((segment) => {
    // UUID v4 pattern
    if (
      segment.match(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      )
    ) {
      return ":id";
    }
    // Short UUID-like hex segments (8+ hex chars)
    if (segment.length >= 8 && /^[0-9a-f]+$/i.test(segment)) {
      return ":id";
    }
    return segment;
  });

  return stripTrailingSlash(normalized.join("/").replace(/\/+/g, "/"));
}

function stripTrailingSlash(path: string): string {
  if (path.length > 1) {
    return path.replace(/\/$/, "");
  }
  return path;
}
