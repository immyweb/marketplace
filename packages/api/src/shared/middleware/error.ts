import type { Request, Response, NextFunction } from "express";
import { AppError } from "../errors";

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ error: err.message, code: err.code });
    return;
  }

  console.error(err);
  res
    .status(500)
    .json({ error: "Internal server error", code: "INTERNAL_ERROR" });
}
