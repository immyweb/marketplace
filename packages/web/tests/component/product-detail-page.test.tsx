import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { server } from "./setup";
import { http, HttpResponse } from "msw";
import { product } from "./msw-handlers";
import ProductDetailPage from "@/app/products/[id]/page";

vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  useRouter: () => ({ refresh: vi.fn() }),
}));

function renderPage(id: string) {
  return ProductDetailPage({ params: Promise.resolve({ id }) });
}

describe("ProductDetailPage", () => {
  it("renders product details for a known product", async () => {
    render(await renderPage(String(product.id)));

    expect(
      screen.getByRole("article", { name: product.name }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: product.name }),
    ).toBeInTheDocument();
    expect(screen.getByText(product.description)).toBeInTheDocument();
    expect(
      screen.getByLabelText(
        `Price: ${product.currency} ${product.unit_price.toFixed(2)}`,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Add to Cart" }),
    ).toBeInTheDocument();
  });

  it("renders the gallery with all image_urls for the product", async () => {
    render(await renderPage(String(product.id)));

    const thumbnails = screen.getByRole("list", { name: "Product images" });
    expect(thumbnails).toBeInTheDocument();
    product.image_urls.forEach((_, i) => {
      expect(
        screen.getByRole("listitem", { name: `View image ${i + 1}` }),
      ).toBeInTheDocument();
    });
  });

  it("renders Product JSON-LD structured data", async () => {
    render(await renderPage(String(product.id)));

    const script = document.querySelector('script[type="application/ld+json"]');
    expect(script).not.toBeNull();
    const jsonLd = JSON.parse(script!.innerHTML);
    expect(jsonLd["@type"]).toBe("Product");
    expect(jsonLd.name).toBeTruthy();
  });

  it("throws a Next.js not-found error for an unknown product id", async () => {
    server.use(
      http.get("http://localhost:3001/products/:id", () =>
        HttpResponse.json({ error: "Product not found" }, { status: 404 }),
      ),
    );

    await expect(renderPage("999999")).rejects.toMatchObject({
      digest: "NEXT_HTTP_ERROR_FALLBACK;404",
    });
  });
});
