import { randomUUID } from "node:crypto";
import pino from "pino";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { JwtTokenService } from "../src/services/token.service.js";
import { InMemoryProductRepository } from "./helpers/in-memory-product.repository.js";
import { InMemoryReviewRepository } from "./helpers/in-memory-review.repository.js";
import { InMemoryUserRepository } from "./helpers/in-memory-user.repository.js";

const categoryId = randomUUID();
const sellerId = randomUUID();
const customerId = randomUUID();
const otherCustomerId = randomUUID();
const adminId = randomUUID();
const professionalId = randomUUID();
const unpurchasedProfessionalId = randomUUID();

describe("Review API", () => {
  const tokenService = new JwtTokenService();
  let app: ReturnType<typeof createApp>;
  let products: InMemoryProductRepository;
  let reviews: InMemoryReviewRepository;
  let productId: string;
  let customerToken: string;
  let otherCustomerToken: string;
  let sellerToken: string;
  let adminToken: string;
  let professionalToken: string;
  let unpurchasedProfessionalToken: string;

  beforeEach(async () => {
    products = new InMemoryProductRepository();
    products.addCategory({ id: categoryId, name: "Cement" });
    products.addSeller(sellerId, "Seller One");
    productId = (
      await products.create({
        sellerId,
        categoryId,
        name: "Portland Cement",
        description: "High-strength bagged cement.",
        price: "850.00",
        quantity: 20,
      })
    ).id;

    reviews = new InMemoryReviewRepository(products);
    reviews.addProduct(productId);
    reviews.addCustomer({ id: customerId, name: "Primary Customer" });
    reviews.addCustomer({
      id: otherCustomerId,
      name: "Other Customer",
    });
    reviews.markDeliveredPurchase(customerId, productId);
    reviews.addCustomer({
      id: professionalId,
      name: "Professional Buyer",
    });
    reviews.addCustomer({
      id: unpurchasedProfessionalId,
      name: "Unpurchased Professional",
    });
    reviews.markDeliveredPurchase(professionalId, productId);

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
    users.addUser({
      id: professionalId,
      name: "Professional Buyer",
      role: "PROFESSIONAL",
    });
    users.addUser({
      id: unpurchasedProfessionalId,
      name: "Unpurchased Professional",
      role: "PROFESSIONAL",
    });

    app = createApp({
      userRepository: users,
      productRepository: products,
      reviewRepository: reviews,
      tokenService,
      logger: pino({ level: "silent" }),
    });

    customerToken = createToken(customerId, "CUSTOMER");
    otherCustomerToken = createToken(otherCustomerId, "CUSTOMER");
    sellerToken = createToken(sellerId, "SELLER");
    adminToken = createToken(adminId, "ADMIN");
    professionalToken = createToken(professionalId, "PROFESSIONAL");
    unpurchasedProfessionalToken = createToken(
      unpurchasedProfessionalId,
      "PROFESSIONAL",
    );
  });

  it("allows a customer with a delivered purchase to review a product", async () => {
    const response = await createReview(customerToken, {
      rating: 5,
      comment: "Strong cement with consistent quality.",
    });

    expect(response.body).toMatchObject({
      success: true,
      data: {
        review: {
          productId,
          customerId,
          rating: 5,
          comment: "Strong cement with consistent quality.",
          customer: {
            id: customerId,
            name: "Primary Customer",
          },
        },
      },
    });
  });

  it("rejects duplicate reviews for the same customer and product", async () => {
    await createReview(customerToken, { rating: 5 });

    const response = await createReview(
      customerToken,
      { rating: 4 },
      409,
    );

    expect(response.body.message).toBe(
      "You have already reviewed this product.",
    );
  });

  it("rejects customers who have not purchased the product", async () => {
    const response = await createReview(
      otherCustomerToken,
      { rating: 4 },
      403,
    );

    expect(response.body.message).toBe(
      "You can only review products from your delivered orders.",
    );
  });

  it("requires authentication and a customer role to create reviews", async () => {
    await request(app)
      .post(`/api/products/${productId}/reviews`)
      .send({ rating: 5 })
      .expect(401);

    await createReview(sellerToken, { rating: 5 }, 403);
  });

  it("rejects ratings outside the integer range from one to five", async () => {
    for (const rating of [0, 6, 4.5, "5"]) {
      const response = await createReview(
        customerToken,
        { rating },
        400,
      );

      expect(response.body.message).toBe("Request validation failed.");
      expect(response.body.errors[0].field).toBe("body.rating");
    }
  });

  it("allows an owner to update their review", async () => {
    const created = await createReview(customerToken, {
      rating: 3,
      comment: "Acceptable.",
    });
    const reviewId = created.body.data.review.id as string;

    const response = await request(app)
      .put(`/api/reviews/${reviewId}`)
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ rating: 4, comment: "Good after curing." })
      .expect(200);

    expect(response.body.data.review).toMatchObject({
      id: reviewId,
      rating: 4,
      comment: "Good after curing.",
    });
  });

  it("prevents another customer from updating or deleting a review", async () => {
    const created = await createReview(customerToken, { rating: 4 });
    const reviewId = created.body.data.review.id as string;

    const updateResponse = await request(app)
      .put(`/api/reviews/${reviewId}`)
      .set("Authorization", `Bearer ${otherCustomerToken}`)
      .send({ rating: 1 })
      .expect(403);
    expect(updateResponse.body.message).toBe(
      "You can only update your own reviews.",
    );

    const deleteResponse = await request(app)
      .delete(`/api/reviews/${reviewId}`)
      .set("Authorization", `Bearer ${otherCustomerToken}`)
      .send({})
      .expect(403);
    expect(deleteResponse.body.message).toBe(
      "You can only delete your own reviews.",
    );
  });

  it("allows an owner to delete their review", async () => {
    const created = await createReview(customerToken, { rating: 4 });
    const reviewId = created.body.data.review.id as string;

    const response = await request(app)
      .delete(`/api/reviews/${reviewId}`)
      .set("Authorization", `Bearer ${customerToken}`)
      .send({})
      .expect(200);

    expect(response.body).toEqual({ success: true, data: null });
    expect(await reviews.findById(reviewId)).toBeNull();
  });

  it("allows an administrator to delete any review", async () => {
    const created = await createReview(customerToken, { rating: 2 });
    const reviewId = created.body.data.review.id as string;

    await request(app)
      .delete(`/api/reviews/${reviewId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({})
      .expect(200);

    expect(await reviews.findById(reviewId)).toBeNull();
  });

  it("lists reviews publicly and exposes rating aggregates on product details", async () => {
    reviews.markDeliveredPurchase(otherCustomerId, productId);
    const first = await createReview(customerToken, {
      rating: 5,
      comment: "Excellent.",
    });
    const second = await createReview(otherCustomerToken, {
      rating: 4,
      comment: "Reliable.",
    });
    reviews.setCreatedAt(
      first.body.data.review.id as string,
      new Date("2026-07-18T08:00:00.000Z"),
    );
    reviews.setCreatedAt(
      second.body.data.review.id as string,
      new Date("2026-07-19T08:00:00.000Z"),
    );

    const listing = await request(app)
      .get(`/api/products/${productId}/reviews`)
      .expect(200);

    expect(listing.body).toMatchObject({
      success: true,
      data: {
        reviews: [
          { customerId: otherCustomerId, rating: 4 },
          { customerId, rating: 5 },
        ],
        averageRating: 4.5,
        reviewCount: 2,
      },
    });

    const productDetails = await request(app)
      .get(`/api/products/${productId}`)
      .expect(200);
    expect(productDetails.body.data.product).toMatchObject({
      id: productId,
      averageRating: 4.5,
      reviewCount: 2,
    });
  });

  // ── Professional buyer capability (M1) ──────────────────────────────────────
  // PROFESSIONAL accounts are buyer-capable and may review products they
  // purchased through delivered orders, exactly like customers.
  describe("professional buyer capability", () => {
    it("allows a professional with a delivered purchase to review a product", async () => {
      const response = await createReview(professionalToken, {
        rating: 4,
        comment: "Consistent quality across three site deliveries.",
      });

      expect(response.body).toMatchObject({
        success: true,
        data: {
          review: {
            productId,
            customerId: professionalId,
            rating: 4,
            comment: "Consistent quality across three site deliveries.",
            customer: { id: professionalId, name: "Professional Buyer" },
          },
        },
      });

      // The review is a first-class review — publicly listed and aggregated.
      const listing = await request(app)
        .get(`/api/products/${productId}/reviews`)
        .expect(200);
      expect(listing.body.data).toMatchObject({
        reviews: [{ customerId: professionalId, rating: 4 }],
        averageRating: 4,
        reviewCount: 1,
      });
    });

    it("allows a professional to update and delete their own review", async () => {
      const created = await createReview(professionalToken, { rating: 3 });
      const reviewId = created.body.data.review.id as string;

      const updated = await request(app)
        .put(`/api/reviews/${reviewId}`)
        .set("Authorization", `Bearer ${professionalToken}`)
        .send({ rating: 5, comment: "Improved after the second batch." })
        .expect(200);
      expect(updated.body.data.review).toMatchObject({
        id: reviewId,
        rating: 5,
        comment: "Improved after the second batch.",
      });

      await request(app)
        .delete(`/api/reviews/${reviewId}`)
        .set("Authorization", `Bearer ${professionalToken}`)
        .send({})
        .expect(200);
      expect(await reviews.findById(reviewId)).toBeNull();
    });

    it("still requires a delivered purchase for professionals", async () => {
      const response = await createReview(
        unpurchasedProfessionalToken,
        { rating: 5 },
        403,
      );

      expect(response.body.message).toBe(
        "You can only review products from your delivered orders.",
      );
    });

    it("still enforces review ownership between a professional and a customer", async () => {
      const created = await createReview(customerToken, { rating: 4 });
      const reviewId = created.body.data.review.id as string;

      await request(app)
        .put(`/api/reviews/${reviewId}`)
        .set("Authorization", `Bearer ${professionalToken}`)
        .send({ rating: 1 })
        .expect(403);

      await request(app)
        .delete(`/api/reviews/${reviewId}`)
        .set("Authorization", `Bearer ${professionalToken}`)
        .send({})
        .expect(403);
    });

    it("still rejects seller accounts", async () => {
      await createReview(sellerToken, { rating: 5 }, 403);
    });
  });

  function createToken(
    userId: string,
    role: "CUSTOMER" | "SELLER" | "ADMIN" | "PROFESSIONAL",
  ): string {
    return tokenService.createAccessToken({ userId, role });
  }

  function createReview(
    token: string,
    body: Record<string, unknown>,
    status = 201,
  ) {
    return request(app)
      .post(`/api/products/${productId}/reviews`)
      .set("Authorization", `Bearer ${token}`)
      .send(body)
      .expect(status);
  }
});
