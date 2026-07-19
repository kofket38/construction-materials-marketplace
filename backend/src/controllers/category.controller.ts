import type { Request, Response } from "express";
import type { CategoryService } from "../services/category.service.js";
import { UnauthorizedError } from "../utils/api-error.js";
import type {
  CategoryIdParams,
  CreateCategoryBody,
  UpdateCategoryBody,
} from "../validators/category.validators.js";

export class CategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  create = async (req: Request, res: Response): Promise<void> => {
    const category = await this.categoryService.create(
      this.requireActor(req),
      req.body as CreateCategoryBody,
    );

    res.status(201).json({
      success: true,
      data: { category },
    });
  };

  findAll = async (_req: Request, res: Response): Promise<void> => {
    const categories = await this.categoryService.findAll();

    res.status(200).json({
      success: true,
      data: { categories },
    });
  };

  findById = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params as CategoryIdParams;
    const category = await this.categoryService.findById(id);

    res.status(200).json({
      success: true,
      data: { category },
    });
  };

  update = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params as CategoryIdParams;
    const category = await this.categoryService.update(
      id,
      this.requireActor(req),
      req.body as UpdateCategoryBody,
    );

    res.status(200).json({
      success: true,
      data: { category },
    });
  };

  delete = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params as CategoryIdParams;
    await this.categoryService.delete(id, this.requireActor(req));

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
