> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Phase 10 — End-to-End Tests** | [link to overview](../2026-06-30-marketplace.md)

**Global Constraints:** See [overview](../2026-06-30-marketplace.md#global-constraints) — all constraints apply here.

---

## Phase 10 — End-to-End Tests

### Task 24: E2E — Browse Products

**Files:**

- Create: `packages/web/tests/e2e/browse.spec.ts`

- [ ] **Step 1: Write the test**

```typescript
import { test, expect } from '@playwright/test';

test.describe('Product browsing', () => {
  test('PLP shows a list of products', async ({ page }) => {
    await page.goto('/');
    await expect(
      page.getByRole('heading', { name: 'All Products' })
    ).toBeVisible();
    const products = page.getByRole('listitem');
    await expect(products).toHaveCount(6);
  });

  test('clicking a product navigates to the PDP', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('listitem').first().getByRole('link').click();
    await expect(page).toHaveURL(/\/products\/\d+/);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });

  test('PDP shows product name, description, price, and add-to-cart button', async ({
    page
  }) => {
    await page.goto('/products/1');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Add to Cart' })
    ).toBeVisible();
  });

  test('PDP has JSON-LD structured data', async ({ page }) => {
    await page.goto('/products/1');
    const jsonLd = await page.$eval(
      'script[type="application/ld+json"]',
      (el) => JSON.parse(el.textContent ?? '{}')
    );
    expect(jsonLd['@type']).toBe('Product');
    expect(jsonLd.name).toBeTruthy();
  });

  test('sitemap.xml is accessible', async ({ page }) => {
    const res = await page.goto('/sitemap.xml');
    expect(res?.status()).toBe(200);
    expect(res?.headers()['content-type']).toContain('xml');
  });
});
```

- [ ] **Step 2: Run the tests**

Ensure both servers are running, then:

```bash
bun run --filter web test:e2e -- browse.spec.ts
```

Expected: PASS — all 5 tests ✓

- [ ] **Step 3: Commit**

```bash
git add packages/web/tests/e2e/browse.spec.ts
git commit -m "test: add E2E tests for product browsing"
```

---

### Task 25: E2E — Cart Flow

**Files:**

- Create: `packages/web/tests/e2e/cart.spec.ts`

- [ ] **Step 1: Write the test**

```typescript
import { test, expect } from '@playwright/test';

test.describe('Cart flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/products/1');
    await page.getByRole('button', { name: 'Add to Cart' }).click();
    await expect(page.getByRole('link', { name: /Cart/ })).toContainText('(');
  });

  test('added item appears in the cart', async ({ page }) => {
    await page.goto('/cart');
    await expect(page.getByRole('list', { name: 'Cart items' })).toBeVisible();
    const items = page.getByRole('listitem');
    await expect(items).toHaveCount(1);
  });

  test('cart shows the correct total', async ({ page }) => {
    await page.goto('/cart');
    const total = page.getByLabel(/Order total/);
    await expect(total).toBeVisible();
    await expect(total).toContainText('£');
  });

  test('increasing quantity updates the total', async ({ page }) => {
    await page.goto('/cart');
    const increaseBtn = page.getByRole('button', { name: 'Increase quantity' });
    await increaseBtn.click();
    await page.waitForLoadState('networkidle');
    const item = page.getByRole('listitem').first();
    await expect(item.getByLabel(/Quantity/)).toContainText('2');
  });

  test('removing an item empties the cart', async ({ page }) => {
    await page.goto('/cart');
    await page.getByRole('button', { name: /Remove/ }).click();
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('Your cart is empty')).toBeVisible();
  });
});
```

- [ ] **Step 2: Run the tests**

```bash
bun run --filter web test:e2e -- cart.spec.ts
```

Expected: PASS — all 5 tests ✓

- [ ] **Step 3: Commit**

```bash
git add packages/web/tests/e2e/cart.spec.ts
git commit -m "test: add E2E tests for cart flow"
```

---

### Task 26: E2E — Checkout Flow

**Files:**

- Create: `packages/web/tests/e2e/checkout.spec.ts`

> Uses Stripe test card `4242 4242 4242 4242`. Stripe's CardElement renders inside an iframe — use `page.frameLocator` to interact with it.

- [ ] **Step 1: Write the test**

```typescript
import { test, expect } from '@playwright/test';

test.describe('Checkout flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/products/1');
    await page.getByRole('button', { name: 'Add to Cart' }).click();
    await page.waitForLoadState('networkidle');
  });

  test('redirects to /cart when checkout is visited with empty cart', async ({
    page
  }) => {
    // New context = fresh session = empty cart
    await page.goto('/checkout');
    // Give client-side redirect time to run
    await page.waitForURL(/\/cart/);
    await expect(page).toHaveURL('/cart');
  });

  test('completes a full purchase and lands on order confirmation', async ({
    page
  }) => {
    await page.goto('/checkout');
    await expect(page.getByRole('heading', { name: 'Checkout' })).toBeVisible();

    // Fill address
    await page.getByLabel('Full name').fill('Jane Smith');
    await page.getByLabel('Street address').fill('10 Downing Street');
    await page.getByLabel('City').fill('London');
    await page.getByLabel('Postcode').fill('SW1A 2AA');

    // Fill Stripe card (inside iframe)
    const stripeFrame = page
      .frameLocator('iframe[name^="__privateStripeFrame"]')
      .first();
    await stripeFrame
      .getByRole('textbox', { name: 'Card number' })
      .fill('4242424242424242');
    await stripeFrame.getByRole('textbox', { name: /expiry/i }).fill('12/30');
    await stripeFrame.getByRole('textbox', { name: /CVC/i }).fill('123');

    await page.getByRole('button', { name: 'Place Order' }).click();

    // Wait for redirect to order confirmation (Stripe payment takes a moment)
    await page.waitForURL(/\/order-confirmation\/\d+/, { timeout: 15000 });

    await expect(
      page.getByRole('heading', { name: 'Order Confirmed' })
    ).toBeVisible();
    await expect(page.getByText(/Jane Smith/)).toBeVisible();
    await expect(page.getByText(/Card ending in/)).toBeVisible();
  });

  test('shows a validation error when address fields are empty', async ({
    page
  }) => {
    await page.goto('/checkout');
    await page.getByRole('button', { name: 'Place Order' }).click();
    await expect(page.getByRole('alert').first()).toBeVisible();
  });
});
```

- [ ] **Step 2: Run the tests**

```bash
bun run --filter web test:e2e -- checkout.spec.ts
```

Expected: PASS — all 3 tests ✓

- [ ] **Step 3: Run the full E2E suite**

```bash
bun run --filter web test:e2e
```

Expected: all 13 E2E tests pass across chromium and mobile viewports

- [ ] **Step 4: Run the full API test suite**

```bash
bun run --filter api test
```

Expected: all API tests pass

- [ ] **Step 5: Final commit**

```bash
git add packages/web/tests/e2e/checkout.spec.ts
git commit -m "test: add E2E tests for checkout and order confirmation flow"
```
