import type { Request, Response } from "express";
import {
  clearRefreshCookieOptions,
  REFRESH_TOKEN_COOKIE,
  refreshCookieOptions,
} from "../config/security.js";
import type { AuthService } from "../services/auth.service.js";
import type {
  LoginBody,
  RegisterBody,
} from "../validators/auth.validators.js";
import { UnauthorizedError } from "../utils/api-error.js";

function readRefreshCookie(req: Request): string | undefined {
  const value = req.cookies?.[REFRESH_TOKEN_COOKIE];
  return typeof value === "string" ? value : undefined;
}

export class AuthController {
  constructor(private readonly authService: AuthService) {}

  register = async (req: Request, res: Response): Promise<void> => {
    const { refreshToken, ...data } = await this.authService.register(
      req.body as RegisterBody,
    );

    res.cookie(REFRESH_TOKEN_COOKIE, refreshToken, refreshCookieOptions);
    res.status(201).json({
      success: true,
      data,
    });
  };

  login = async (req: Request, res: Response): Promise<void> => {
    const { refreshToken, ...data } = await this.authService.login(
      req.body as LoginBody,
    );

    res.cookie(REFRESH_TOKEN_COOKIE, refreshToken, refreshCookieOptions);
    res.status(200).json({
      success: true,
      data,
    });
  };

  refresh = async (req: Request, res: Response): Promise<void> => {
    const { accessToken, refreshToken } = await this.authService.refresh(
      readRefreshCookie(req),
    );

    res.cookie(REFRESH_TOKEN_COOKIE, refreshToken, refreshCookieOptions);
    res.status(200).json({
      success: true,
      data: { accessToken },
    });
  };

  logout = async (req: Request, res: Response): Promise<void> => {
    await this.authService.logout(readRefreshCookie(req));
    res.clearCookie(REFRESH_TOKEN_COOKIE, clearRefreshCookieOptions);
    res.status(200).json({
      success: true,
      data: null,
    });
  };

  me = async (req: Request, res: Response): Promise<void> => {
    if (!req.auth) {
      throw new UnauthorizedError();
    }

    const user = await this.authService.getProfile(req.auth.userId);
    res.status(200).json({
      success: true,
      data: { user },
    });
  };
}
