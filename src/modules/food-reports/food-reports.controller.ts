
import type {
  Request,
  Response,
  NextFunction,
} from "express";

import { AppError } from "../../shared/middleware/error-handler.js";

import {
  createFoodReport,
  getAdminFoodReports,
  getFoodReportDetail,
  getMyFoodReports,
  rejectFoodReport,
  resolveFoodReport,
  reviewFoodReport,
} from "./food-reports.service.js";

import type {
  CreateFoodReportBody,
  FoodReportsQuery,
  RejectFoodReportBody,
  ResolveFoodReportBody,
  ReviewFoodReportBody,
} from "./food-reports.validation.js";

function getRouteParam(
  value: string | string[] | undefined,
  name: string,
): string {
  const param = Array.isArray(value) ? value[0] : value;

  if (!param) {
    throw new AppError(400, `Missing route parameter: ${name}`);
  }

  return param;
}

export async function createFoodReportController(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const result = await createFoodReport(
      req.auth!.userId,
      req.body as CreateFoodReportBody,
    );

    res.status(201).json({
      success: true,
      message: "Food report submitted successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

export async function getMyFoodReportsController(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const query = res.locals.validatedQuery as FoodReportsQuery;

    const result = await getMyFoodReports(
      req.auth!.userId,
      query,
    );

    res.status(200).json({
      success: true,
      message: "Your food reports retrieved successfully",
      data: result.items,
      pagination: result.pagination,
    });
  } catch (error) {
    next(error);
  }
}

export async function getFoodReportDetailController(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const id = getRouteParam(req.params.id, "id");

    const result = await getFoodReportDetail(
      id,
      req.auth!.userId,
      req.auth!.role,
    );

    res.status(200).json({
      success: true,
      message: "Food report retrieved successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

export async function getAdminFoodReportsController(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const query = res.locals.validatedQuery as FoodReportsQuery;

    const result = await getAdminFoodReports(
      req.auth!.role,
      query,
    );

    res.status(200).json({
      success: true,
      message: "Food reports retrieved successfully",
      data: result.items,
      pagination: result.pagination,
    });
  } catch (error) {
    next(error);
  }
}

export async function reviewFoodReportController(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const id = getRouteParam(req.params.id, "id");

    const result = await reviewFoodReport(
      id,
      req.auth!.userId,
      req.auth!.role,
      req.body as ReviewFoodReportBody,
    );

    res.status(200).json({
      success: true,
      message: "Food report moved to review",
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

export async function resolveFoodReportController(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const id = getRouteParam(req.params.id, "id");

    const result = await resolveFoodReport(
      id,
      req.auth!.userId,
      req.auth!.role,
      req.body as ResolveFoodReportBody,
    );

    res.status(200).json({
      success: true,
      message: "Food report resolved successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

export async function rejectFoodReportController(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const id = getRouteParam(req.params.id, "id");

    const result = await rejectFoodReport(
      id,
      req.auth!.userId,
      req.auth!.role,
      req.body as RejectFoodReportBody,
    );

    res.status(200).json({
      success: true,
      message: "Food report rejected successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
}
