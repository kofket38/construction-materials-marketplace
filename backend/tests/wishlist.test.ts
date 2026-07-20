import { randomUUID } from "node:crypto";
import pino from "pino";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import type { ProductEntity } from "../src/repositories/product.repository.js";
import { JwtTokenService } from "../src/services/token.service.js";
import { InMemoryProductRepository } from "./helpers/in-memory-product.repository.js";
import { InMemoryUserRepository } from "./helpers/in-memory-user.repository.js";
import { InMemoryWishlistRepository } from "./helpers/in-memory-wishlist.repository.js";

const categoryId = randomUUID();
const sellerId = randomUUID();
const customerId = randomUUID();
const otherCustomerId = randomUUID();
const adminId = randomUUID();

describe("Wishlist API", () => {
  const tokenService = new JwtTokenService();
  let app: ReturnType<typeof createApp>;
  let wishlist: InMemoryWishlistRepository;
  let firstProduct: ProductEntity;
  let secondProduct: ProductEntity;
  let customerToken: string;
  let otherCustomerToken: string;
  let sellerToken: string;
  let adminToken: string;

  beforeEach(async () => {
    const products = new InMemoryProductRepository();
    products.addCategory({ id: categoryId, name: "Cement" });
    products.addSeller(sellerId, "Seller One", "Kamau Materials");
    firstProduct = await products.create({
      sellerId,
      categoryId,
      name: "Portland Cement",
      description: "High-strength bagged cement.",
      price: "850.00",
      quantity: 20,
      imageUrl: "https://example.com/cement.jpg",
    });
    secondProduct = await products.create({
      sellerId,
      categoryId,
      name: "Tile Adhesive",
      description: "Cement-based tile adhesive.",
      price: "300.00",
      quantity: 8,
    });

    wishlist = new InMemoryWishlistRepository();
    wishlist.addProduct(firstProduct);
    wishlist.addProduct(secondProduct);

    const users = new InMemoryUserRepository();
    users.addUser({
      id: customerId,
      name: "Primary Customer",
      role: "CUSTOMER",
    });
    users.addUser({
      id: otherCustomerId,
      name: "Other Customer",
      role: "CUSTOMER",
    });
    users.addUser({ id: sellerId, name: "Seller One", role: "SELLER" });
    users.addUser({ id: adminId, name: "Admin User", role: "ADMIN" });

    app = createApp({
      userRepository: users,
      productRepository: products,
      wishlistRepository: wishlist,
      tokenService,
      logger: pino({ level: "silent" }),
    });

    customerToken = createToken(customerId, "CUSTOMER");
    otherCustomerToken = createToken(otherCustomerId, "CUSTOMER");
    sellerToken = createToken(sellerId, "SELLER");
    adminToken = createToken(adminId, "ADMIN");
  });

  it("allows a customer to add an existing product", async () => {
    const response = await addToWishlist(
      customerToken,
      firstProduct.id,
      201,
    );

    expect(response.body).toMatchObject({
      success: true,
      data: {
        wishlistItem: {
          customerId,
          productId: firstProduct.id,
          product: {
            id: firstProduct.id,
            name: "Portland Cement",
            price: "850.00",
            quantity: 20,
            imageUrl: "https://example.com/cement.jpg",
            seller: { id: sellerId, name: "Seller One" },
            category: { id: categoryId, name: "Cement" },
          },
        },
      },
    });
  });

  it("rejects duplicate additions and missing products", async () => {
    await addToWishlist(customerToken, firstProduct.id, 201);

    const duplicate = await addToWishlist(
      customerToken,
      firstProduct.id,
      409,
    );
    expect(duplicate.body.message).toBe(
      "Product is already in your wishlist.",
    );

    const missing = await addToWishlist(
      customerToken,
      randomUUID(),
      404,
    );
    expect(missing.body.message).toBe("Product not found.");
  });

  it("requires authentication and a customer role", async () => {
    await request(app)
      .get("/api/wishlist")
      .expect(401);

    for (const token of [sellerToken, adminToken]) {
      await request(app)
        .get("/api/wishlist")
        .set("Authorization", `Bearer ${token}`)
        .expect(403);

      await addToWishlist(token, firstProduct.id, 403);
    }
  });

  it("lists only the current customer's items in newest-first order", async () => {
    await addToWishlist(customerToken, firstProduct.id, 201);
    await addToWishlist(customerToken, secondProduct.id, 201);
    await addToWishlist(otherCustomerToken, firstProduct.id, 201);
    wishlist.setCreatedAt(
      customerId,
      firstProduct.id,
      new Date("2026-07-18T08:00:00.000Z"),
    );
    wishlist.setCreatedAt(
      customerId,
      secondProduct.id,
      new Date("2026-07-19T08:00:00.000Z"),
    );

    const response = await request(app)
      .get("/api/wishlist")
      .set("Authorization", `Bearer ${customerToken}`)
      .expect(200);

    expect(
      response.body.data.wishlistItems.map(
        (item: { productId: string }) => item.productId,
      ),
    ).toEqual([secondProduct.id, firstProduct.id]);
    expect(
      response.body.data.wishlistItems.every(
        (item: { customerId: string }) => item.customerId === customerId,
      ),
    ).toBe(true);
  });

  it("removes only the current customer's wishlist item", async () => {
    await addToWishlist(customerToken, firstProduct.id, 201);

    const otherCustomerDelete = await request(app)
      .delete(`/api/wishlist/${firstProduct.id}`)
      .set("Authorization", `Bearer ${otherCustomerToken}`)
      .send({})
      .expect(404);
    expect(otherCustomerDelete.body.message).toBe(
      "Wishlist item not found.",
    );

    await request(app)
      .delete(`/api/wishlist/${firstProduct.id}`)
      .set("Authorization", `Bearer ${customerToken}`)
      .send({})
      .expect(200)
      .expect({ success: true, data: null });

    await request(app)
      .delete(`/api/wishlist/${firstProduct.id}`)
      .set("Authorization", `Bearer ${customerToken}`)
      .send({})
      .expect(404);
  });

  it("rejects malformed IDs and unexpected input", async () => {
    await request(app)
      .post("/api/wishlist/not-a-uuid")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({})
      .expect(400);

    await request(app)
      .post(`/api/wishlist/${firstProduct.id}`)
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ unexpected: true })
      .expect(400);

    await request(app)
      .get("/api/wishlist?unexpected=true")
      .set("Authorization", `Bearer ${customerToken}`)
      .expect(400);
  });

  function createToken(
    userId: string,
    role: "CUSTOMER" | "SELLER" | "ADMIN",
  ): string {
    return tokenService.createAccessToken({ userId, role });
  }

  function addToWishlist(
    token: string,
    productId: string,
    status: number,
  ) {
    return request(app)
      .post(`/api/wishlist/${productId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({})
      .expect(status);
  }
});
