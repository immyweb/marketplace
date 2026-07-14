import { describe, it, expect } from "vitest";
import { buildProductsHref } from "./product-href";

describe("buildProductsHref", () => {
  it("builds a search URL when q is set", () => {
    expect(buildProductsHref({ q: "warm jacket" })).toBe("/?q=warm+jacket");
  });

  it("drops page, sort, and category when q is set", () => {
    expect(
      buildProductsHref({
        q: "warm jacket",
        page: 2,
        sort: "price_asc",
        category: "Outerwear",
      }),
    ).toBe("/?q=warm+jacket");
  });

  it("returns the root path when q is empty", () => {
    expect(buildProductsHref({ q: undefined })).toBe("/");
  });
});
