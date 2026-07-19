import type { Request, Response } from "express";
import type { SellerDashboardService } from "../services/seller-dashboard.service.js";
import { UnauthorizedError } from "../utils/api-error.js";
import type {
  SellerOrdersQueryParams,
  SellerProductsQueryParams,
} from "../validators/seller-dashboard.validators.js";

export class SellerDashboardController {
  constructor(
    private readonly sellerDashboardService: SellerDashboardService,
  ) {}

  getDashboard = async (req: Request, res: Response): Promise<void> => {
    const dashboard = await this.sellerDashboardService.getDashboard(
      this.requireActor(req),
    );

    res.status(200).json({
      success: true,
      data: { dashboard },
    });
  };

  findProducts = async (req: Request, res: Response): Promise<void> => {
    const result = await this.sellerDashboardService.findProducts(
      this.requireActor(req),
      req.query as SellerProductsQueryParams,
    );

    res.status(200).json({
      success: true,
      data: result,
    });
  };

  findOrders = async (req: Request, res: Response): Promise<void> => {
    const result = await this.sellerDashboardService.findOrders(
      this.requireActor(req),
      req.query as SellerOrdersQueryParams,
    );

    res.status(200).json({
      success: true,
      data: result,
    });
  };

  getAnalytics = async (req: Request, res: Response): Promise<void> => {
    const analytics = await this.sellerDashboardService.getAnalytics(
      this.requireActor(req),
    );

    res.status(200).json({
      success: true,
      data: { analytics },
    });
  };

  private requireActor(req: Request) {
    if (!req.auth) {
      throw new UnauthorizedError();
    }

    return req.auth;
  }
}
