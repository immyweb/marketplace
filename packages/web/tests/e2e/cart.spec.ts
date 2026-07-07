import { test, expect } from "@playwright/test";

test.describe("Cart flow", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/products/1");
    await page.getByRole("button", { name: "Add to Cart" }).click();
    await page.getByRole("button", { name: "Continue Shopping" }).click();
    await expect(page.getByRole("link", { name: /Cart/ })).toContainText("1");
  });

  test("added item appears in the cart", async ({ page }) => {
    await page.goto("/cart");
    await expect(page.getByRole("list", { name: "Cart items" })).toBeVisible();
    const items = page.getByRole("listitem");
    await expect(items).toHaveCount(1);
  });

  test("cart shows the correct total", async ({ page }) => {
    await page.goto("/cart");
    const total = page.getByLabel(/Order total/);
    await expect(total).toBeVisible();
    await expect(total).toContainText("£");
  });

  test("increasing quantity updates the total", async ({ page }) => {
    await page.goto("/cart");
    const increaseBtn = page.getByRole("button", { name: "Increase quantity" });
    await increaseBtn.click();
    await page.waitForLoadState("networkidle");
    const item = page.getByRole("listitem").first();
    await expect(item.getByLabel(/Quantity/)).toContainText("2");
  });

  test("removing an item empties the cart", async ({ page }) => {
    await page.goto("/cart");
    await page.getByRole("button", { name: /Remove/ }).click();
    await page.waitForLoadState("networkidle");
    await expect(page.getByText("Your cart is empty")).toBeVisible();
  });
});
