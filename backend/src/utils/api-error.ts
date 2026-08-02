export interface ApiErrorDetail {
  field: string;
  message: string;
}

export class ApiError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly errors: ApiErrorDetail[] = [],
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export class BadRequestError extends ApiError {
  constructor(message = "The request is invalid.", errors: ApiErrorDetail[] = []) {
    super(400, message, errors);
  }
}

export class UnauthorizedError extends ApiError {
  constructor(message = "Authentication is required.") {
    super(401, message);
  }
}

export class ForbiddenError extends ApiError {
  constructor(message = "You do not have permission to perform this action.") {
    super(403, message);
  }
}

export class NotFoundError extends ApiError {
  constructor(message = "The requested resource was not found.") {
    super(404, message);
  }
}

export class ConflictError extends ApiError {
  constructor(message = "The request conflicts with existing data.") {
    super(409, message);
  }
}

export class TooManyRequestsError extends ApiError {
  constructor(message = "Too many requests. Please try again later.") {
    super(429, message);
  }
}

export class PayloadTooLargeError extends ApiError {
  constructor(message = "Request body exceeds the maximum allowed size.") {
    super(413, message);
  }
}
