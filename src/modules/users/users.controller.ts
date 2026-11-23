import type { Request, Response, NextFunction } from "express";

import {
  getMyProfile,
  updateMyAccount,
  updateMyRoleProfile,
} from "./users.service.js";

import type {
  UpdateProfileInput,
  UpdateUserInput,
} from "./users.types.js";

export async function getProfile(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const userId = req.auth!.userId;
    const result = await getMyProfile(userId);

    res.status(200).json({
      success: true,
      message: "Profile retrieved successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

export async function updateMe(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const userId = req.auth!.userId;
    const result = await updateMyAccount(
      userId,
      req.body as UpdateUserInput,
    );

    res.status(200).json({
      success: true,
      message: "Account updated successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

export async function updateProfile(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const userId = req.auth!.userId;
    const result = await updateMyRoleProfile(
      userId,
      req.body as UpdateProfileInput,
    );

    res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
}