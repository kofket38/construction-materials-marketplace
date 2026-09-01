import { Router, type RequestHandler } from "express";
import type { RfqController } from "../controllers/rfq.controller.js";
import { authorizeRoles } from "../middleware/authorize-role.js";
import { validateRequest } from "../middleware/validate-request.js";
import { asyncHandler } from "../utils/async-handler.js";
import {
  createRfqBodySchema,
  createSupplierQuoteBodySchema,
  emptyRfqObjectSchema,
  quoteIdParamsSchema,
  rfqIdParamsSchema,
  rfqListQuerySchema,
  sellerRfqListQuerySchema,
  updateRfqBodySchema,
  updateSupplierQuoteBodySchema,
} from "../validators/rfq.validators.js";

export function createRfqRouter(
  controller: RfqController,
  requireAuthentication: RequestHandler,
): Router {
  const router = Router();

  router.post(
    "/rfqs",
    requireAuthentication,
    authorizeRoles("CUSTOMER", "PROFESSIONAL"),
    validateRequest({
      body: createRfqBodySchema,
      params: emptyRfqObjectSchema,
      query: emptyRfqObjectSchema,
    }),
    asyncHandler(controller.create),
  );

  router.get(
    "/rfqs/me",
    requireAuthentication,
    authorizeRoles("CUSTOMER", "PROFESSIONAL"),
    validateRequest({
      body: emptyRfqObjectSchema,
      params: emptyRfqObjectSchema,
      query: rfqListQuerySchema,
    }),
    asyncHandler(controller.findMyRfqs),
  );

  router.get(
    "/seller/rfqs",
    requireAuthentication,
    authorizeRoles("SELLER"),
    validateRequest({
      body: emptyRfqObjectSchema,
      params: emptyRfqObjectSchema,
      query: sellerRfqListQuerySchema,
    }),
    asyncHandler(controller.findSellerRfqs),
  );

  router.get(
    "/admin/rfqs",
    requireAuthentication,
    authorizeRoles("ADMIN"),
    validateRequest({
      body: emptyRfqObjectSchema,
      params: emptyRfqObjectSchema,
      query: rfqListQuerySchema,
    }),
    asyncHandler(controller.findAdminRfqs),
  );

  router.get(
    "/rfqs/:id",
    requireAuthentication,
    validateRequest({
      body: emptyRfqObjectSchema,
      params: rfqIdParamsSchema,
      query: emptyRfqObjectSchema,
    }),
    asyncHandler(controller.findById),
  );

  router.put(
    "/rfqs/:id",
    requireAuthentication,
    authorizeRoles("CUSTOMER", "PROFESSIONAL"),
    validateRequest({
      body: updateRfqBodySchema,
      params: rfqIdParamsSchema,
      query: emptyRfqObjectSchema,
    }),
    asyncHandler(controller.update),
  );

  router.patch(
    "/rfqs/:id/cancel",
    requireAuthentication,
    authorizeRoles("CUSTOMER", "PROFESSIONAL"),
    validateRequest({
      body: emptyRfqObjectSchema,
      params: rfqIdParamsSchema,
      query: emptyRfqObjectSchema,
    }),
    asyncHandler(controller.cancel),
  );

  router.post(
    "/rfqs/:id/quotes",
    requireAuthentication,
    authorizeRoles("SELLER"),
    validateRequest({
      body: createSupplierQuoteBodySchema,
      params: rfqIdParamsSchema,
      query: emptyRfqObjectSchema,
    }),
    asyncHandler(controller.createQuote),
  );

  router.put(
    "/quotes/:id",
    requireAuthentication,
    authorizeRoles("SELLER"),
    validateRequest({
      body: updateSupplierQuoteBodySchema,
      params: quoteIdParamsSchema,
      query: emptyRfqObjectSchema,
    }),
    asyncHandler(controller.updateQuote),
  );

  router.patch(
    "/quotes/:id/withdraw",
    requireAuthentication,
    authorizeRoles("SELLER"),
    validateRequest({
      body: emptyRfqObjectSchema,
      params: quoteIdParamsSchema,
      query: emptyRfqObjectSchema,
    }),
    asyncHandler(controller.withdrawQuote),
  );

  router.post(
    "/quotes/:id/reject",
    requireAuthentication,
    authorizeRoles("CUSTOMER", "PROFESSIONAL"),
    validateRequest({
      body: emptyRfqObjectSchema,
      params: quoteIdParamsSchema,
      query: emptyRfqObjectSchema,
    }),
    asyncHandler(controller.rejectQuote),
  );

  router.post(
    "/quotes/:id/accept",
    requireAuthentication,
    authorizeRoles("CUSTOMER", "PROFESSIONAL"),
    validateRequest({
      body: emptyRfqObjectSchema,
      params: quoteIdParamsSchema,
      query: emptyRfqObjectSchema,
    }),
    asyncHandler(controller.acceptQuote),
  );

  return router;
}
