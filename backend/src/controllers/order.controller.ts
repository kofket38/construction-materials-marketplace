import type { Request, Response } from "express";
import type { OrderService } from "../services/order.service.js";
import { UnauthorizedError } from "../utils/api-error.js";
import type {
  CreateOrderBody,
  OrderIdParams,
  UpdateOrderStatusBody,
} from "../validators/order.validators.js";

export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  create = async (req: Request, res: Response): Promise<void> => {
    const order = await this.orderService.create(
      this.requireActor(req),
      req.body as CreateOrderBody,
    );

    res.status(201).json({
      success: true,
      data: { order },
    });
  };

  findMyOrders = async (req: Request, res: Response): Promise<void> => {
    const orders = await this.orderService.findMyOrders(
      this.requireActor(req),
    );

    res.status(200).json({
      success: true,
      data: { orders },
    });
  };

  findById = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params as OrderIdParams;
    const order = await this.orderService.findById(
      id,
      this.requireActor(req),
    );

    res.status(200).json({
      success: true,
      data: { order },
    });
  };

  updateStatus = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params as OrderIdParams;
    const order = await this.orderService.updateStatus(
      id,
      this.requireActor(req),
      req.body as UpdateOrderStatusBody,
    );

    res.status(200).json({
      success: true,
      data: { order },
    });
  };

  cancel = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params as OrderIdParams;
    await this.orderService.cancel(id, this.requireActor(req));

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
