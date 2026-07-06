import { describe, it, expect, vi } from "vitest";
import { errorHandler } from "./error.js";
import { NotFoundError } from "../errors.js";

function createRes() {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

describe("errorHandler", () => {
  it("maps AppError subclasses to their status code and code", () => {
    const res = createRes();

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
  });

  it("falls back to 500 INTERNAL_ERROR for unknown errors", () => {
    const res = createRes();
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    errorHandler(new Error("boom"), {} as any, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: "Internal server error",
      code: "INTERNAL_ERROR",
    });

    consoleSpy.mockRestore();
  });
});
