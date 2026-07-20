import type { Request, Response } from "express";
import type { AdminDashboardService } from "../services/admin-dashboard.service.js";
import { UnauthorizedError } from "../utils/api-error.js";
import type {
  AdminProductIdParams,
  AdminProductsQueryParams,
  AdminSellersQueryParams,
  AdminUserIdParams,
  AdminUsersQueryParams,
  UpdateAdminUserStatusBody,
} from "../validators/admin-dashboard.validators.js";

export class AdminDashboardController {
  constructor(
    private readonly adminDashboardService: AdminDashboardService,
  ) {}

  getDashboard = async (req: Request, res: Response): Promise<void> => {
    const dashboard = await this.adminDashboardService.getDashboard(
      this.requireActor(req),
    );

    res.status(200).json({
      success: true,
      data: { dashboard },
    });
  };

  findUsers = async (req: Request, res: Response): Promise<void> => {
    const result = await this.adminDashboardService.findUsers(
      this.requireActor(req),
      req.query as AdminUsersQueryParams,
    );

    res.status(200).json({
      success: true,
      data: result,
    });
  };

  updateUserStatus = async (
    req: Request,
    res: Response,
  ): Promise<void> => {
    const { id } = req.params as AdminUserIdParams;
    const user = await this.adminDashboardService.updateUserStatus(
      id,
      this.requireActor(req),
      req.body as UpdateAdminUserStatusBody,
    );

    res.status(200).json({
      success: true,
      data: { user },
    });
  };

  findSellers = async (req: Request, res: Response): Promise<void> => {
    const result = await this.adminDashboardService.findSellers(
      this.requireActor(req),
      req.query as AdminSellersQueryParams,
    );

    res.status(200).json({
      success: true,
      data: result,
    });
  };

  findProducts = async (req: Request, res: Response): Promise<void> => {
    const result = await this.adminDashboardService.findProducts(
      this.requireActor(req),
      req.query as AdminProductsQueryParams,
    );

    res.status(200).json({
      success: true,
      data: result,
    });
  };

  deleteProduct = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params as AdminProductIdParams;
    await this.adminDashboardService.deleteProduct(
      id,
      this.requireActor(req),
    );

    res.status(200).json({
      success: true,
      data: null,
    });
  };

  private requireActor(req: Request) {
    if (!req.auth) {
      throw new UnauthorizedError();
    }

    return req.auth;
  }
}
