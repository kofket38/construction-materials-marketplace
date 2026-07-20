import type { Request, Response } from "express";
import type { ReviewService } from "../services/review.service.js";
import { UnauthorizedError } from "../utils/api-error.js";
import type {
  CreateReviewBody,
  ReviewIdParams,
  ReviewProductIdParams,
  UpdateReviewBody,
} from "../validators/review.validators.js";

export class ReviewController {
  constructor(private readonly reviewService: ReviewService) {}

  create = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params as ReviewProductIdParams;
    const review = await this.reviewService.create(
      id,
      this.requireActor(req),
      req.body as CreateReviewBody,
    );

    res.status(201).json({
      success: true,
      data: { review },
    });
  };

  findByProductId = async (
    req: Request,
    res: Response,
  ): Promise<void> => {
    const { id } = req.params as ReviewProductIdParams;
    const result = await this.reviewService.findByProductId(id);

    res.status(200).json({
      success: true,
      data: result,
    });
  };

  update = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params as ReviewIdParams;
    const review = await this.reviewService.update(
      id,
      this.requireActor(req),
      req.body as UpdateReviewBody,
    );

    res.status(200).json({
      success: true,
      data: { review },
    });
  };

  delete = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params as ReviewIdParams;
    await this.reviewService.delete(id, this.requireActor(req));

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
