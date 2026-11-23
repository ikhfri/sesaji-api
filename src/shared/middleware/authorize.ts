
import type {
  Request,
  Response,
  NextFunction,
} from "express";

import { AppError } from "./error-handler.js";

export function authorize(...allowedRoles: string[]) {
  return (
    req: Request,
    _res: Response,
    next: NextFunction,
  ) => {
    if (!req.auth) {
      next(new AppError(401, "Authentication required"));
      return;
    }

    if (!allowedRoles.includes(req.auth.role)) {
      next(new AppError(403, "You do not have permission"));
      return;
    }

    next();
  };
}
