import type { Request, Response } from "express";
import type { SellerProfileService } from "../services/seller-profile.service.js";
import { UnauthorizedError } from "../utils/api-error.js";
import type {
  PatchSellerProfileBody,
  UpsertSellerProfileBody,
} from "../validators/seller-profile.validators.js";

export class SellerProfileController {
  constructor(private readonly service: SellerProfileService) {}

  get = async (req: Request, res: Response): Promise<void> => {
    const profile = await this.service.get(this.requireActor(req));

    res.status(200).json({
      success: true,
      data: { profile },
    });
  };

  upsert = async (req: Request, res: Response): Promise<void> => {
    const profile = await this.service.upsert(
      this.requireActor(req),
      req.body as UpsertSellerProfileBody,
    );

    res.status(200).json({
      success: true,
      data: { profile },
    });
  };

  patch = async (req: Request, res: Response): Promise<void> => {
    const profile = await this.service.patch(
      this.requireActor(req),
      req.body as PatchSellerProfileBody,
    );

    res.status(200).json({
      success: true,
      data: { profile },
    });
  };

  private requireActor(req: Request) {
    if (!req.auth) {
      throw new UnauthorizedError();
    }
    return req.auth;
  }
}
