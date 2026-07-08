import type { Request, Response, NextFunction } from "express";
import { AppError } from "@/shared/errors";
import { logger } from "@/shared/logger";

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  if (err instanceof AppError) {
    logger.warn({ code: err.code }, err.message);
    res.status(err.statusCode).json({ error: err.message, code: err.code });
    return;
  }

  logger.error({ err }, "Unhandled error");
  res
    .status(500)
    .json({ error: "Internal server error", code: "INTERNAL_ERROR" });
}
