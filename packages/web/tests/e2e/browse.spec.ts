import { test, expect } from "@playwright/test";

test.describe("Product browsing", () => {
  test("PLP shows a list of products", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: "All Products" }),
    ).toBeVisible();
    const products = page.getByRole("listitem");
    await expect(products).toHaveCount(6);
  });

  test("clicking a product navigates to the PDP", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("listitem").first().getByRole("link").click();
    await expect(page).toHaveURL(/\/products\/\d+/);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("PDP shows product name, description, price, and add-to-cart button", async ({
    page,
  }) => {
    await page.goto("/products/1");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Add to Cart" }),
    ).toBeVisible();
  });

  test("PDP has JSON-LD structured data", async ({ page }) => {
    await page.goto("/products/1");
    const jsonLd = await page.$eval(
      'script[type="application/ld+json"]',
      (el) => JSON.parse(el.textContent ?? "{}"),
    );
    expect(jsonLd["@type"]).toBe("Product");
    expect(jsonLd.name).toBeTruthy();
  });

  test("sitemap.xml is accessible", async ({ page }) => {
    const res = await page.goto("/sitemap.xml");
    expect(res?.status()).toBe(200);
    expect(res?.headers()["content-type"]).toContain("xml");
  });
});
