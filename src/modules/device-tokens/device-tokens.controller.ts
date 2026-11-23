import type {
  Request,
  Response,
  NextFunction,
} from "express";

import {
  registerDevice,
  unregisterDevice,
} from "./device-tokens.service.js";

import type {
  RegisterDeviceTokenBody,
  RevokeDeviceTokenBody,
} from "./device-tokens.validation.js";

export async function registerDeviceToken(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const input = req.body as RegisterDeviceTokenBody;

    const result = await registerDevice(
      req.auth!.userId,
      input,
    );

    res.status(201).json({
      success: true,
      message: "Device registered successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

export async function revokeDeviceToken(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const input = req.body as RevokeDeviceTokenBody;

    const result = await unregisterDevice(
      req.auth!.userId,
      input.token,
    );

    res.status(200).json({
      success: true,
      message: "Device token revoked successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
}
