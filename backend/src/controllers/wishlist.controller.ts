import type { Request, Response } from "express";
import type { WishlistService } from "../services/wishlist.service.js";
import { UnauthorizedError } from "../utils/api-error.js";
import type { WishlistProductIdParams } from "../validators/wishlist.validators.js";

export class WishlistController {
  constructor(private readonly wishlistService: WishlistService) {}

  create = async (req: Request, res: Response): Promise<void> => {
    const { productId } = req.params as WishlistProductIdParams;
    const wishlistItem = await this.wishlistService.create(
      productId,
      this.requireActor(req),
    );

    res.status(201).json({
      success: true,
      data: { wishlistItem },
    });
  };

  findAll = async (req: Request, res: Response): Promise<void> => {
    const wishlistItems = await this.wishlistService.findAll(
      this.requireActor(req),
    );

    res.status(200).json({
      success: true,
      data: { wishlistItems },
    });
  };

  delete = async (req: Request, res: Response): Promise<void> => {
    const { productId } = req.params as WishlistProductIdParams;
    await this.wishlistService.delete(productId, this.requireActor(req));

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
