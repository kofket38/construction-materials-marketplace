import {
  Prisma,
  type PrismaClient,
} from "../prisma/generated/client.js";
import {
  ProductCategoryNotFoundError,
  ProductImageLimitError,
  ProductInUseError,
  ProductSellerNotFoundError,
} from "./product.errors.js";
import type {
  CreateProductInput,
  ProductImageEntity,
  ProductDetailsEntity,
  ProductDiscoveryQuery,
  ProductDiscoveryResult,
  ProductEntity,
  ProductRepository,
  UpdateProductInput,
} from "./product.repository.js";
import { MAX_PRODUCT_IMAGES } from "./product.repository.js";

const productRelations = {
  seller: {
    select: {
      id: true,
      name: true,
    },
  },
  category: {
    select: {
      id: true,
      name: true,
    },
  },
} satisfies Prisma.ProductInclude;

type ProductWithRelations = Prisma.ProductGetPayload<{
  include: typeof productRelations;
}>;

function mapProduct(product: ProductWithRelations): ProductEntity {
  return {
    id: product.id,
    sellerId: product.sellerId,
    categoryId: product.categoryId,
    name: product.name,
    description: product.description,
    price: product.price.toFixed(2),
    quantity: product.quantity,
    imageUrl: product.imageUrl,
    seller: product.seller,
    category: product.category,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
  };
}

function mapProductImage(image: {
  id: string;
  productId: string;
  imageUrl: string;
  isPrimary: boolean;
  createdAt: Date;
}): ProductImageEntity {
  return {
    id: image.id,
    productId: image.productId,
    imageUrl: image.imageUrl,
    isPrimary: image.isPrimary,
    createdAt: image.createdAt,
  };
}

function hasPrismaCode(error: unknown, code: string): boolean {
  return (
    error instanceof Error &&
    "code" in error &&
    error.code === code
  );
}

export class PrismaProductRepository implements ProductRepository {
  constructor(private readonly client: PrismaClient) {}

  async create(input: CreateProductInput): Promise<ProductEntity> {
    await this.requireCategory(input.categoryId);

    try {
      const product = await this.client.product.create({
        data: {
          sellerId: input.sellerId,
          categoryId: input.categoryId,
          name: input.name,
          description: input.description,
          price: input.price,
          quantity: input.quantity,
          ...(input.imageUrl !== undefined
            ? {
                imageUrl: input.imageUrl,
                images: {
                  create: {
                    imageUrl: input.imageUrl,
                    isPrimary: true,
                  },
                },
              }
            : {}),
        },
        include: productRelations,
      });

      return mapProduct(product);
    } catch (error) {
      if (hasPrismaCode(error, "P2003")) {
        if (!(await this.categoryExists(input.categoryId))) {
          throw new ProductCategoryNotFoundError();
        }
        throw new ProductSellerNotFoundError();
      }

      throw error;
    }
  }

  async findAll(
    query: ProductDiscoveryQuery,
  ): Promise<ProductDiscoveryResult> {
    const where = productDiscoveryWhere(query);
    const [totalItems, products] = await this.client.$transaction([
      this.client.product.count({ where }),
      this.client.product.findMany({
        where,
        include: productRelations,
        orderBy: productDiscoveryOrderBy(query),
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
    ]);
    const totalPages = Math.ceil(totalItems / query.limit);

    return {
      products: products.map(mapProduct),
      totalItems,
      totalPages,
      currentPage: query.page,
      pageSize: query.limit,
      hasNextPage: query.page < totalPages,
      hasPreviousPage: query.page > 1,
    };
  }

  async findById(id: string): Promise<ProductEntity | null> {
    const product = await this.client.product.findUnique({
      where: { id },
      include: productRelations,
    });

    return product ? mapProduct(product) : null;
  }

  async findDetailsById(
    id: string,
  ): Promise<ProductDetailsEntity | null> {
    const [product, ratingSummary] = await this.client.$transaction([
      this.client.product.findUnique({
        where: { id },
        include: productRelations,
      }),
      this.client.review.aggregate({
        where: { productId: id },
        _avg: { rating: true },
        _count: { _all: true },
      }),
    ]);

    if (!product) {
      return null;
    }

    return {
      ...mapProduct(product),
      averageRating:
        ratingSummary._avg.rating === null
          ? null
          : Number(ratingSummary._avg.rating.toFixed(2)),
      reviewCount: ratingSummary._count._all,
    };
  }

  async update(
    id: string,
    input: UpdateProductInput,
  ): Promise<ProductEntity | null> {
    if (input.categoryId !== undefined) {
      await this.requireCategory(input.categoryId);
    }

    try {
      return await this.client.$transaction(async (transaction) => {
        if (!(await lockProduct(transaction, id))) {
          return null;
        }

        const primaryImageUrl =
          input.imageUrl === undefined
            ? undefined
            : await synchronizeLegacyImage(
                transaction,
                id,
                input.imageUrl,
              );

        const product = await transaction.product.update({
          where: { id },
          data: {
            ...(input.categoryId !== undefined
              ? { categoryId: input.categoryId }
              : {}),
            ...(input.name !== undefined ? { name: input.name } : {}),
            ...(input.description !== undefined
              ? { description: input.description }
              : {}),
            ...(input.price !== undefined ? { price: input.price } : {}),
            ...(input.quantity !== undefined
              ? { quantity: input.quantity }
              : {}),
            ...(primaryImageUrl !== undefined
              ? { imageUrl: primaryImageUrl }
              : {}),
          },
          include: productRelations,
        });

        return mapProduct(product);
      });
    } catch (error) {
      if (hasPrismaCode(error, "P2025")) {
        return null;
      }
      if (hasPrismaCode(error, "P2003")) {
        throw new ProductCategoryNotFoundError();
      }

      throw error;
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      await this.client.product.delete({ where: { id } });
      return true;
    } catch (error) {
      if (hasPrismaCode(error, "P2025")) {
        return false;
      }
      if (hasPrismaCode(error, "P2003")) {
        throw new ProductInUseError();
      }

      throw error;
    }
  }

  async addImage(
    productId: string,
    imageUrl: string,
  ): Promise<ProductImageEntity | null> {
    return this.client.$transaction(async (transaction) => {
      if (!(await lockProduct(transaction, productId))) {
        return null;
      }

      const imageCount = await transaction.productImage.count({
        where: { productId },
      });
      if (imageCount >= MAX_PRODUCT_IMAGES) {
        throw new ProductImageLimitError(MAX_PRODUCT_IMAGES);
      }

      const isPrimary = imageCount === 0;
      const image = await transaction.productImage.create({
        data: {
          productId,
          imageUrl,
          isPrimary,
        },
      });

      if (isPrimary) {
        await transaction.product.update({
          where: { id: productId },
          data: { imageUrl },
        });
      }

      return mapProductImage(image);
    });
  }

  async findImages(productId: string): Promise<ProductImageEntity[]> {
    const images = await this.client.productImage.findMany({
      where: { productId },
      orderBy: [
        { isPrimary: "desc" },
        { createdAt: "asc" },
        { id: "asc" },
      ],
    });

    return images.map(mapProductImage);
  }

  async deleteImage(
    productId: string,
    imageId: string,
  ): Promise<boolean> {
    return this.client.$transaction(async (transaction) => {
      if (!(await lockProduct(transaction, productId))) {
        return false;
      }

      const image = await transaction.productImage.findFirst({
        where: {
          id: imageId,
          productId,
        },
      });
      if (!image) {
        return false;
      }

      await transaction.productImage.delete({
        where: { id: image.id },
      });

      if (image.isPrimary) {
        const replacement = await transaction.productImage.findFirst({
          where: { productId },
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        });

        if (replacement) {
          await transaction.productImage.update({
            where: { id: replacement.id },
            data: { isPrimary: true },
          });
        }

        await transaction.product.update({
          where: { id: productId },
          data: {
            imageUrl: replacement?.imageUrl ?? null,
          },
        });
      }

      return true;
    });
  }

  async setPrimaryImage(
    productId: string,
    imageId: string,
  ): Promise<ProductImageEntity | null> {
    return this.client.$transaction(async (transaction) => {
      if (!(await lockProduct(transaction, productId))) {
        return null;
      }

      const image = await transaction.productImage.findFirst({
        where: {
          id: imageId,
          productId,
        },
      });
      if (!image) {
        return null;
      }

      if (!image.isPrimary) {
        await transaction.productImage.updateMany({
          where: {
            productId,
            isPrimary: true,
          },
          data: { isPrimary: false },
        });

        await transaction.productImage.update({
          where: { id: image.id },
          data: { isPrimary: true },
        });
      }

      await transaction.product.update({
        where: { id: productId },
        data: { imageUrl: image.imageUrl },
      });

      return {
        ...mapProductImage(image),
        isPrimary: true,
      };
    });
  }

  private async requireCategory(categoryId: string): Promise<void> {
    if (!(await this.categoryExists(categoryId))) {
      throw new ProductCategoryNotFoundError();
    }
  }

  private async categoryExists(categoryId: string): Promise<boolean> {
    const category = await this.client.category.findUnique({
      where: { id: categoryId },
      select: { id: true },
    });

    return category !== null;
  }
}

async function lockProduct(
  transaction: Prisma.TransactionClient,
  productId: string,
): Promise<boolean> {
  const rows = await transaction.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT "id"
    FROM "products"
    WHERE "id" = ${productId}::uuid
    FOR UPDATE
  `);

  return rows.length === 1;
}

async function synchronizeLegacyImage(
  transaction: Prisma.TransactionClient,
  productId: string,
  imageUrl: string | null,
): Promise<string | null> {
  const currentPrimary = await transaction.productImage.findFirst({
    where: {
      productId,
      isPrimary: true,
    },
  });

  if (imageUrl !== null) {
    if (currentPrimary) {
      await transaction.productImage.update({
        where: { id: currentPrimary.id },
        data: { imageUrl },
      });
      return imageUrl;
    }

    const imageCount = await transaction.productImage.count({
      where: { productId },
    });
    if (imageCount >= MAX_PRODUCT_IMAGES) {
      throw new ProductImageLimitError(MAX_PRODUCT_IMAGES);
    }

    await transaction.productImage.create({
      data: {
        productId,
        imageUrl,
        isPrimary: true,
      },
    });
    return imageUrl;
  }

  if (currentPrimary) {
    await transaction.productImage.delete({
      where: { id: currentPrimary.id },
    });
  }

  const replacement = await transaction.productImage.findFirst({
    where: { productId },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });
  if (!replacement) {
    return null;
  }

  await transaction.productImage.update({
    where: { id: replacement.id },
    data: { isPrimary: true },
  });
  return replacement.imageUrl;
}

function productDiscoveryWhere(
  query: ProductDiscoveryQuery,
): Prisma.ProductWhereInput {
  return {
    ...(query.search !== undefined
      ? {
          OR: [
            {
              name: {
                contains: query.search,
                mode: "insensitive",
              },
            },
            {
              description: {
                contains: query.search,
                mode: "insensitive",
              },
            },
            {
              seller: {
                is: {
                  sellerProfile: {
                    is: {
                      shopName: {
                        contains: query.search,
                        mode: "insensitive",
                      },
                    },
                  },
                },
              },
            },
          ],
        }
      : {}),
    ...(query.categoryId !== undefined
      ? { categoryId: query.categoryId }
      : {}),
    ...(query.sellerId !== undefined ? { sellerId: query.sellerId } : {}),
    ...(query.minPrice !== undefined || query.maxPrice !== undefined
      ? {
          price: {
            ...(query.minPrice !== undefined
              ? { gte: new Prisma.Decimal(query.minPrice) }
              : {}),
            ...(query.maxPrice !== undefined
              ? { lte: new Prisma.Decimal(query.maxPrice) }
              : {}),
          },
        }
      : {}),
    ...(query.stock !== undefined
      ? {
          quantity:
            query.stock === "in_stock"
              ? { gt: 0 }
              : { equals: 0 },
        }
      : {}),
  };
}

function productDiscoveryOrderBy(
  query: ProductDiscoveryQuery,
): Prisma.ProductOrderByWithRelationInput[] {
  switch (query.sortBy) {
    case "newest":
      return [{ createdAt: "desc" }, { id: "asc" }];
    case "oldest":
      return [{ createdAt: "asc" }, { id: "asc" }];
    case "price":
      return [{ price: query.sortOrder }, { id: "asc" }];
    case "name":
      return [{ name: query.sortOrder }, { id: "asc" }];
    case "popularity":
      return [
        { orderItems: { _count: query.sortOrder } },
        { createdAt: "desc" },
        { id: "asc" },
      ];
  }
}
