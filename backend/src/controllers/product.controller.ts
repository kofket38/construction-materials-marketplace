import type { Request, Response } from "express";
import type { ProductService } from "../services/product.service.js";
import { UnauthorizedError } from "../utils/api-error.js";
import type {
  AddProductImageBody,
  CreateProductBody,
  ProductDiscoveryQueryParams,
  ProductImageIdParams,
  ProductIdParams,
  UpdateProductBody,
} from "../validators/product.validators.js";

export class ProductController {
  constructor(private readonly productService: ProductService) {}

  create = async (req: Request, res: Response): Promise<void> => {
    const actor = this.requireActor(req);
    const product = await this.productService.create(
      actor,
      req.body as CreateProductBody,
    );

    res.status(201).json({
      success: true,
      data: { product },
    });
  };

  findAll = async (req: Request, res: Response): Promise<void> => {
    const result = await this.productService.findAll(
      req.query as ProductDiscoveryQueryParams,
    );

    res.status(200).json({
      success: true,
      data: result,
    });
  };

  findById = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params as ProductIdParams;
    const product = await this.productService.findById(id);

    res.status(200).json({
      success: true,
      data: { product },
    });
  };

  update = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params as ProductIdParams;
    const actor = this.requireActor(req);
    const product = await this.productService.update(
      id,
      actor,
      req.body as UpdateProductBody,
    );

    res.status(200).json({
      success: true,
      data: { product },
    });
  };

  delete = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params as ProductIdParams;
    const actor = this.requireActor(req);

    await this.productService.delete(id, actor);
    res.status(200).json({
      success: true,
      data: null,
    });
  };

  addImage = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params as ProductIdParams;
    const image = await this.productService.addImage(
      id,
      this.requireActor(req),
      req.body as AddProductImageBody,
    );

    res.status(201).json({
      success: true,
      data: { image },
    });
  };

  findImages = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params as ProductIdParams;
    const images = await this.productService.findImages(id);

    res.status(200).json({
      success: true,
      data: { images },
    });
  };

  deleteImage = async (req: Request, res: Response): Promise<void> => {
    const { id, imageId } = req.params as ProductImageIdParams;
    await this.productService.deleteImage(
      id,
      imageId,
      this.requireActor(req),
    );

    res.status(200).json({
      success: true,
      data: null,
    });
  };

  setPrimaryImage = async (
    req: Request,
    res: Response,
  ): Promise<void> => {
    const { id, imageId } = req.params as ProductImageIdParams;
    const image = await this.productService.setPrimaryImage(
      id,
      imageId,
      this.requireActor(req),
    );

    res.status(200).json({
      success: true,
      data: { image },
    });
  };

  private requireActor(req: Request) {
    if (!req.auth) {
      throw new UnauthorizedError();
    }

    return req.auth;
  }
}
