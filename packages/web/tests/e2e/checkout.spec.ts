import { test, expect } from "@playwright/test";

test.describe("Checkout flow with empty cart", () => {
  test("redirects to /cart when checkout is visited with empty cart", async ({
    page,
  }) => {
    // New context = fresh session = empty cart
    await page.goto("/checkout");
    // Give client-side redirect time to run
    await page.waitForURL(/\/cart/);
    await expect(page).toHaveURL("/cart");
  });
});

test.describe("Checkout flow", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/products/1");
    await page.getByRole("button", { name: "Add to Cart" }).click();
    await page.waitForLoadState("networkidle");
  });

  test("completes a full purchase and lands on order confirmation", async ({
    page,
  }) => {
    await page.goto("/checkout");
    await expect(page.getByRole("heading", { name: "Checkout" })).toBeVisible();

    // Fill address
    await page.getByLabel("Full name").fill("Jane Smith");
    await page.getByLabel("Street address").fill("10 Downing Street");
    await page.getByLabel("City").fill("London");
    await page.getByLabel("Postcode").fill("SW1A 2AA");

    // Fill Stripe card (inside iframe)
    const stripeFrame = page
      .frameLocator('iframe[name^="__privateStripeFrame"]')
      .first();
    await stripeFrame
      .getByRole("textbox", { name: "Card number" })
      .fill("4242424242424242");
    await stripeFrame
      .getByRole("textbox", { name: /expiration/i })
      .fill("12/30");
    await stripeFrame.getByRole("textbox", { name: /CVC/i }).fill("123");

    await page.getByRole("button", { name: "Place Order" }).click();

    // Wait for redirect to order confirmation (Stripe payment takes a moment)
    await page.waitForURL(/\/order-confirmation\/\d+/, { timeout: 15000 });

    await expect(
      page.getByRole("heading", { name: "Order Confirmed" }),
    ).toBeVisible();
    await expect(page.getByText(/Jane Smith/)).toBeVisible();
    await expect(page.getByText(/Card ending in/)).toBeVisible();
  });

  test("shows a validation error when address fields are empty", async ({
    page,
  }) => {
    await page.goto("/checkout");
    await page.getByRole("button", { name: "Place Order" }).click();
    await expect(page.getByRole("alert").first()).toBeVisible();
  });
});
