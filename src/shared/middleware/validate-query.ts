
import type {
  Request,
  Response,
  NextFunction,
} from "express";

import type { ZodType } from "zod";

export function validateQuery(schema: ZodType) {
  return (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    const result = schema.safeParse(req.query);

    if (!result.success) {
      res.status(422).json({
        success: false,
        message: "Validation failed",
        errors: result.error.issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message,
        })),
      });

      return;
    }

    res.locals.validatedQuery = result.data;
    next();
  };
}
