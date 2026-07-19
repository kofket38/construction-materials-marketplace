import type { CookieOptions } from "express";
import { env } from "./env.js";

export const REFRESH_TOKEN_COOKIE = "refreshToken";

const SEVEN_DAYS_IN_MS = 7 * 24 * 60 * 60 * 1000;

export const refreshCookieOptions: CookieOptions = {
  httpOnly: true,
  secure: env.NODE_ENV === "production",
  sameSite: "strict",
  path: "/api/auth",
  maxAge: SEVEN_DAYS_IN_MS,
};

export const clearRefreshCookieOptions: CookieOptions = {
  httpOnly: true,
  secure: env.NODE_ENV === "production",
  sameSite: "strict",
  path: "/api/auth",
};
