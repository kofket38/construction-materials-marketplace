/**
 * MetricsService — collects and aggregates HTTP request metrics in memory.
 *
 * Provides counters for total requests, requests by status code ranges,
 * requests by route/method, and per-route latency statistics.
 *
 * This is an in-process aggregator suitable for a single-instance deployment.
 * A multi-instance deployment would need an external metrics backend.
 */

export interface RouteMetric {
  method: string;
  route: string;
  count: number;
  statusCounts: Record<string, number>;
  totalLatencyMs: number;
  minLatencyMs: number;
  maxLatencyMs: number;
  avgLatencyMs: number;
}

export interface MetricsSnapshot {
  totalRequests: number;
  statusCounts: Record<string, number>;
  latencyMs: {
    total: number;
    min: number;
    max: number;
    avg: number;
  };
  routes: RouteMetric[];
  startTime: Date;
  uptimeMs: number;
}

const STATUS_RANGES = ["2xx", "3xx", "4xx", "5xx"] as const;

function statusRange(statusCode: number): string {
  if (statusCode >= 200 && statusCode < 300) return "2xx";
  if (statusCode >= 300 && statusCode < 400) return "3xx";
  if (statusCode >= 400 && statusCode < 500) return "4xx";
  if (statusCode >= 500) return "5xx";
  return String(statusCode);
}

function safeDivide(numerator: number, denominator: number): number {
  return denominator > 0 ? numerator / denominator : 0;
}

export class MetricsService {
  private totalRequests = 0;
  private totalLatencyMs = 0;
  private minLatencyMs = Number.POSITIVE_INFINITY;
  private maxLatencyMs = 0;
  private readonly statusCounts: Record<string, number> = {};
  private readonly routeMap = new Map<string, RouteMetric>();
  private readonly startTime: Date;

  constructor() {
    this.startTime = new Date();
    for (const range of STATUS_RANGES) {
      this.statusCounts[range] = 0;
    }
  }

  /**
   * Record a completed HTTP request.
   *
   * @param method    - HTTP method (GET, POST, etc.)
   * @param route     - normalized route pattern, e.g. "/api/products/:id"
   * @param statusCode - HTTP response status code
   * @param latencyMs - request duration in milliseconds
   */
  recordRequest(
    method: string,
    route: string,
    statusCode: number,
    latencyMs: number,
  ): void {
    this.totalRequests += 1;
    this.totalLatencyMs += latencyMs;

    if (latencyMs < this.minLatencyMs) {
      this.minLatencyMs = latencyMs;
    }
    if (latencyMs > this.maxLatencyMs) {
      this.maxLatencyMs = latencyMs;
    }

    const range = statusRange(statusCode);
    this.statusCounts[range] = (this.statusCounts[range] ?? 0) + 1;
    this.statusCounts[String(statusCode)] =
      (this.statusCounts[String(statusCode)] ?? 0) + 1;

    const key = `${method}:${route}`;
    const existing = this.routeMap.get(key);

    if (existing) {
      existing.count += 1;
      existing.statusCounts[range] =
        (existing.statusCounts[range] ?? 0) + 1;
      existing.statusCounts[String(statusCode)] =
        (existing.statusCounts[String(statusCode)] ?? 0) + 1;
      existing.totalLatencyMs += latencyMs;
      if (latencyMs < existing.minLatencyMs) {
        existing.minLatencyMs = latencyMs;
      }
      if (latencyMs > existing.maxLatencyMs) {
        existing.maxLatencyMs = latencyMs;
      }
      existing.avgLatencyMs = safeDivide(
        existing.totalLatencyMs,
        existing.count,
      );
    } else {
      this.routeMap.set(key, {
        method,
        route,
        count: 1,
        statusCounts: {
          [range]: 1,
          [String(statusCode)]: 1,
        },
        totalLatencyMs: latencyMs,
        minLatencyMs: latencyMs,
        maxLatencyMs: latencyMs,
        avgLatencyMs: latencyMs,
      });
    }
  }

  /** Returns a full snapshot of current metrics. */
  getMetrics(): MetricsSnapshot {
    const routes: RouteMetric[] = Array.from(this.routeMap.values());

    const avgLatency = safeDivide(this.totalLatencyMs, this.totalRequests);

    return {
      totalRequests: this.totalRequests,
      statusCounts: { ...this.statusCounts },
      latencyMs: {
        total: this.totalLatencyMs,
        min: this.totalRequests > 0 ? this.minLatencyMs : 0,
        max: this.maxLatencyMs,
        avg: avgLatency,
      },
      routes,
      startTime: this.startTime,
      uptimeMs: Date.now() - this.startTime.getTime(),
    };
  }

  /** Returns basic status-code distribution counters only (Prometheus-style). */
  getPrometheusMetrics(): string {
    const snapshot = this.getMetrics();
    const lines: string[] = [];

    lines.push(
      "# HELP cmm_http_requests_total Total number of HTTP requests.",
    );
    lines.push("# TYPE cmm_http_requests_total counter");

    for (const [status, count] of Object.entries(snapshot.statusCounts)) {
      if (STATUS_RANGES.includes(status as (typeof STATUS_RANGES)[number])) {
        lines.push(`cmm_http_requests_total{status="${status}"} ${count}`);
      }
    }

    lines.push(
      "# HELP cmm_http_request_duration_ms Total latency in milliseconds.",
    );
    lines.push("# TYPE cmm_http_request_duration_ms counter");
    lines.push(
      `cmm_http_request_duration_ms_total ${snapshot.latencyMs.total}`,
    );

    lines.push(
      "# HELP cmm_http_request_min_latency_ms Minimum request latency in ms.",
    );
    lines.push("# TYPE cmm_http_request_min_latency_ms gauge");
    lines.push(`cmm_http_request_min_latency_ms ${snapshot.latencyMs.min}`);

    lines.push(
      "# HELP cmm_http_request_max_latency_ms Maximum request latency in ms.",
    );
    lines.push("# TYPE cmm_http_request_max_latency_ms gauge");
    lines.push(`cmm_http_request_max_latency_ms ${snapshot.latencyMs.max}`);

    lines.push(
      "# HELP cmm_http_request_avg_latency_ms Average request latency in ms.",
    );
    lines.push("# TYPE cmm_http_request_avg_latency_ms gauge");
    lines.push(`cmm_http_request_avg_latency_ms ${snapshot.latencyMs.avg}`);

    for (const route of snapshot.routes) {
      const labels = `method="${route.method}",route="${route.route}"`;

      for (const [status, count] of Object.entries(route.statusCounts)) {
        if (
          STATUS_RANGES.includes(
            status as (typeof STATUS_RANGES)[number],
          )
        ) {
          lines.push(
            `cmm_http_route_requests_total{${labels},status="${status}"} ${count}`,
          );
        }
      }

      lines.push(
        `# HELP cmm_http_route_avg_latency_ms Average latency for ${route.method} ${route.route}`,
      );
      lines.push("# TYPE cmm_http_route_avg_latency_ms gauge");
      lines.push(
        `cmm_http_route_avg_latency_ms{${labels}} ${route.avgLatencyMs}`,
      );
    }

    return lines.join("\n") + "\n";
  }

  /** Reset all collected metrics. Used primarily in tests. */
  reset(): void {
    this.totalRequests = 0;
    this.totalLatencyMs = 0;
    this.minLatencyMs = Number.POSITIVE_INFINITY;
    this.maxLatencyMs = 0;
    for (const range of STATUS_RANGES) {
      this.statusCounts[range] = 0;
    }
    for (const [_, value] of Object.entries(this.statusCounts)) {
      if (!STATUS_RANGES.includes(_ as (typeof STATUS_RANGES)[number])) {
        delete this.statusCounts[_];
      }
    }
    this.routeMap.clear();
    this.startTime.setTime(Date.now());
  }
}
