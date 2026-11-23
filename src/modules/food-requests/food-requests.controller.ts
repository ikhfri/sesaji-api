
import type { Request, Response, NextFunction } from "express";

import { AppError } from "../../shared/middleware/error-handler.js";

import * as foodRequestsService from "./food-requests.service.js";

import type {
  CreateFoodRequestInput,
  FoodRequestQuery,
  RespondFoodRequestInput,
} from "./food-requests.types.js";

export async function createRequest(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const request = await foodRequestsService.createRequest(
      req.auth!.userId,
      req.auth!.role,
      req.body as CreateFoodRequestInput,
    );

    res.status(201).json({
      success: true,
      message: "Food request created successfully",
      data: request,
    });
  } catch (error) {
    next(error);
  }
}

export async function getRequestById(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const requestId = Array.isArray(req.params.id)
      ? req.params.id[0]
      : req.params.id;

    if (!requestId) {
      throw new AppError(400, "Invalid food request ID");
    }

    const request = await foodRequestsService.getRequestById(
      requestId,
      req.auth!.userId,
      req.auth!.role,
    );

    res.status(200).json({
      success: true,
      message: "Food request retrieved successfully",
      data: request,
    });
  } catch (error) {
    next(error);
  }
}

export async function getMyRequests(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const query = res.locals.validatedQuery as FoodRequestQuery;

    const result = await foodRequestsService.getMyRequests(
      req.auth!.userId,
      req.auth!.role,
      query,
    );

    res.status(200).json({
      success: true,
      message: "Food requests retrieved successfully",
      data: result.items,
      pagination: result.pagination,
    });
  } catch (error) {
    next(error);
  }
}

export async function getIncomingRequests(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const query = res.locals.validatedQuery as FoodRequestQuery;

    const result = await foodRequestsService.getIncomingRequests(
      req.auth!.userId,
      query,
    );

    res.status(200).json({
      success: true,
      message: "Incoming food requests retrieved successfully",
      data: result.items,
      pagination: result.pagination,
    });
  } catch (error) {
    next(error);
  }
}

export async function respondToRequest(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const requestId = Array.isArray(req.params.id)
      ? req.params.id[0]
      : req.params.id;

    if (!requestId) {
      throw new AppError(400, "Invalid food request ID");
    }

    const input = req.body as RespondFoodRequestInput;

    const request = await foodRequestsService.respondToRequest(
      req.auth!.userId,
      requestId,
      input.action,
      input.rejectionReason,
    );

    res.status(200).json({
      success: true,
      message:
        input.action === "APPROVE"
          ? "Food request approved successfully"
          : "Food request rejected successfully",
      data: request,
    });
  } catch (error) {
    next(error);
  }
}

export async function cancelRequest(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const requestId = Array.isArray(req.params.id)
      ? req.params.id[0]
      : req.params.id;

    if (!requestId) {
      throw new AppError(400, "Invalid food request ID");
    }

    const request = await foodRequestsService.cancelRequest(
      req.auth!.userId,
      requestId,
    );

    res.status(200).json({
      success: true,
      message: "Food request cancelled successfully",
      data: request,
    });
  } catch (error) {
    next(error);
  }
}
