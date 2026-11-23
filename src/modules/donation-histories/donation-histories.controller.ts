
import type {
  Request,
  Response,
  NextFunction,
} from "express";

import { AppError } from "../../shared/middleware/error-handler.js";

import {
  getDonationHistoryDetail,
  getMyDonationHistories,
} from "./donation-histories.service.js";

import type {
  DonationHistoryQuery,
} from "./donation-histories.types.js";

function getRouteParam(
  value: string | string[] | undefined,
  name: string,
): string {
  const param = Array.isArray(value) ? value[0] : value;

  if (!param) {
    throw new AppError(
      400,
      `Missing route parameter: ${name}`,
    );
  }

  return param;
}

export async function getMyDonationHistoriesController(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const query = res.locals.validatedQuery as DonationHistoryQuery;

    const result = await getMyDonationHistories(
      req.auth!.userId,
      req.auth!.role,
      query,
    );

    res.status(200).json({
      success: true,
      message: "Donation histories retrieved successfully",
      data: result.items,
      pagination: result.pagination,
    });
  } catch (error) {
    next(error);
  }
}

export async function getDonationHistoryDetailController(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const id = getRouteParam(req.params.id, "id");

    const result = await getDonationHistoryDetail(
      id,
      req.auth!.userId,
      req.auth!.role,
    );

    res.status(200).json({
      success: true,
      message: "Donation history retrieved successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
}
