import type { NextFunction, Request, Response } from "express";
import { fromNodeHeaders } from "better-auth/node";
import { auth } from "../auth";
import { ForbiddenError } from "../errors";

export async function requireAuth(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  try {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });

    if (!session) {
      throw new ForbiddenError("Sign in required");
    }

    req.userId = session.user.id;
    next();
  } catch (err) {
    next(err);
  }
}
