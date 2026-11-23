
import type { Request, Response } from "express";

import * as authService from "./auth.service.js";
import type {
  RegisterBody,
  LoginBody,
} from "./auth.validation.js";

import { env } from "../../config/env.js";

const REFRESH_COOKIE_NAME = "sesaji_refresh_token";

const refreshCookieOptions = {
  httpOnly: true,
  secure: env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: `${env.API_PREFIX}/auth`,
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

function setRefreshCookie(res: Response, token: string) {
  res.cookie(
    REFRESH_COOKIE_NAME,
    token,
    refreshCookieOptions,
  );
}

function clearRefreshCookie(res: Response) {
  res.clearCookie(REFRESH_COOKIE_NAME, {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax",
    path: `${env.API_PREFIX}/auth`,
  });
}

export async function register(req: Request, res: Response) {
  const result = await authService.register(
    req.body as RegisterBody,
  );

  res.status(201).json({
    success: true,
    message: result.message,
    data: {
      userId: result.userId,
      email: result.email,
    },
  });
}

export async function login(req: Request, res: Response) {
  const body = req.body as LoginBody;

  const result = await authService.login(
    body.email,
    body.password,
    {
      userAgent: req.get("user-agent") ?? undefined,
      ipAddress: req.ip,
    },
  );

  setRefreshCookie(res, result.refreshToken);

  res.status(200).json({
    success: true,
    message: "Login successful",
    data: {
      user: result.user,
      accessToken: result.accessToken,
      expiresAt: result.expiresAt,
    },
  });
}

export async function verifyEmail(req: Request, res: Response) {
  const { token } = req.body as { token: string };

  const result = await authService.verifyEmail(token);

  res.status(200).json({
    success: true,
    message: result.message,
  });
}

export async function refresh(req: Request, res: Response) {
  const refreshToken = req.cookies?.[REFRESH_COOKIE_NAME];

  if (typeof refreshToken !== "string") {
    res.status(401).json({
      success: false,
      message: "Refresh token is required",
    });
    return;
  }

  const result = await authService.refresh(refreshToken);

  setRefreshCookie(res, result.refreshToken);

  res.status(200).json({
    success: true,
    message: "Token refreshed successfully",
    data: {
      accessToken: result.accessToken,
      expiresAt: result.expiresAt,
    },
  });
}

export async function logout(req: Request, res: Response) {
  const auth = req.auth!;

  const result = await authService.logout(
    auth.sessionId,
    auth.userId,
  );

  clearRefreshCookie(res);

  res.status(200).json({
    success: true,
    message: result.message,
  });
}

export async function me(req: Request, res: Response) {
  const auth = req.auth!;

  const user = await authService.getCurrentUser(auth.userId);

  res.status(200).json({
    success: true,
    data: { user },
  });
}


export async function resendVerification(
  req: Request,
  res: Response,
) {
  const { email } = req.body as { email: string };

  const result = await authService.resendVerification(email);

  res.status(200).json({
    success: true,
    message: result.message,
  });
}
