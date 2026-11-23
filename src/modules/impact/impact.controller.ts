
import { AppError } from "../../shared/middleware/error-handler.js";
import type { Request, Response } from "express";

import {
  getAdminImpactDashboard,
  getMyPersonalImpact,
} from "./impact.service.js";

export async function getAdminImpactDashboardController(
  _req: Request,
  res: Response,
) {
  const data = await getAdminImpactDashboard();

  res.status(200).json({
    success: true,
    message: "Impact dashboard retrieved successfully",
    data,
  });
}

export async function getMyPersonalImpactController(
  req: Request,
  res: Response,
) {
  const auth = req.auth;

  if (!auth) {
    throw new AppError(401, "Unauthenticated");
  }

  const data = await getMyPersonalImpact(
    auth.userId,
    auth.role,
  );

  res.status(200).json({
    success: true,
    message: "Personal impact retrieved successfully",
    data,
  });
}
