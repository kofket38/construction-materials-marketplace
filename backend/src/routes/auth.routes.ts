import { Router, type RequestHandler } from "express";
import type { AuthController } from "../controllers/auth.controller.js";
import { validateRequest } from "../middleware/validate-request.js";
import { asyncHandler } from "../utils/async-handler.js";
import {
  emptyObjectSchema,
  loginBodySchema,
  registerBodySchema,
} from "../validators/auth.validators.js";

export function createAuthRouter(
  controller: AuthController,
  requireAuthentication: RequestHandler,
): Router {
  const router = Router();
  const noInput = validateRequest({
    body: emptyObjectSchema,
    params: emptyObjectSchema,
    query: emptyObjectSchema,
  });

  router.post(
    "/register",
    validateRequest({
      body: registerBodySchema,
      params: emptyObjectSchema,
      query: emptyObjectSchema,
    }),
    asyncHandler(controller.register),
  );
  router.post(
    "/login",
    validateRequest({
      body: loginBodySchema,
      params: emptyObjectSchema,
      query: emptyObjectSchema,
    }),
    asyncHandler(controller.login),
  );
  router.post("/refresh", noInput, asyncHandler(controller.refresh));
  router.post("/logout", noInput, asyncHandler(controller.logout));
  router.get(
    "/me",
    noInput,
    requireAuthentication,
    asyncHandler(controller.me),
  );

  return router;
}
