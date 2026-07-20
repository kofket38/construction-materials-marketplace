import type { Request, Response } from "express";
import type { RfqService } from "../services/rfq.service.js";
import { UnauthorizedError } from "../utils/api-error.js";
import type {
  CreateRfqBody,
  CreateSupplierQuoteBody,
  QuoteIdParams,
  RfqIdParams,
  RfqListQueryParams,
  SellerRfqListQueryParams,
  UpdateRfqBody,
  UpdateSupplierQuoteBody,
} from "../validators/rfq.validators.js";

export class RfqController {
  constructor(private readonly rfqService: RfqService) {}

  create = async (req: Request, res: Response): Promise<void> => {
    const rfq = await this.rfqService.create(
      this.requireActor(req),
      req.body as CreateRfqBody,
    );
    res.status(201).json({ success: true, data: { rfq } });
  };

  findMyRfqs = async (req: Request, res: Response): Promise<void> => {
    const result = await this.rfqService.findMyRfqs(
      this.requireActor(req),
      req.query as RfqListQueryParams,
    );
    res.status(200).json({ success: true, data: result });
  };

  findSellerRfqs = async (
    req: Request,
    res: Response,
  ): Promise<void> => {
    const result = await this.rfqService.findSellerRfqs(
      this.requireActor(req),
      req.query as SellerRfqListQueryParams,
    );
    res.status(200).json({ success: true, data: result });
  };

  findAdminRfqs = async (
    req: Request,
    res: Response,
  ): Promise<void> => {
    const result = await this.rfqService.findAdminRfqs(
      this.requireActor(req),
      req.query as RfqListQueryParams,
    );
    res.status(200).json({ success: true, data: result });
  };

  findById = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params as RfqIdParams;
    const rfq = await this.rfqService.findById(
      id,
      this.requireActor(req),
    );
    res.status(200).json({ success: true, data: { rfq } });
  };

  update = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params as RfqIdParams;
    const rfq = await this.rfqService.update(
      id,
      this.requireActor(req),
      req.body as UpdateRfqBody,
    );
    res.status(200).json({ success: true, data: { rfq } });
  };

  cancel = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params as RfqIdParams;
    const rfq = await this.rfqService.cancel(
      id,
      this.requireActor(req),
    );
    res.status(200).json({ success: true, data: { rfq } });
  };

  createQuote = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params as RfqIdParams;
    const quote = await this.rfqService.createQuote(
      id,
      this.requireActor(req),
      req.body as CreateSupplierQuoteBody,
    );
    res.status(201).json({ success: true, data: { quote } });
  };

  updateQuote = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params as QuoteIdParams;
    const quote = await this.rfqService.updateQuote(
      id,
      this.requireActor(req),
      req.body as UpdateSupplierQuoteBody,
    );
    res.status(200).json({ success: true, data: { quote } });
  };

  withdrawQuote = async (
    req: Request,
    res: Response,
  ): Promise<void> => {
    const { id } = req.params as QuoteIdParams;
    const quote = await this.rfqService.withdrawQuote(
      id,
      this.requireActor(req),
    );
    res.status(200).json({ success: true, data: { quote } });
  };

  rejectQuote = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params as QuoteIdParams;
    const quote = await this.rfqService.rejectQuote(
      id,
      this.requireActor(req),
    );
    res.status(200).json({ success: true, data: { quote } });
  };

  acceptQuote = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params as QuoteIdParams;
    const result = await this.rfqService.acceptQuote(
      id,
      this.requireActor(req),
    );
    res.status(201).json({ success: true, data: result });
  };

  private requireActor(req: Request) {
    if (!req.auth) {
      throw new UnauthorizedError();
    }
    return req.auth;
  }
}
