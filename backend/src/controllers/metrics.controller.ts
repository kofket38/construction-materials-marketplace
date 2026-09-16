import type { Request, Response } from "express";
import type { MetricsService } from "../services/metrics.service.js";

export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  /**
   * Returns metrics in a structured JSON envelope.
   * Accessible only to admin users (authorization handled in the router).
   */
  getMetrics = async (_req: Request, res: Response): Promise<void> => {
    const metrics = this.metricsService.getMetrics();
    res.status(200).json({
      success: true,
      data: metrics,
    });
  };

  /**
   * Returns metrics in Prometheus text format.
   * Accessible only to admin users (authorization handled in the router).
   */
  getPrometheusMetrics = async (
    _req: Request,
    res: Response,
  ): Promise<void> => {
    const text = this.metricsService.getPrometheusMetrics();
    res.status(200).type("text/plain").send(text);
  };

  /**
   * Resets all collected metrics. Intended for testing.
   * Accessible only to admin users (authorization handled in the router).
   */
  resetMetrics = async (_req: Request, res: Response): Promise<void> => {
    this.metricsService.reset();
    res.status(200).json({
      success: true,
      data: null,
    });
  };
}
