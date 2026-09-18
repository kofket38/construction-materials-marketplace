import type { CookieOptions } from "express";
import { env } from "./env.js";

export const REFRESH_TOKEN_COOKIE = "refreshToken";

const SEVEN_DAYS_IN_MS = 7 * 24 * 60 * 60 * 1000;

export const clearRefreshCookieOptions: CookieOptions = {
  httpOnly: true,
  secure: env.NODE_ENV === "production",
  sameSite: env.NODE_ENV === "production" ? "none" : "lax",
  path: "/api/auth",
};

export const refreshCookieOptions: CookieOptions = {
  ...clearRefreshCookieOptions,
  maxAge: SEVEN_DAYS_IN_MS,
};
