import type { Request, Response } from "express";
import type { SellerInventoryService } from "../services/seller-inventory.service.js";
import { UnauthorizedError } from "../utils/api-error.js";
import type {
  CreateSellerInventoryBody,
  ListSellerInventoryQuery,
  SellerInventoryIdParams,
  UpdateSellerInventoryBody,
} from "../validators/seller-inventory.validators.js";

export class SellerInventoryController {
  constructor(
    private readonly service: SellerInventoryService,
  ) {}

  list = async (req: Request, res: Response): Promise<void> => {
    const result = await this.service.list(
      this.requireActor(req),
      req.query as ListSellerInventoryQuery,
    );

    res.status(200).json({ success: true, data: result });
  };

  create = async (req: Request, res: Response): Promise<void> => {
    const entry = await this.service.create(
      this.requireActor(req),
      req.body as CreateSellerInventoryBody,
    );

    res.status(201).json({ success: true, data: { entry } });
  };

  update = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params as SellerInventoryIdParams;
    const entry = await this.service.update(
      this.requireActor(req),
      id,
      req.body as UpdateSellerInventoryBody,
    );

    res.status(200).json({ success: true, data: { entry } });
  };

  remove = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params as SellerInventoryIdParams;
    await this.service.remove(this.requireActor(req), id);

    res.status(200).json({ success: true, data: null });
  };

  private requireActor(req: Request) {
    if (!req.auth) {
      throw new UnauthorizedError();
    }

    return req.auth;
  }
}
