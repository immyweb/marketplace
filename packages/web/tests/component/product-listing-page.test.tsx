import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { server } from "./setup";
import { productListing } from "./msw-handlers";
import ProductListingPage from "@/app/page";

vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));

function searchParams(params: Record<string, string> = {}) {
  return Promise.resolve(params);
}

describe("ProductListingPage", () => {
  it("renders a product listing for every product returned by the API", async () => {
    render(await ProductListingPage({ searchParams: searchParams() }));

    const list = screen.getByRole("list", { name: "Product listing" });
    const item = within(list).getByRole("img", { name: productListing.name });
    expect(item).toBeInTheDocument();
    expect(within(list).getByText(productListing.name)).toBeInTheDocument();
    expect(
      within(list).getByLabelText(
        `Price: ${productListing.currency} ${productListing.unit_price.toFixed(2)}`,
      ),
    ).toBeInTheDocument();
  });

  it("shows an empty state when there are no products", async () => {
    server.use(
      http.get("http://localhost:3001/products", () =>
        HttpResponse.json({ results: [], total: 0, page: 1, totalPages: 0 }),
      ),
    );

    render(await ProductListingPage({ searchParams: searchParams() }));

    expect(screen.getByText("No products available.")).toBeInTheDocument();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });

  it("shows a category-specific empty state when filtering by category", async () => {
    server.use(
      http.get("http://localhost:3001/products", () =>
        HttpResponse.json({ results: [], total: 0, page: 1, totalPages: 0 }),
      ),
    );

    render(
      await ProductListingPage({
        searchParams: searchParams({ category: "Footwear" }),
      }),
    );

    expect(
      screen.getByText("No products in this category."),
    ).toBeInTheDocument();
  });

  it("renders category filter links and a sort control", async () => {
    render(await ProductListingPage({ searchParams: searchParams() }));

    expect(screen.getByRole("link", { name: "Tops" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Sort:/ })).toBeInTheDocument();
  });

  it("renders pagination when there is more than one page", async () => {
    server.use(
      http.get("http://localhost:3001/products", () =>
        HttpResponse.json({
          results: [productListing],
          total: 20,
          page: 1,
          totalPages: 2,
        }),
      ),
    );

    render(await ProductListingPage({ searchParams: searchParams() }));

    expect(
      screen.getByRole("navigation", { name: "Pagination" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "2" })).toBeInTheDocument();
  });
});
