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
  MarketplaceCityEntity,
  MarketplaceSellerEntity,
  SellerStoreEntity,
  UpdateProductInput,
} from "./product.repository.js";
import { MAX_PRODUCT_IMAGES } from "./product.repository.js";

const productRelations = {
  seller: {
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      sellerProfile: {
        select: {
          address: true,
          phone: true,
          shopName: true,
        },
      },
    },
  },
  category: {
    select: {
      id: true,
      name: true,
    },
  },
  brand: {
    select: {
      id: true,
      name: true,
    },
  },
  inventory: {
    orderBy: [{ city: "asc" }, { quantity: "desc" }, { id: "asc" }],
    select: {
      city: true,
      deliveryAvailable: true,
      price: true,
      quantity: true,
      region: true,
    },
  },
  reviews: {
    select: {
      rating: true,
    },
  },
  images: {
    orderBy: [
      {
        isPrimary: "desc",
      },
      {
        type: "asc",
      },
      {
        createdAt: "asc",
      },
    ],
    select: {
      imageUrl: true,
      type: true,
      isPrimary: true,
    },
    take: 1,
  },
} satisfies Prisma.ProductInclude;

type ProductWithRelations = Prisma.ProductGetPayload<{
  include: typeof productRelations;
}>;

function mapProduct(product: ProductWithRelations): ProductEntity {
  const parsedDescription = parseProductDescription(product.description);
  const rating = summarizeRatings(product.reviews);
  const primaryInventory = product.inventory[0];

  return {
    id: product.id,
    sellerId: product.sellerId,
    categoryId: product.categoryId,
    name: product.name,
    description: parsedDescription.summary,
    price: product.price.toFixed(2),
    quantity: product.quantity,
    imageUrl: product.images[0]?.imageUrl ?? product.imageUrl,
    averageRating: rating.averageRating,
    reviewCount: rating.reviewCount,
    seller: {
      id: product.seller.id,
      name: product.seller.name,
      address: product.seller.sellerProfile?.address ?? null,
      city: primaryInventory?.city ?? null,
      email: product.seller.email,
      phone:
        product.seller.sellerProfile?.phone ??
        product.seller.phone ??
        null,
      shopName: product.seller.sellerProfile?.shopName ?? null,
    },
    category: product.category,
    brand: product.brand,
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

  async findMarketplaceCities(): Promise<MarketplaceCityEntity[]> {
    const inventory = await this.client.sellerInventory.findMany({
      where: {
        seller: {
          is: {
            isActive: true,
            role: "SELLER",
          },
        },
      },
      select: {
        city: true,
        productId: true,
        sellerId: true,
      },
      orderBy: {
        city: "asc",
      },
    });
    const cities = new Map<
      string,
      { productIds: Set<string>; sellerIds: Set<string> }
    >();

    for (const item of inventory) {
      const cityName = item.city.trim();
      if (!cityName) {
        continue;
      }
      const city = cities.get(cityName) ?? {
        productIds: new Set<string>(),
        sellerIds: new Set<string>(),
      };
      city.productIds.add(item.productId);
      city.sellerIds.add(item.sellerId);
      cities.set(cityName, city);
    }

    return [...cities.entries()].map(([name, city]) => ({
      name,
      productCount: city.productIds.size,
      sellerCount: city.sellerIds.size,
    }));
  }

  async findMarketplaceSellers(
    city: string,
  ): Promise<MarketplaceSellerEntity[]> {
    const sellers = await this.client.user.findMany({
      where: {
        isActive: true,
        role: "SELLER",
        listedProducts: {
          some: marketplaceCityProductFilter(city),
        },
      },
      select: {
        id: true,
        name: true,
        sellerProfile: {
          select: {
            shopName: true,
          },
        },
        listedProducts: {
          where: marketplaceCityProductFilter(city),
          select: {
            id: true,
            reviews: {
              select: {
                rating: true,
              },
            },
          },
        },
      },
      orderBy: [{ sellerProfile: { shopName: "asc" } }, { name: "asc" }],
    });

    return sellers.map((seller) => {
      const rating = summarizeRatings(
        seller.listedProducts.flatMap((product) => product.reviews),
      );

      return {
        id: seller.id,
        name: seller.name,
        shopName: seller.sellerProfile?.shopName ?? null,
        city,
        productCount: seller.listedProducts.length,
        averageRating: rating.averageRating,
        reviewCount: rating.reviewCount,
      };
    });
  }

  async findSellerStore(
    sellerId: string,
    city?: string,
  ): Promise<SellerStoreEntity | null> {
    const seller = await this.client.user.findFirst({
      where: {
        id: sellerId,
        isActive: true,
        role: "SELLER",
        ...(city !== undefined
          ? {
              listedProducts: {
                some: marketplaceCityProductFilter(city),
              },
            }
          : {}),
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        createdAt: true,
        sellerProfile: {
          select: {
            address: true,
            phone: true,
            shopName: true,
          },
        },
        listedProducts: {
          ...(city !== undefined
            ? { where: marketplaceCityProductFilter(city) }
            : {}),
          select: {
            id: true,
            inventory: {
              select: {
                city: true,
              },
            },
            reviews: {
              select: {
                rating: true,
              },
            },
          },
        },
      },
    });

    if (!seller) {
      return null;
    }

    const cities = [
      ...new Set(
        seller.listedProducts.flatMap((product) =>
          product.inventory.map((inventory) => inventory.city.trim()),
        ),
      ),
    ]
      .filter(Boolean)
      .sort((left, right) => left.localeCompare(right));
    const rating = summarizeRatings(
      seller.listedProducts.flatMap((product) => product.reviews),
    );

    return {
      id: seller.id,
      name: seller.name,
      storeName: seller.sellerProfile?.shopName || seller.name,
      logoUrl: null,
      city: city ?? cities[0] ?? null,
      cities,
      address: seller.sellerProfile?.address ?? null,
      phone: seller.sellerProfile?.phone ?? seller.phone ?? null,
      email: seller.email,
      averageRating: rating.averageRating,
      reviewCount: rating.reviewCount,
      totalProducts: seller.listedProducts.length,
      joinedAt: seller.createdAt,
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
    const product = await this.client.product.findUnique({
      where: { id },
      include: productRelations,
    });

    if (!product) {
      return null;
    }

    const sellerRating = await this.client.review.aggregate({
      where: {
        product: {
          is: {
            sellerId: product.sellerId,
          },
        },
      },
      _avg: { rating: true },
      _count: { _all: true },
    });
    const parsedDescription = parseProductDescription(product.description);
    const inventory = product.inventory.map((item) => ({
      city: item.city,
      deliveryAvailable: item.deliveryAvailable,
      price: item.price.toFixed(2),
      quantity: item.quantity,
      region: item.region,
    }));
    const primaryInventory = inventory[0];

    return {
      ...mapProduct(product),
      averageRating: summarizeRatings(product.reviews).averageRating,
      deliveryAvailable: inventory.some(
        (item) => item.deliveryAvailable,
      ),
      inventory,
      location: primaryInventory
        ? [primaryInventory.city, primaryInventory.region]
            .filter(Boolean)
            .join(", ")
        : null,
      minimumOrder:
        getSpecification(parsedDescription.specifications, "Minimum order") ??
        null,
      origin:
        getSpecification(parsedDescription.specifications, "Origin") ?? null,
      packaging:
        getSpecification(parsedDescription.specifications, "Packaging") ??
        null,
      reviewCount: product.reviews.length,
      seller: {
        ...mapProduct(product).seller,
        averageRating:
          sellerRating._avg.rating === null
            ? null
            : Number(sellerRating._avg.rating.toFixed(2)),
        reviewCount: sellerRating._count._all,
      },
      specifications: parsedDescription.specifications,
      strengthGrade:
        getSpecification(
          parsedDescription.specifications,
          "Strength grade",
        ) ?? null,
      weight:
        getSpecification(parsedDescription.specifications, "Weight") ?? null,
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
    ...(query.city !== undefined
      ? marketplaceCityProductFilter(query.city)
      : {}),
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
              category: {
                is: {
                  name: {
                    contains: query.search,
                    mode: "insensitive",
                  },
                },
              },
            },
            {
              brand: {
                is: {
                  name: {
                    contains: query.search,
                    mode: "insensitive",
                  },
                },
              },
            },
            {
              seller: {
                is: {
                  name: {
                    contains: query.search,
                    mode: "insensitive",
                  },
                },
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

function marketplaceCityProductFilter(
  city: string,
): Prisma.ProductWhereInput {
  return {
    inventory: {
      some: {
        city: {
          equals: city,
          mode: "insensitive",
        },
      },
    },
  };
}

function summarizeRatings(
  ratings: ReadonlyArray<{ rating: number }>,
): { averageRating: number | null; reviewCount: number } {
  if (ratings.length === 0) {
    return {
      averageRating: null,
      reviewCount: 0,
    };
  }

  return {
    averageRating: Number(
      (
        ratings.reduce((sum, review) => sum + review.rating, 0) /
        ratings.length
      ).toFixed(2),
    ),
    reviewCount: ratings.length,
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

const SPECIFICATIONS_MARKER = "\n\nSpecifications:\n";

interface ParsedProductDescription {
  specifications: Record<string, string>;
  summary: string;
}

function parseProductDescription(
  description: string,
): ParsedProductDescription {
  const markerIndex = description.indexOf(SPECIFICATIONS_MARKER);
  if (markerIndex === -1) {
    return {
      specifications: {},
      summary: description,
    };
  }

  const specifications = Object.fromEntries(
    description
      .slice(markerIndex + SPECIFICATIONS_MARKER.length)
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const separatorIndex = line.indexOf(":");
        if (separatorIndex === -1) {
          return null;
        }

        return [
          line.slice(0, separatorIndex).trim(),
          line.slice(separatorIndex + 1).trim(),
        ] as [string, string];
      })
      .filter(
        (entry): entry is [string, string] =>
          entry !== null && entry[0].length > 0 && entry[1].length > 0,
      ),
  );

  return {
    specifications,
    summary: description.slice(0, markerIndex).trim(),
  };
}

function getSpecification(
  specifications: Record<string, string>,
  label: string,
): string | undefined {
  const normalizedLabel = label.toLowerCase();
  return Object.entries(specifications).find(
    ([key]) => key.toLowerCase() === normalizedLabel,
  )?.[1];
}
