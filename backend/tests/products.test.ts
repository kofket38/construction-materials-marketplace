import { randomUUID } from "node:crypto";
import pino from "pino";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { JwtTokenService } from "../src/services/token.service.js";
import { InMemoryProductRepository } from "./helpers/in-memory-product.repository.js";
import { InMemoryUserRepository } from "./helpers/in-memory-user.repository.js";

const categoryId = randomUUID();
const steelCategoryId = randomUUID();
const sellerId = randomUUID();
const otherSellerId = randomUUID();
const customerId = randomUUID();

const productInput = {
  name: "Portland Cement 42.5N",
  description: "High-strength cement supplied in 50 kg bags.",
  price: "850.00",
  quantity: 120,
  categoryId,
  imageUrl: "https://example.com/cement.jpg",
};

describe("Product API", () => {
  const tokenService = new JwtTokenService();
  let app: ReturnType<typeof createApp>;
  let products: InMemoryProductRepository;
  let users: InMemoryUserRepository;
  let sellerToken: string;
  let otherSellerToken: string;
  let customerToken: string;

  beforeEach(() => {
    products = new InMemoryProductRepository();
    products.addCategory({ id: categoryId, name: "Cement" });
    products.addCategory({ id: steelCategoryId, name: "Steel" });
    products.addSeller(sellerId, "Seller One", "Kamau Materials");
    products.addSeller(otherSellerId, "Seller Two", "Mjenzi Depot");

    users = new InMemoryUserRepository();
    users.addUser({ id: sellerId, role: "SELLER" });
    users.addUser({ id: otherSellerId, role: "SELLER" });
    users.addUser({ id: customerId, role: "CUSTOMER" });

    app = createApp({
      userRepository: users,
      productRepository: products,
      tokenService,
      logger: pino({ level: "silent" }),
    });

    sellerToken = tokenService.createAccessToken({
      userId: sellerId,
      role: "SELLER",
    });
    otherSellerToken = tokenService.createAccessToken({
      userId: otherSellerId,
      role: "SELLER",
    });
    customerToken = tokenService.createAccessToken({
      userId: customerId,
      role: "CUSTOMER",
    });
  });

  it("allows a seller to create a product", async () => {
    const response = await createProduct(sellerToken, productInput, 201);

    expect(response.body).toMatchObject({
      success: true,
      data: {
        product: {
          sellerId,
          categoryId,
          name: productInput.name,
          price: "850.00",
          quantity: 120,
          seller: { id: sellerId, name: "Seller One" },
          category: { id: categoryId, name: "Cement" },
        },
      },
    });
  });

  it("prevents a customer from creating a product", async () => {
    const response = await createProduct(customerToken, productInput, 403);

    expect(response.body).toEqual({
      success: false,
      message: "You do not have permission to perform this action.",
      errors: [],
    });
  });

  it("allows the owner to update a product", async () => {
    const product = await seedProduct();

    const response = await request(app)
      .put(`/api/products/${product.id}`)
      .set("Authorization", `Bearer ${sellerToken}`)
      .send({ name: "Premium Portland Cement", price: 900, quantity: 75 })
      .expect(200);

    expect(response.body.data.product).toMatchObject({
      id: product.id,
      name: "Premium Portland Cement",
      price: "900.00",
      quantity: 75,
      sellerId,
    });
  });

  it("prevents a non-owner from updating a product", async () => {
    const product = await seedProduct();

    const response = await request(app)
      .put(`/api/products/${product.id}`)
      .set("Authorization", `Bearer ${otherSellerToken}`)
      .send({ quantity: 1 })
      .expect(403);

    expect(response.body.message).toBe(
      "You can only update products that you own.",
    );
  });

  it("allows the owner to delete a product", async () => {
    const product = await seedProduct();

    const response = await request(app)
      .delete(`/api/products/${product.id}`)
      .set("Authorization", `Bearer ${sellerToken}`)
      .send({})
      .expect(200);

    expect(response.body).toEqual({ success: true, data: null });
    await request(app).get(`/api/products/${product.id}`).expect(404);
  });

  it("prevents a non-owner from deleting a product", async () => {
    const product = await seedProduct();

    const response = await request(app)
      .delete(`/api/products/${product.id}`)
      .set("Authorization", `Bearer ${otherSellerToken}`)
      .send({})
      .expect(403);

    expect(response.body.message).toBe(
      "You can only delete products that you own.",
    );
    expect(await products.findById(product.id)).not.toBeNull();
  });

  it("allows a seller to add an image to an owned product", async () => {
    const product = await seedProductWithoutImage();
    const imageUrl = "https://example.com/cement-front.jpg";

    const response = await addProductImage(
      product.id,
      sellerToken,
      imageUrl,
      201,
    );

    expect(response.body).toMatchObject({
      success: true,
      data: {
        image: {
          productId: product.id,
          imageUrl,
          isPrimary: true,
        },
      },
    });
    expect((await products.findById(product.id))?.imageUrl).toBe(imageUrl);
  });

  it("prevents a customer from adding a product image", async () => {
    const product = await seedProductWithoutImage();

    const response = await addProductImage(
      product.id,
      customerToken,
      "https://example.com/customer-upload.jpg",
      403,
    );

    expect(response.body).toEqual({
      success: false,
      message: "You do not have permission to perform this action.",
      errors: [],
    });
  });

  it("prevents a non-owner seller from managing product images", async () => {
    const product = await seedProductWithoutImage();
    const image = (
      await addProductImage(
        product.id,
        sellerToken,
        "https://example.com/owned-image.jpg",
        201,
      )
    ).body.data.image as { id: string };

    const addResponse = await addProductImage(
      product.id,
      otherSellerToken,
      "https://example.com/not-owned.jpg",
      403,
    );
    const primaryResponse = await request(app)
      .patch(`/api/products/${product.id}/images/${image.id}/primary`)
      .set("Authorization", `Bearer ${otherSellerToken}`)
      .send({})
      .expect(403);
    const deleteResponse = await request(app)
      .delete(`/api/products/${product.id}/images/${image.id}`)
      .set("Authorization", `Bearer ${otherSellerToken}`)
      .send({})
      .expect(403);

    for (const response of [
      addResponse,
      primaryResponse,
      deleteResponse,
    ]) {
      expect(response.body.message).toBe(
        "You can only manage images for products that you own.",
      );
    }
  });

  it("allows public access to product images", async () => {
    const product = await seedProductWithoutImage();
    const firstUrl = "https://example.com/cement-front.jpg";
    const secondUrl = "https://example.com/cement-side.jpg";
    await addProductImage(product.id, sellerToken, firstUrl, 201);
    await addProductImage(product.id, sellerToken, secondUrl, 201);

    const response = await request(app)
      .get(`/api/products/${product.id}/images`)
      .expect(200);

    expect(response.body).toMatchObject({
      success: true,
      data: {
        images: [
          { imageUrl: firstUrl, isPrimary: true },
          { imageUrl: secondUrl, isPrimary: false },
        ],
      },
    });
  });

  it("switches and replaces the primary product image", async () => {
    const product = await seedProductWithoutImage();
    const firstUrl = "https://example.com/cement-front.jpg";
    const secondUrl = "https://example.com/cement-side.jpg";
    const firstImage = (
      await addProductImage(product.id, sellerToken, firstUrl, 201)
    ).body.data.image as { id: string };
    const secondImage = (
      await addProductImage(product.id, sellerToken, secondUrl, 201)
    ).body.data.image as { id: string };

    const primaryResponse = await request(app)
      .patch(
        `/api/products/${product.id}/images/${secondImage.id}/primary`,
      )
      .set("Authorization", `Bearer ${sellerToken}`)
      .send({})
      .expect(200);

    expect(primaryResponse.body.data.image).toMatchObject({
      id: secondImage.id,
      isPrimary: true,
    });
    expect((await products.findById(product.id))?.imageUrl).toBe(secondUrl);

    await request(app)
      .delete(`/api/products/${product.id}/images/${secondImage.id}`)
      .set("Authorization", `Bearer ${sellerToken}`)
      .send({})
      .expect(200);

    let imagesResponse = await request(app)
      .get(`/api/products/${product.id}/images`)
      .expect(200);
    expect(imagesResponse.body.data.images).toMatchObject([
      {
        id: firstImage.id,
        imageUrl: firstUrl,
        isPrimary: true,
      },
    ]);
    expect((await products.findById(product.id))?.imageUrl).toBe(firstUrl);

    await request(app)
      .delete(`/api/products/${product.id}/images/${firstImage.id}`)
      .set("Authorization", `Bearer ${sellerToken}`)
      .send({})
      .expect(200);

    imagesResponse = await request(app)
      .get(`/api/products/${product.id}/images`)
      .expect(200);
    expect(imagesResponse.body.data.images).toEqual([]);
    expect((await products.findById(product.id))?.imageUrl).toBeNull();
  });

  it("validates image URLs and limits products to eight images", async () => {
    const product = await seedProductWithoutImage();

    await addProductImage(
      product.id,
      sellerToken,
      "ftp://example.com/cement.jpg",
      400,
    );

    for (let index = 1; index <= 8; index += 1) {
      await addProductImage(
        product.id,
        sellerToken,
        `https://example.com/cement-${index}.jpg`,
        201,
      );
    }

    const response = await addProductImage(
      product.id,
      sellerToken,
      "https://example.com/cement-9.jpg",
      409,
    );
    expect(response.body.message).toBe(
      "A product can have at most 8 images.",
    );
  });

  it("allows public product listing", async () => {
    const product = await seedProduct();

    const response = await request(app).get("/api/products").expect(200);

    expect(response.body).toMatchObject({
      success: true,
      data: {
        products: [{ id: product.id, name: productInput.name }],
        totalItems: 1,
        totalPages: 1,
        currentPage: 1,
        pageSize: 20,
        hasNextPage: false,
        hasPreviousPage: false,
      },
    });
  });

  it("paginates product discovery results", async () => {
    const discoveryProducts = await seedDiscoveryProducts();

    const response = await request(app)
      .get("/api/products?page=2&limit=2&sortBy=name&sortOrder=asc")
      .expect(200);

    expect(
      response.body.data.products.map(
        (product: { id: string }) => product.id,
      ),
    ).toEqual([
      discoveryProducts.steel.id,
      discoveryProducts.tileAdhesive.id,
    ]);
    expect(response.body.data).toMatchObject({
      totalItems: 4,
      totalPages: 2,
      currentPage: 2,
      pageSize: 2,
      hasNextPage: false,
      hasPreviousPage: true,
    });
  });

  it("searches product names, descriptions, and seller shop names", async () => {
    const discoveryProducts = await seedDiscoveryProducts();

    const byName = await request(app)
      .get("/api/products?search=reinforcement")
      .expect(200);
    expect(byName.body.data.products).toHaveLength(1);
    expect(byName.body.data.products[0].id).toBe(discoveryProducts.steel.id);

    const byDescription = await request(app)
      .get("/api/products?search=river%20aggregate")
      .expect(200);
    expect(byDescription.body.data.products).toHaveLength(1);
    expect(byDescription.body.data.products[0].id).toBe(
      discoveryProducts.sand.id,
    );

    const byShopName = await request(app)
      .get("/api/products?search=mjenzi")
      .expect(200);
    expect(
      byShopName.body.data.products.map(
        (product: { id: string }) => product.id,
      ),
    ).toEqual([
      discoveryProducts.tileAdhesive.id,
      discoveryProducts.steel.id,
    ]);
  });

  it("filters products by category and seller", async () => {
    const discoveryProducts = await seedDiscoveryProducts();

    const byCategory = await request(app)
      .get(`/api/products?categoryId=${steelCategoryId}`)
      .expect(200);
    expect(byCategory.body.data.products).toHaveLength(1);
    expect(byCategory.body.data.products[0].id).toBe(
      discoveryProducts.steel.id,
    );

    const bySeller = await request(app)
      .get(`/api/products?sellerId=${sellerId}&sortBy=name`)
      .expect(200);
    expect(
      bySeller.body.data.products.map(
        (product: { id: string }) => product.id,
      ),
    ).toEqual([
      discoveryProducts.sand.id,
      discoveryProducts.cement.id,
    ]);
  });

  it("filters products by inclusive minimum and maximum prices", async () => {
    const discoveryProducts = await seedDiscoveryProducts();

    const response = await request(app)
      .get("/api/products?minPrice=500&maxPrice=850&sortBy=price")
      .expect(200);

    expect(
      response.body.data.products.map(
        (product: { id: string }) => product.id,
      ),
    ).toEqual([
      discoveryProducts.sand.id,
      discoveryProducts.cement.id,
    ]);
  });

  it("filters products by stock availability", async () => {
    const discoveryProducts = await seedDiscoveryProducts();

    const outOfStock = await request(app)
      .get("/api/products?stock=out_of_stock")
      .expect(200);
    expect(outOfStock.body.data.products).toHaveLength(1);
    expect(outOfStock.body.data.products[0].id).toBe(
      discoveryProducts.steel.id,
    );

    const inStock = await request(app)
      .get("/api/products?stock=in_stock")
      .expect(200);
    expect(inStock.body.data.products).toHaveLength(3);
  });

  it("sorts products by age, price, name, and popularity", async () => {
    const discoveryProducts = await seedDiscoveryProducts();

    const expectations = [
      ["newest", undefined, discoveryProducts.sand.id],
      ["oldest", undefined, discoveryProducts.cement.id],
      ["price", "desc", discoveryProducts.steel.id],
      ["name", "asc", discoveryProducts.sand.id],
      ["popularity", "desc", discoveryProducts.steel.id],
      ["popularity", "asc", discoveryProducts.sand.id],
    ] as const;

    for (const [sortBy, sortOrder, firstProductId] of expectations) {
      const query = new URLSearchParams({ sortBy });
      if (sortOrder !== undefined) {
        query.set("sortOrder", sortOrder);
      }

      const response = await request(app)
        .get(`/api/products?${query.toString()}`)
        .expect(200);
      expect(response.body.data.products[0].id).toBe(firstProductId);
    }
  });

  it("rejects invalid product discovery query parameters", async () => {
    const invalidQueries = [
      "page=0",
      "limit=101",
      "search=%20%20%20",
      "categoryId=not-a-uuid",
      "sellerId=not-a-uuid",
      "minPrice=-1",
      "maxPrice=1.234",
      "minPrice=900&maxPrice=100",
      "stock=available",
      "sortBy=rating",
      "sortOrder=sideways",
      "unknown=value",
    ];

    for (const query of invalidQueries) {
      await request(app).get(`/api/products?${query}`).expect(400);
    }
  });

  it("allows public access to a single product", async () => {
    const product = await seedProduct();

    const response = await request(app)
      .get(`/api/products/${product.id}`)
      .expect(200);

    expect(response.body.data.product).toMatchObject({
      id: product.id,
      category: { name: "Cement" },
      seller: { name: "Seller One" },
    });
  });

  it("rejects missing categories and malformed product IDs", async () => {
    const missingCategoryResponse = await createProduct(
      sellerToken,
      { ...productInput, categoryId: randomUUID() },
      404,
    );
    expect(missingCategoryResponse.body.message).toBe(
      "The selected category does not exist.",
    );

    const malformedIdResponse = await request(app)
      .get("/api/products/not-a-uuid")
      .expect(400);
    expect(malformedIdResponse.body.message).toBe("Request validation failed.");
  });

  async function createProduct(
    token: string,
    body: Record<string, unknown>,
    status: number,
  ) {
    return request(app)
      .post("/api/products")
      .set("Authorization", `Bearer ${token}`)
      .send(body)
      .expect(status);
  }

  async function seedProduct() {
    const response = await createProduct(sellerToken, productInput, 201);
    return response.body.data.product as { id: string };
  }

  async function seedProductWithoutImage() {
    const { imageUrl: _imageUrl, ...input } = productInput;
    const response = await createProduct(sellerToken, input, 201);
    return response.body.data.product as { id: string };
  }

  async function addProductImage(
    productId: string,
    token: string,
    imageUrl: string,
    status: number,
  ) {
    return request(app)
      .post(`/api/products/${productId}/images`)
      .set("Authorization", `Bearer ${token}`)
      .send({ imageUrl })
      .expect(status);
  }

  async function seedDiscoveryProducts() {
    const cement = (
      await createProduct(sellerToken, productInput, 201)
    ).body.data.product as { id: string };
    const steel = (
      await createProduct(
        otherSellerToken,
        {
          name: "Steel Reinforcement Bar",
          description: "Ribbed construction steel for reinforced concrete.",
          price: "1200.00",
          quantity: 0,
          categoryId: steelCategoryId,
        },
        201,
      )
    ).body.data.product as { id: string };
    const tileAdhesive = (
      await createProduct(
        otherSellerToken,
        {
          name: "Tile Adhesive",
          description: "Cement-based adhesive for ceramic tiles.",
          price: "300.00",
          quantity: 15,
          categoryId,
        },
        201,
      )
    ).body.data.product as { id: string };
    const sand = (
      await createProduct(
        sellerToken,
        {
          name: "Building Sand",
          description: "Washed river aggregate for masonry and plaster.",
          price: "500.00",
          quantity: 4,
          categoryId,
        },
        201,
      )
    ).body.data.product as { id: string };

    products.setCreatedAt(cement.id, new Date("2026-01-01T00:00:00.000Z"));
    products.setCreatedAt(steel.id, new Date("2026-01-02T00:00:00.000Z"));
    products.setCreatedAt(
      tileAdhesive.id,
      new Date("2026-01-03T00:00:00.000Z"),
    );
    products.setCreatedAt(sand.id, new Date("2026-01-04T00:00:00.000Z"));
    products.setPopularity(cement.id, 2);
    products.setPopularity(steel.id, 8);
    products.setPopularity(tileAdhesive.id, 5);
    products.setPopularity(sand.id, 1);

    return { cement, steel, tileAdhesive, sand };
  }
});
