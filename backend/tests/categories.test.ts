import { randomUUID } from "node:crypto";
import pino from "pino";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { JwtTokenService } from "../src/services/token.service.js";
import { InMemoryCategoryRepository } from "./helpers/in-memory-category.repository.js";
import { InMemoryUserRepository } from "./helpers/in-memory-user.repository.js";

describe("Category API", () => {
  const tokenService = new JwtTokenService();
  let app: ReturnType<typeof createApp>;
  let categories: InMemoryCategoryRepository;
  let users: InMemoryUserRepository;
  let adminToken: string;
  let customerToken: string;

  beforeEach(() => {
    categories = new InMemoryCategoryRepository();
    users = new InMemoryUserRepository();
    const adminId = randomUUID();
    const customerId = randomUUID();
    users.addUser({ id: adminId, role: "ADMIN" });
    users.addUser({ id: customerId, role: "CUSTOMER" });
    app = createApp({
      userRepository: users,
      categoryRepository: categories,
      tokenService,
      logger: pino({ level: "silent" }),
    });

    adminToken = tokenService.createAccessToken({
      userId: adminId,
      role: "ADMIN",
    });
    customerToken = tokenService.createAccessToken({
      userId: customerId,
      role: "CUSTOMER",
    });
  });

  it("allows the public to list categories", async () => {
    await categories.create({ name: "Steel" });
    await categories.create({ name: "Cement", description: "Bagged cement" });

    const response = await request(app).get("/api/categories").expect(200);

    expect(response.body).toMatchObject({
      success: true,
      data: {
        categories: [
          { name: "Cement", description: "Bagged cement" },
          { name: "Steel", description: null },
        ],
      },
    });
  });

  it("allows the public to view a category", async () => {
    const category = await categories.create({
      name: "Aggregates",
      description: "Sand, ballast, and crushed stone",
    });

    const response = await request(app)
      .get(`/api/categories/${category.id}`)
      .expect(200);

    expect(response.body.data.category).toEqual(category);
  });

  it("prevents non-admin users from creating, updating, or deleting categories", async () => {
    const category = await categories.create({ name: "Timber" });
    const authorization = `Bearer ${customerToken}`;

    await request(app)
      .post("/api/categories")
      .set("Authorization", authorization)
      .send({ name: "Roofing" })
      .expect(403);

    await request(app)
      .put(`/api/categories/${category.id}`)
      .set("Authorization", authorization)
      .send({ name: "Wood" })
      .expect(403);

    await request(app)
      .delete(`/api/categories/${category.id}`)
      .set("Authorization", authorization)
      .send({})
      .expect(403);

    expect(await categories.findById(category.id)).not.toBeNull();
  });

  it("allows an admin to create, update, and delete a category", async () => {
    const createResponse = await request(app)
      .post("/api/categories")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: "Electrical",
        description: "Cables, fittings, and distribution equipment",
      })
      .expect(201);
    const categoryId = createResponse.body.data.category.id as string;

    const updateResponse = await request(app)
      .put(`/api/categories/${categoryId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "Electrical Supplies", description: "" })
      .expect(200);

    expect(updateResponse.body.data.category).toMatchObject({
      id: categoryId,
      name: "Electrical Supplies",
      description: null,
    });

    const deleteResponse = await request(app)
      .delete(`/api/categories/${categoryId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({})
      .expect(200);

    expect(deleteResponse.body).toEqual({ success: true, data: null });
    await request(app).get(`/api/categories/${categoryId}`).expect(404);
  });

  it("returns a conflict for duplicate category names", async () => {
    await request(app)
      .post("/api/categories")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "Cement" })
      .expect(201);

    const duplicateResponse = await request(app)
      .post("/api/categories")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "  cement  " })
      .expect(409);

    expect(duplicateResponse.body).toEqual({
      success: false,
      message: "A category with that name already exists.",
      errors: [],
    });
  });

  it("prevents deletion while products reference the category", async () => {
    const category = await categories.create({ name: "Plumbing" });
    categories.markInUse(category.id);

    const response = await request(app)
      .delete(`/api/categories/${category.id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({})
      .expect(409);

    expect(response.body.message).toBe(
      "The category cannot be deleted while products reference it.",
    );
  });
});
