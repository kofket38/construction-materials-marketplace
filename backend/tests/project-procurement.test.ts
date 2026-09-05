import { randomUUID } from "node:crypto";
import pino from "pino";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { JwtTokenService } from "../src/services/token.service.js";
import { InMemoryOrderRepository } from "./helpers/in-memory-order.repository.js";
import { InMemoryProjectRepository } from "./helpers/in-memory-project.repository.js";
import { InMemoryRfqRepository } from "./helpers/in-memory-rfq.repository.js";
import { InMemorySellerPaymentRepository } from "./helpers/in-memory-seller-payment.repository.js";
import { InMemoryUserRepository } from "./helpers/in-memory-user.repository.js";

// ── Fixed IDs ──────────────────────────────────────────────────────────────────

const professionalId = randomUUID();
const otherProfessionalId = randomUUID();
const customerId = randomUUID();
const sellerId = randomUUID();
const adminId = randomUUID();
const cementCategoryId = randomUUID();
const steelCategoryId = randomUUID();
const cementProductId = randomUUID();
const steelProductId = randomUUID();

const shipping = {
  fullName: "Professional Buyer",
  phone: "+251911000000",
  city: "Addis Ababa",
  address: "Bole Road, site gate 2",
};

/**
 * End-to-end coverage for project ↔ procurement links: attaching RFQs and
 * orders to a project, the owner-private procurement view, and the completion
 * guard that blocks a project from being marked COMPLETED while linked
 * procurement is still in flight.
 */
describe("Project procurement links", () => {
  const tokenService = new JwtTokenService();
  let app: ReturnType<typeof createApp>;
  let projects: InMemoryProjectRepository;
  let rfqs: InMemoryRfqRepository;
  let orders: InMemoryOrderRepository;
  let professionalToken: string;
  let otherProfessionalToken: string;
  let customerToken: string;
  let sellerToken: string;
  let adminToken: string;

  beforeEach(() => {
    projects = new InMemoryProjectRepository();
    rfqs = new InMemoryRfqRepository();
    orders = new InMemoryOrderRepository();

    // The RFQ and order repositories hold the procurement rows; the project
    // repository reads them through these sources the way PostgreSQL reads
    // them through the projectId foreign keys. Quote-acceptance orders are
    // written by the RFQ repository, so both are wired as order sources.
    projects.useProcurementSources({ rfqs, orders: [orders, rfqs] });

    rfqs.addCategory({ id: cementCategoryId, name: "Cement" });
    rfqs.addCategory({ id: steelCategoryId, name: "Steel" });
    rfqs.addCustomer({
      id: professionalId,
      name: "Professional Buyer",
      company: "Pro Consulting",
      email: "professional@example.com",
    });
    rfqs.addSeller({
      id: sellerId,
      name: "Primary Seller",
      company: "Primary Supplies",
      shopName: "Primary Materials",
    });
    rfqs.addProduct({
      id: cementProductId,
      sellerId,
      categoryId: cementCategoryId,
      name: "Cement A",
      imageUrl: null,
      quantity: 500,
    });
    rfqs.addProduct({
      id: steelProductId,
      sellerId,
      categoryId: steelCategoryId,
      name: "Steel A",
      imageUrl: null,
      quantity: 500,
    });

    orders.addCustomer({
      id: professionalId,
      name: "Professional Buyer",
      email: "professional@example.com",
    });
    orders.addProduct({
      id: cementProductId,
      sellerId,
      name: "Cement A",
      imageUrl: null,
      price: "100.00",
      quantity: 500,
    });
    orders.addProduct({
      id: steelProductId,
      sellerId,
      name: "Steel A",
      imageUrl: null,
      price: "50.00",
      quantity: 500,
    });

    const users = new InMemoryUserRepository();
    users.addUser({ id: professionalId, role: "PROFESSIONAL" });
    users.addUser({ id: otherProfessionalId, role: "PROFESSIONAL" });
    users.addUser({ id: customerId, role: "CUSTOMER" });
    users.addUser({ id: sellerId, role: "SELLER" });
    users.addUser({ id: adminId, role: "ADMIN" });

    const sellerPayments = new InMemorySellerPaymentRepository();
    sellerPayments.addProduct(cementProductId, sellerId);
    sellerPayments.addProduct(steelProductId, sellerId);
    sellerPayments.addProfile({
      sellerId,
      sellerName: "Primary Seller",
      sellerPhone: "+251911100100",
      destinations: [],
    });

    app = createApp({
      userRepository: users,
      projectRepository: projects,
      rfqRepository: rfqs,
      orderRepository: orders,
      sellerPaymentRepository: sellerPayments,
      tokenService,
      logger: pino({ level: "silent" }),
    });

    professionalToken = token(professionalId, "PROFESSIONAL");
    otherProfessionalToken = token(otherProfessionalId, "PROFESSIONAL");
    customerToken = token(customerId, "CUSTOMER");
    sellerToken = token(sellerId, "SELLER");
    adminToken = token(adminId, "ADMIN");
  });

  // ── Owner-private procurement view ─────────────────────────────────────────

  describe("GET /api/projects/:projectId/procurement", () => {
    it("returns empty lists for a project with no linked procurement", async () => {
      const project = projects.addProject(professionalId);

      const response = await getProcurement(project.id, professionalToken).expect(
        200,
      );

      expect(response.body.data).toEqual({ rfqs: [], orders: [] });
    });

    it("returns RFQ and order summaries without pricing or seller identities", async () => {
      const project = projects.addProject(professionalId);
      await createRfq(professionalToken, rfqBody(project.id)).expect(201);
      await createOrder(professionalToken, orderBody(project.id)).expect(201);

      const response = await getProcurement(project.id, professionalToken).expect(
        200,
      );

      expect(response.body.data.rfqs).toHaveLength(1);
      expect(response.body.data.rfqs[0]).toMatchObject({
        title: "Bulk structural materials",
        status: "OPEN",
        deliveryLocation: "Industrial Area, Addis Ababa",
        itemCount: 1,
        quoteCount: 0,
      });
      expect(Object.keys(response.body.data.rfqs[0]).sort()).toEqual([
        "createdAt",
        "deliveryLocation",
        "expiresAt",
        "id",
        "itemCount",
        "quoteCount",
        "status",
        "title",
      ]);

      expect(response.body.data.orders).toHaveLength(1);
      expect(response.body.data.orders[0]).toMatchObject({
        status: "PENDING_CONFIRMATION",
        totalAmount: "200.00",
        itemCount: 1,
      });
      expect(Object.keys(response.body.data.orders[0]).sort()).toEqual([
        "createdAt",
        "id",
        "itemCount",
        "status",
        "totalAmount",
      ]);
    });

    it("lists procurement newest first", async () => {
      const project = projects.addProject(professionalId);
      const first = await createRfq(
        professionalToken,
        rfqBody(project.id),
      ).expect(201);
      const second = await createRfq(professionalToken, {
        ...rfqBody(project.id),
        title: "Second request",
      }).expect(201);

      // Same-millisecond creation is realistic in tests, so force a gap the
      // way distinct createdAt values appear in PostgreSQL.
      rfqs.setRfqCreatedAt(
        first.body.data.rfq.id as string,
        new Date(Date.now() - 60_000),
      );

      const response = await getProcurement(project.id, professionalToken).expect(
        200,
      );

      expect(response.body.data.rfqs.map((rfq: { id: string }) => rfq.id)).toEqual([
        second.body.data.rfq.id,
        first.body.data.rfq.id,
      ]);
    });

    it("reports another professional's project as missing", async () => {
      const project = projects.addProject(professionalId);

      await getProcurement(project.id, otherProfessionalToken).expect(404);
    });

    it("reports an unknown project as missing", async () => {
      await getProcurement(randomUUID(), professionalToken).expect(404);
    });

    it("rejects a CUSTOMER caller with 403", async () => {
      const project = projects.addProject(professionalId);

      await getProcurement(project.id, customerToken).expect(403);
    });

    it("rejects an ADMIN caller with 403", async () => {
      const project = projects.addProject(professionalId);

      await getProcurement(project.id, adminToken).expect(403);
    });

    it("rejects an unauthenticated caller with 401", async () => {
      const project = projects.addProject(professionalId);

      await request(app)
        .get(`/api/projects/${project.id}/procurement`)
        .expect(401);
    });

    it("never exposes procurement through the public project detail", async () => {
      const project = projects.addProject(professionalId, {
        status: "PUBLISHED",
      });
      await createRfq(professionalToken, rfqBody(project.id)).expect(201);

      const response = await request(app)
        .get(`/api/projects/${project.id}`)
        .expect(200);

      expect(response.body.data.project).not.toHaveProperty("rfqs");
      expect(response.body.data.project).not.toHaveProperty("orders");
    });
  });

  // ── Attaching a project to an RFQ ──────────────────────────────────────────

  describe("RFQ project links", () => {
    it("attaches the professional's own project", async () => {
      const project = projects.addProject(professionalId);

      const response = await createRfq(
        professionalToken,
        rfqBody(project.id),
      ).expect(201);

      expect(response.body.data.rfq.projectId).toBe(project.id);
    });

    it("creates a standalone RFQ when no project is supplied", async () => {
      const response = await createRfq(professionalToken).expect(201);

      expect(response.body.data.rfq.projectId).toBeNull();
    });

    it("rejects a CUSTOMER attaching a project with 403", async () => {
      const project = projects.addProject(professionalId);
      rfqs.addCustomer({
        id: customerId,
        name: "Plain Customer",
        company: null,
        email: "customer@example.com",
      });

      await createRfq(customerToken, rfqBody(project.id)).expect(403);
    });

    it("reports another professional's project as missing", async () => {
      const project = projects.addProject(otherProfessionalId);

      await createRfq(professionalToken, rfqBody(project.id)).expect(404);
    });

    it("reports an unknown project as missing", async () => {
      await createRfq(professionalToken, rfqBody(randomUUID())).expect(404);
    });

    it.each(["COMPLETED", "CANCELLED"] as const)(
      "rejects a %s project with 409",
      async (status) => {
        const project = projects.addProject(professionalId, { status });

        await createRfq(professionalToken, rfqBody(project.id)).expect(409);
      },
    );

    it("rejects a malformed project id with 400", async () => {
      await createRfq(professionalToken, rfqBody("not-a-uuid")).expect(400);
    });

    it("detaches the project when an update omits it", async () => {
      const project = projects.addProject(professionalId);
      const created = await createRfq(
        professionalToken,
        rfqBody(project.id),
      ).expect(201);

      const updated = await request(app)
        .put(`/api/rfqs/${created.body.data.rfq.id}`)
        .set("Authorization", `Bearer ${professionalToken}`)
        .send(rfqBody())
        .expect(200);

      expect(updated.body.data.rfq.projectId).toBeNull();
      const procurement = await getProcurement(
        project.id,
        professionalToken,
      ).expect(200);
      expect(procurement.body.data.rfqs).toEqual([]);
    });

    it("moves an RFQ between projects on update", async () => {
      const first = projects.addProject(professionalId);
      const second = projects.addProject(professionalId);
      const created = await createRfq(
        professionalToken,
        rfqBody(first.id),
      ).expect(201);

      await request(app)
        .put(`/api/rfqs/${created.body.data.rfq.id}`)
        .set("Authorization", `Bearer ${professionalToken}`)
        .send(rfqBody(second.id))
        .expect(200);

      const target = await getProcurement(second.id, professionalToken).expect(
        200,
      );
      expect(target.body.data.rfqs).toHaveLength(1);
    });
  });

  // ── Attaching a project to an order ────────────────────────────────────────

  describe("Order project links", () => {
    it("attaches the professional's own project", async () => {
      const project = projects.addProject(professionalId);

      const response = await createOrder(
        professionalToken,
        orderBody(project.id),
      ).expect(201);

      expect(response.body.data.order.projectId).toBe(project.id);
    });

    it("creates a standalone order when no project is supplied", async () => {
      const response = await createOrder(professionalToken).expect(201);

      expect(response.body.data.order.projectId).toBeNull();
    });

    it("rejects a CUSTOMER attaching a project with 403", async () => {
      const project = projects.addProject(professionalId);
      orders.addCustomer({
        id: customerId,
        name: "Plain Customer",
        email: "customer@example.com",
      });

      await createOrder(customerToken, orderBody(project.id)).expect(403);
    });

    it("reports another professional's project as missing", async () => {
      const project = projects.addProject(otherProfessionalId);

      await createOrder(professionalToken, orderBody(project.id)).expect(404);
    });

    it("rejects a completed project with 409", async () => {
      const project = projects.addProject(professionalId, {
        status: "COMPLETED",
      });

      await createOrder(professionalToken, orderBody(project.id)).expect(409);
    });

    it("rejects a malformed project id with 400", async () => {
      await createOrder(professionalToken, orderBody("not-a-uuid")).expect(400);
    });
  });

  // ── Quote acceptance inheritance ───────────────────────────────────────────

  describe("quote acceptance", () => {
    it("lands the awarded order in the RFQ's project", async () => {
      const project = projects.addProject(professionalId);
      const created = await createRfq(
        professionalToken,
        rfqBody(project.id),
      ).expect(201);
      const rfq = created.body.data.rfq as {
        id: string;
        items: Array<{ id: string }>;
      };

      const quote = await request(app)
        .post(`/api/rfqs/${rfq.id}/quotes`)
        .set("Authorization", `Bearer ${sellerToken}`)
        .send(quoteBody(rfq.items[0]!.id))
        .expect(201);

      await request(app)
        .post(`/api/quotes/${quote.body.data.quote.id}/accept`)
        .set("Authorization", `Bearer ${professionalToken}`)
        .expect(201);

      const procurement = await getProcurement(
        project.id,
        professionalToken,
      ).expect(200);

      expect(procurement.body.data.orders).toHaveLength(1);
      expect(procurement.body.data.orders[0]).toMatchObject({
        status: "PENDING",
        totalAmount: "50.00",
        itemCount: 1,
      });
      // The request itself is AWARDED, so it no longer blocks completion.
      expect(procurement.body.data.rfqs[0].status).toBe("AWARDED");
    });
  });

  // ── Reading the project back from a purchase ───────────────────────────────

  describe("project on procurement detail reads", () => {
    it("names the project on the owner's RFQ detail", async () => {
      const project = projects.addProject(professionalId, {
        title: "Riverside Warehouse",
        status: "IN_PROGRESS",
      });
      const created = await createRfq(
        professionalToken,
        rfqBody(project.id),
      ).expect(201);

      const response = await getRfq(
        created.body.data.rfq.id,
        professionalToken,
      ).expect(200);

      expect(response.body.data.rfq.project).toEqual({
        id: project.id,
        title: "Riverside Warehouse",
        status: "IN_PROGRESS",
      });
    });

    it("reports a standalone RFQ as unattached", async () => {
      const created = await createRfq(professionalToken).expect(201);

      const response = await getRfq(
        created.body.data.rfq.id,
        professionalToken,
      ).expect(200);

      expect(response.body.data.rfq.project).toBeNull();
    });

    it("hides the buyer's project from a seller reading the request", async () => {
      const project = projects.addProject(professionalId);
      const created = await createRfq(
        professionalToken,
        rfqBody(project.id),
      ).expect(201);

      // The seller may legitimately read this request in order to quote on it,
      // so it must read as standalone rather than 404. Neither the summary nor
      // the raw ID rides along: which project a buyer groups a request under is
      // their own commercial context and no part of the quoting contract.
      const response = await getRfq(
        created.body.data.rfq.id,
        sellerToken,
      ).expect(200);

      expect(response.body.data.rfq.project).toBeNull();
      expect(response.body.data.rfq.projectId).toBeNull();
    });

    it("hides the project from an admin reading the request", async () => {
      const project = projects.addProject(professionalId);
      const created = await createRfq(
        professionalToken,
        rfqBody(project.id),
      ).expect(201);

      const response = await getRfq(
        created.body.data.rfq.id,
        adminToken,
      ).expect(200);

      expect(response.body.data.rfq.project).toBeNull();
    });

    it("names the project on the owner's order detail", async () => {
      const project = projects.addProject(professionalId, {
        title: "Riverside Warehouse",
      });
      const created = await createOrder(
        professionalToken,
        orderBody(project.id),
      ).expect(201);

      const response = await getOrder(
        created.body.data.order.id,
        professionalToken,
      ).expect(200);

      expect(response.body.data.order.project).toEqual({
        id: project.id,
        title: "Riverside Warehouse",
        status: "DRAFT",
      });
    });

    it("reports a standalone order as unattached", async () => {
      const created = await createOrder(professionalToken).expect(201);

      const response = await getOrder(
        created.body.data.order.id,
        professionalToken,
      ).expect(200);

      expect(response.body.data.order.project).toBeNull();
    });

    it("hides the project from an admin reading the order", async () => {
      const project = projects.addProject(professionalId);
      const created = await createOrder(
        professionalToken,
        orderBody(project.id),
      ).expect(201);

      const response = await getOrder(
        created.body.data.order.id,
        adminToken,
      ).expect(200);

      expect(response.body.data.order.project).toBeNull();
    });

    it("keeps naming the project after the request is awarded", async () => {
      const project = projects.addProject(professionalId, {
        title: "Riverside Warehouse",
      });
      const { rfqId } = await awardedProcurement(project.id);

      const response = await getRfq(rfqId, professionalToken).expect(200);

      expect(response.body.data.rfq.status).toBe("AWARDED");
      expect(response.body.data.rfq.project).toMatchObject({
        id: project.id,
        title: "Riverside Warehouse",
      });
    });

    it("stops naming the project once the link is detached", async () => {
      const project = projects.addProject(professionalId);
      const createdRfq = await createRfq(
        professionalToken,
        rfqBody(project.id),
      ).expect(201);
      const createdOrder = await createOrder(
        professionalToken,
        orderBody(project.id),
      ).expect(201);
      const rfqId = createdRfq.body.data.rfq.id as string;
      const orderId = createdOrder.body.data.order.id as string;

      await detachRfqLink(project.id, rfqId, professionalToken).expect(200);
      await detachOrderLink(project.id, orderId, professionalToken).expect(200);

      const rfq = await getRfq(rfqId, professionalToken).expect(200);
      const order = await getOrder(orderId, professionalToken).expect(200);

      expect(rfq.body.data.rfq.project).toBeNull();
      expect(order.body.data.order.project).toBeNull();
    });
  });

  // ── Completion guard ───────────────────────────────────────────────────────

  describe("completion guard", () => {
    it("completes a project with no linked procurement", async () => {
      const project = inProgressProject();

      const response = await patchStatus(
        project.id,
        professionalToken,
        "COMPLETED",
      ).expect(200);

      expect(response.body.data.project.status).toBe("COMPLETED");
    });

    it("blocks completion while an RFQ is still open", async () => {
      const project = inProgressProject();
      await createRfq(professionalToken, rfqBody(project.id)).expect(201);

      const response = await patchStatus(
        project.id,
        professionalToken,
        "COMPLETED",
      ).expect(409);

      expect(response.body.message).toContain(
        "1 open request for quote",
      );
    });

    it("blocks completion while an order is unfinished", async () => {
      const project = inProgressProject();
      await createOrder(professionalToken, orderBody(project.id)).expect(201);

      const response = await patchStatus(
        project.id,
        professionalToken,
        "COMPLETED",
      ).expect(409);

      expect(response.body.message).toContain("1 unfinished order");
    });

    it("names both kinds of outstanding procurement", async () => {
      const project = inProgressProject();
      await createRfq(professionalToken, rfqBody(project.id)).expect(201);
      await createRfq(professionalToken, {
        ...rfqBody(project.id),
        title: "Second request",
      }).expect(201);
      await createOrder(professionalToken, orderBody(project.id)).expect(201);

      const response = await patchStatus(
        project.id,
        professionalToken,
        "COMPLETED",
      ).expect(409);

      expect(response.body.message).toContain(
        "2 open requests for quote and 1 unfinished order",
      );
    });

    it("allows completion once procurement is settled", async () => {
      const project = inProgressProject();
      const rfq = await createRfq(
        professionalToken,
        rfqBody(project.id),
      ).expect(201);
      const order = await createOrder(
        professionalToken,
        orderBody(project.id),
      ).expect(201);

      await patchStatus(project.id, professionalToken, "COMPLETED").expect(409);

      await request(app)
        .patch(`/api/rfqs/${rfq.body.data.rfq.id}/cancel`)
        .set("Authorization", `Bearer ${professionalToken}`)
        .expect(200);
      await request(app)
        .delete(`/api/orders/${order.body.data.order.id}`)
        .set("Authorization", `Bearer ${professionalToken}`)
        .expect(200);

      await patchStatus(project.id, professionalToken, "COMPLETED").expect(200);
    });

    it("ignores an RFQ that has passed its expiry", async () => {
      const project = inProgressProject();
      const created = await createRfq(
        professionalToken,
        rfqBody(project.id),
      ).expect(201);
      // A stale OPEN row past its expiry is domain-expired; it must not block
      // completion forever just because the lazy sweep has not run.
      rfqs.setRfqExpiresAt(
        created.body.data.rfq.id as string,
        new Date(Date.now() - 1_000),
      );

      await patchStatus(project.id, professionalToken, "COMPLETED").expect(200);
    });

    it("allows cancellation while procurement is still outstanding", async () => {
      const project = projects.addProject(professionalId, {
        status: "PUBLISHED",
      });
      await createRfq(professionalToken, rfqBody(project.id)).expect(201);
      await createOrder(professionalToken, orderBody(project.id)).expect(201);

      const response = await patchStatus(
        project.id,
        professionalToken,
        "CANCELLED",
      ).expect(200);

      expect(response.body.data.project.status).toBe("CANCELLED");
    });
  });

  // ── Deletion guard ─────────────────────────────────────────────────────────

  describe("project deletion", () => {
    it("refuses to delete a project with linked procurement", async () => {
      const project = projects.addProject(professionalId);
      await createRfq(professionalToken, rfqBody(project.id)).expect(201);

      const response = await request(app)
        .delete(`/api/projects/${project.id}`)
        .set("Authorization", `Bearer ${professionalToken}`)
        .expect(409);

      expect(response.body.message).toContain("Detach them");
      await getProcurement(project.id, professionalToken).expect(200);
    });

    it("deletes a project once its procurement is detached", async () => {
      const project = projects.addProject(professionalId);
      const created = await createRfq(
        professionalToken,
        rfqBody(project.id),
      ).expect(201);

      await request(app)
        .put(`/api/rfqs/${created.body.data.rfq.id}`)
        .set("Authorization", `Bearer ${professionalToken}`)
        .send(rfqBody())
        .expect(200);

      await request(app)
        .delete(`/api/projects/${project.id}`)
        .set("Authorization", `Bearer ${professionalToken}`)
        .expect(200);
    });

    it("deletes a project once awarded procurement is detached", async () => {
      const project = projects.addProject(professionalId);
      const { rfqId, orderId } = await awardedProcurement(project.id);

      // Neither an awarded request nor an order can be edited, so the detach
      // routes are the only way out of the ON DELETE RESTRICT links.
      await request(app)
        .delete(`/api/projects/${project.id}`)
        .set("Authorization", `Bearer ${professionalToken}`)
        .expect(409);

      await detachRfqLink(project.id, rfqId, professionalToken).expect(200);
      await detachOrderLink(project.id, orderId, professionalToken).expect(200);

      await request(app)
        .delete(`/api/projects/${project.id}`)
        .set("Authorization", `Bearer ${professionalToken}`)
        .expect(200);
    });
  });

  // ── Detaching procurement ──────────────────────────────────────────────────

  describe("DELETE /api/projects/:projectId/procurement/rfqs/:rfqId", () => {
    it("clears the link and leaves the request itself intact", async () => {
      const project = projects.addProject(professionalId);
      const created = await createRfq(
        professionalToken,
        rfqBody(project.id),
      ).expect(201);
      const rfqId = created.body.data.rfq.id as string;

      await detachRfqLink(project.id, rfqId, professionalToken).expect(200);

      const procurement = await getProcurement(
        project.id,
        professionalToken,
      ).expect(200);
      expect(procurement.body.data.rfqs).toEqual([]);

      // The request survives detaching; only the project link was cleared.
      const rfq = await getRfq(rfqId, professionalToken).expect(200);
      expect(rfq.body.data.rfq.projectId).toBeNull();
    });

    it("detaches a request the update endpoint would refuse", async () => {
      const project = projects.addProject(professionalId);
      const { rfqId } = await awardedProcurement(project.id);

      // The RFQ update endpoint only accepts OPEN, quote-free requests, so an
      // awarded request can only be released through this route.
      await request(app)
        .put(`/api/rfqs/${rfqId}`)
        .set("Authorization", `Bearer ${professionalToken}`)
        .send(rfqBody())
        .expect(409);

      await detachRfqLink(project.id, rfqId, professionalToken).expect(200);

      const procurement = await getProcurement(
        project.id,
        professionalToken,
      ).expect(200);
      expect(procurement.body.data.rfqs).toEqual([]);
    });

    it("reports a request attached to a different project as missing", async () => {
      const project = projects.addProject(professionalId);
      const other = projects.addProject(professionalId);
      const created = await createRfq(
        professionalToken,
        rfqBody(other.id),
      ).expect(201);

      await detachRfqLink(
        project.id,
        created.body.data.rfq.id as string,
        professionalToken,
      ).expect(404);

      // The link the caller did not name is untouched.
      const procurement = await getProcurement(
        other.id,
        professionalToken,
      ).expect(200);
      expect(procurement.body.data.rfqs).toHaveLength(1);
    });

    it("reports an unknown request as missing", async () => {
      const project = projects.addProject(professionalId);

      await detachRfqLink(project.id, randomUUID(), professionalToken).expect(
        404,
      );
    });

    it("reports another professional's project as missing", async () => {
      const project = projects.addProject(professionalId);
      const created = await createRfq(
        professionalToken,
        rfqBody(project.id),
      ).expect(201);

      await detachRfqLink(
        project.id,
        created.body.data.rfq.id as string,
        otherProfessionalToken,
      ).expect(404);
    });
  });

  describe("DELETE /api/projects/:projectId/procurement/orders/:orderId", () => {
    it("clears the link on a directly placed order", async () => {
      const project = projects.addProject(professionalId);
      const created = await createOrder(
        professionalToken,
        orderBody(project.id),
      ).expect(201);
      const orderId = created.body.data.order.id as string;

      // Orders have no update endpoint at all, so this route is the only way
      // to release the link.
      await detachOrderLink(project.id, orderId, professionalToken).expect(200);

      const procurement = await getProcurement(
        project.id,
        professionalToken,
      ).expect(200);
      expect(procurement.body.data.orders).toEqual([]);

      const order = await request(app)
        .get(`/api/orders/${orderId}`)
        .set("Authorization", `Bearer ${professionalToken}`)
        .expect(200);
      expect(order.body.data.order.projectId).toBeNull();
    });

    it("clears the link on an order created by quote acceptance", async () => {
      const project = projects.addProject(professionalId);
      const { orderId } = await awardedProcurement(project.id);

      await detachOrderLink(project.id, orderId, professionalToken).expect(200);

      const procurement = await getProcurement(
        project.id,
        professionalToken,
      ).expect(200);
      expect(procurement.body.data.orders).toEqual([]);
    });

    it("reports an order attached to a different project as missing", async () => {
      const project = projects.addProject(professionalId);
      const other = projects.addProject(professionalId);
      const created = await createOrder(
        professionalToken,
        orderBody(other.id),
      ).expect(201);

      await detachOrderLink(
        project.id,
        created.body.data.order.id as string,
        professionalToken,
      ).expect(404);
    });

    it("reports an unknown order as missing", async () => {
      const project = projects.addProject(professionalId);

      await detachOrderLink(project.id, randomUUID(), professionalToken).expect(
        404,
      );
    });
  });

  describe("detach access control", () => {
    it("rejects a malformed request id with 400", async () => {
      const project = projects.addProject(professionalId);

      await detachRfqLink(project.id, "not-a-uuid", professionalToken).expect(
        400,
      );
    });

    it("rejects a malformed order id with 400", async () => {
      const project = projects.addProject(professionalId);

      await detachOrderLink(project.id, "not-a-uuid", professionalToken).expect(
        400,
      );
    });

    it.each([
      ["CUSTOMER", () => customerToken],
      ["SELLER", () => sellerToken],
      ["ADMIN", () => adminToken],
    ])("rejects a %s caller with 403", async (_role, accessToken) => {
      const project = projects.addProject(professionalId);

      await detachRfqLink(project.id, randomUUID(), accessToken()).expect(403);
      await detachOrderLink(project.id, randomUUID(), accessToken()).expect(403);
    });

    it("rejects an unauthenticated caller with 401", async () => {
      const project = projects.addProject(professionalId);

      await request(app)
        .delete(`/api/projects/${project.id}/procurement/rfqs/${randomUUID()}`)
        .expect(401);
      await request(app)
        .delete(
          `/api/projects/${project.id}/procurement/orders/${randomUUID()}`,
        )
        .expect(401);
    });
  });

  // ── Helpers ─────────────────────────────────────────────────────────────────

  function getRfq(rfqId: string, accessToken: string) {
    return request(app)
      .get(`/api/rfqs/${rfqId}`)
      .set("Authorization", `Bearer ${accessToken}`);
  }

  function getOrder(orderId: string, accessToken: string) {
    return request(app)
      .get(`/api/orders/${orderId}`)
      .set("Authorization", `Bearer ${accessToken}`);
  }

  function getProcurement(projectId: string, accessToken: string) {
    return request(app)
      .get(`/api/projects/${projectId}/procurement`)
      .set("Authorization", `Bearer ${accessToken}`);
  }

  function detachRfqLink(
    projectId: string,
    rfqId: string,
    accessToken: string,
  ) {
    return request(app)
      .delete(`/api/projects/${projectId}/procurement/rfqs/${rfqId}`)
      .set("Authorization", `Bearer ${accessToken}`);
  }

  function detachOrderLink(
    projectId: string,
    orderId: string,
    accessToken: string,
  ) {
    return request(app)
      .delete(`/api/projects/${projectId}/procurement/orders/${orderId}`)
      .set("Authorization", `Bearer ${accessToken}`);
  }

  /**
   * Runs a full RFQ → quote → acceptance cycle against one project, leaving an
   * AWARDED request and the order it generated attached to it. Both are states
   * no other endpoint can detach.
   */
  async function awardedProcurement(projectId: string) {
    const created = await createRfq(
      professionalToken,
      rfqBody(projectId),
    ).expect(201);
    const rfq = created.body.data.rfq as {
      id: string;
      items: Array<{ id: string }>;
    };

    const quote = await request(app)
      .post(`/api/rfqs/${rfq.id}/quotes`)
      .set("Authorization", `Bearer ${sellerToken}`)
      .send(quoteBody(rfq.items[0]!.id))
      .expect(201);

    const accepted = await request(app)
      .post(`/api/quotes/${quote.body.data.quote.id}/accept`)
      .set("Authorization", `Bearer ${professionalToken}`)
      .expect(201);

    return {
      rfqId: rfq.id,
      orderId: accepted.body.data.order.id as string,
    };
  }

  function createRfq(
    accessToken: string,
    body: Record<string, unknown> = rfqBody(),
  ) {
    return request(app)
      .post("/api/rfqs")
      .set("Authorization", `Bearer ${accessToken}`)
      .send(body);
  }

  function createOrder(
    accessToken: string,
    body: Record<string, unknown> = orderBody(),
  ) {
    return request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${accessToken}`)
      .send(body);
  }

  function patchStatus(
    projectId: string,
    accessToken: string,
    status: string,
  ) {
    return request(app)
      .patch(`/api/projects/${projectId}/status`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ status });
  }

  /** Creates an IN_PROGRESS project, the only state completion can start from. */
  function inProgressProject(ownerId = professionalId) {
    return projects.addProject(ownerId, { status: "IN_PROGRESS" });
  }

  function token(
    userId: string,
    role: "PROFESSIONAL" | "CUSTOMER" | "SELLER" | "ADMIN",
  ) {
    return tokenService.createAccessToken({ userId, role });
  }
});

function rfqBody(projectId?: string) {
  return {
    title: "Bulk structural materials",
    deliveryLocation: "Industrial Area, Addis Ababa",
    expiresAt: futureIso(7),
    ...(projectId !== undefined ? { projectId } : {}),
    items: [
      {
        categoryId: cementCategoryId,
        materialName: "General purpose cement",
        requestedQuantity: "2.500",
        requestedUnit: "TONNE",
      },
    ],
  };
}

function orderBody(projectId?: string) {
  return {
    items: [{ productId: cementProductId, sellerId, quantity: 2 }],
    shipping,
    paymentMethod: "CASH_ON_DELIVERY",
    ...(projectId !== undefined ? { projectId } : {}),
  };
}

function quoteBody(rfqItemId: string) {
  return {
    validUntil: futureIso(3),
    leadTimeDays: 5,
    items: [
      {
        rfqItemId,
        productId: cementProductId,
        offeredQuantity: 10,
        unitPrice: "5.00",
      },
    ],
  };
}

function futureIso(days: number): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}
