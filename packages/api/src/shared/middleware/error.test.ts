import { describe, it, expect, vi } from "vitest";
import { errorHandler } from "./error";
import { NotFoundError } from "@/shared/errors";
import { logger } from "@/shared/logger";

function createRes() {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

describe("errorHandler", () => {
  it("maps AppError subclasses to their status code and code, and logs a warning", () => {
    const res = createRes();
    const warnSpy = vi.spyOn(logger, "warn").mockImplementation(() => logger);

    errorHandler(
      new NotFoundError("Widget not found"),
      {} as any,
      res,
      vi.fn(),
    );

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      error: "Widget not found",
      code: "NOT_FOUND",
    });
    expect(warnSpy).toHaveBeenCalledWith(
      { code: "NOT_FOUND" },
      "Widget not found",
    );

    warnSpy.mockRestore();
  });

  it("falls back to 500 INTERNAL_ERROR for unknown errors, and logs at error level", () => {
    const res = createRes();
    const err = new Error("boom");
    const errorSpy = vi.spyOn(logger, "error").mockImplementation(() => logger);

    errorHandler(err, {} as any, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: "Internal server error",
      code: "INTERNAL_ERROR",
    });
    expect(errorSpy).toHaveBeenCalledWith({ err }, "Unhandled error");

    errorSpy.mockRestore();
  });
});
