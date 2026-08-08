import type { Request, Response } from "express";
import type { PaymentService } from "../services/payment.service.js";
import { UnauthorizedError } from "../utils/api-error.js";
import type {
  CheckoutPaymentOptionsBody,
  PaymentOrderIdParams,
  SubmitManualPaymentBody,
} from "../validators/payment.validators.js";

export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  findCheckoutOptions = async (
    req: Request,
    res: Response,
  ): Promise<void> => {
    const { productIds } = req.body as CheckoutPaymentOptionsBody;
    const options = await this.paymentService.findCheckoutOptions(
      this.requireActor(req),
      productIds,
    );

    res.status(200).json({
      success: true,
      data: options,
    });
  };

  submitManualPayment = async (
    req: Request,
    res: Response,
  ): Promise<void> => {
    const payment = await this.paymentService.submitManualPayment(
      this.requireActor(req),
      req.body as SubmitManualPaymentBody,
      req.file
        ? {
            buffer: req.file.buffer,
            mimeType: req.file.mimetype,
            size: req.file.size,
          }
        : undefined,
    );

    res.status(201).json({
      success: true,
      data: { payment },
    });
  };

  findByOrderId = async (req: Request, res: Response): Promise<void> => {
    const { orderId } = req.params as PaymentOrderIdParams;
    const details = await this.paymentService.findByOrderId(
      this.requireActor(req),
      orderId,
    );

    res.status(200).json({
      success: true,
      data: details,
    });
  };

  private requireActor(req: Request) {
    if (!req.auth) {
      throw new UnauthorizedError();
    }

    return req.auth;
  }
}
