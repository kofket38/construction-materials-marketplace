import { Router, type RequestHandler } from "express";
import type { PaymentController } from "../controllers/payment.controller.js";
import { authorizeRoles } from "../middleware/authorize-role.js";
import { uploadPaymentProof } from "../middleware/payment-proof-upload.js";
import { validateRequest } from "../middleware/validate-request.js";
import { asyncHandler } from "../utils/async-handler.js";
import {
  checkoutPaymentOptionsBodySchema,
  emptyPaymentObjectSchema,
  paymentFilenameParamsSchema,
  paymentOrderIdParamsSchema,
  submitManualPaymentBodySchema,
} from "../validators/payment.validators.js";

export function createPaymentRouter(
  controller: PaymentController,
  requireAuthentication: RequestHandler,
): Router {
  const router = Router();

  router.post(
    "/options",
    requireAuthentication,
    authorizeRoles("CUSTOMER", "PROFESSIONAL"),
    validateRequest({
      body: checkoutPaymentOptionsBodySchema,
      params: emptyPaymentObjectSchema,
      query: emptyPaymentObjectSchema,
    }),
    asyncHandler(controller.findCheckoutOptions),
  );

  router.post(
    "/manual",
    requireAuthentication,
    authorizeRoles("CUSTOMER", "PROFESSIONAL"),
    uploadPaymentProof,
    validateRequest({
      body: submitManualPaymentBodySchema,
      params: emptyPaymentObjectSchema,
      query: emptyPaymentObjectSchema,
    }),
    asyncHandler(controller.submitManualPayment),
  );

  // Authenticated proof serving — must come before /:orderId
  router.get(
    "/proof/:filename",
    requireAuthentication,
    authorizeRoles("CUSTOMER", "PROFESSIONAL", "SELLER", "ADMIN"),
    validateRequest({
      body: emptyPaymentObjectSchema,
      params: paymentFilenameParamsSchema,
      query: emptyPaymentObjectSchema,
    }),
    asyncHandler(controller.serveProof),
  );

  router.get(
    "/:orderId",
    requireAuthentication,
    authorizeRoles("CUSTOMER", "PROFESSIONAL"),
    validateRequest({
      body: emptyPaymentObjectSchema,
      params: paymentOrderIdParamsSchema,
      query: emptyPaymentObjectSchema,
    }),
    asyncHandler(controller.findByOrderId),
  );

  return router;
}
