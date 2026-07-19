import type { RequestHandler } from "express";
import type { ZodIssue, ZodType } from "zod";
import { BadRequestError } from "../utils/api-error.js";

interface RequestSchemas {
  body?: ZodType;
  params?: ZodType;
  query?: ZodType;
}

export function validateRequest(schemas: RequestSchemas): RequestHandler {
  return (req, _res, next) => {
    const requestLocations = [
      ["body", schemas.body, req.body === undefined ? {} : req.body],
      ["params", schemas.params, req.params],
      ["query", schemas.query, req.query],
    ] as const;

    for (const [location, schema, value] of requestLocations) {
      if (!schema) {
        continue;
      }

      const result = schema.safeParse(value);

      if (!result.success) {
        const errors = result.error.issues.map((issue: ZodIssue) => ({
          field: [location, ...issue.path].join("."),
          message: issue.message,
        }));

        next(new BadRequestError("Request validation failed.", errors));
        return;
      }

      if (location === "body") {
        req.body = result.data;
      } else if (location === "params") {
        req.params = result.data as typeof req.params;
      }
    }

    next();
  };
}
