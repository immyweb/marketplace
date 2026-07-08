import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { agent } from "supertest";
import { http, HttpResponse } from "msw";
import { app } from "@/app";
import { prisma } from "@/shared/db/prisma";
import { stripe } from "@/shared/stripe";
import { server } from "../../../tests/setup";

async function createConfirmedPaymentIntent(amountGbp: number) {
  const pi = await stripe.paymentIntents.create({
    amount: Math.round(amountGbp * 100),
    currency: "gbp",
    automatic_payment_methods: { enabled: true, allow_redirects: "never" },
    payment_method: "pm_card_visa",
    confirm: true,
  });
  return pi;
}

async function signUpAgent(
  ag: ReturnType<typeof agent>,
  email = "jane@example.com",
) {
  await ag.post("/api/auth/sign-up/email").send({
    name: "Jane Smith",
    email,
    password: "password123",
  });
  return ag;
}

let productId: number;

beforeEach(async () => {
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.cartItem.deleteMany();
  await prisma.cart.deleteMany();
  await prisma.product.deleteMany();
  await prisma.session.deleteMany();
  await prisma.account.deleteMany();
  await prisma.user.deleteMany();

  const product = await prisma.product.create({
    data: {
      name: "Test Product",
      description: "desc",
      primary_image: "img.jpg",
      image_urls: [],
      unit_price: 15.0,
      currency: "GBP",
    },
  });
  productId = product.id;
});

afterAll(async () => {
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.cartItem.deleteMany();
  await prisma.cart.deleteMany();
  await prisma.product.deleteMany();
  await prisma.session.deleteMany();
  await prisma.account.deleteMany();
  await prisma.user.deleteMany();
});

describe("POST /order", () => {
  it("creates an order from a confirmed payment intent, linked to the signed-in user", async () => {
    const ag = agent(app);
    await ag.post("/cart/products").send({ productId, quantity: 2 });
    const cartRes = await ag.get("/cart");
    const cartId = cartRes.body.id;
    await signUpAgent(ag);

    const pi = await createConfirmedPaymentIntent(30);

    const res = await ag
      .post("/order")
      .send({
        cartId,
        paymentIntentId: pi.id,
        address_details: {
          name: "Jane Smith",
          street: "10 Downing Street",
          city: "London",
          postcode: "SW1A 2AA",
        },
      })
      .expect(201);

    expect(res.body).toMatchObject({
      total_price: 30,
      currency: "GBP",
      status: "confirmed",
      address_details: { name: "Jane Smith", city: "London" },
    });
    expect(res.body.payment_details.card_last_four_digits).toHaveLength(4);
    expect(res.body.items).toHaveLength(1);

    // Cart should be cleared after order
    const cartAfter = await ag.get("/cart");
    expect(cartAfter.body.items).toHaveLength(0);

    const orderInDb = await prisma.order.findUniqueOrThrow({
      where: { id: res.body.id },
    });
    const user = await prisma.user.findUniqueOrThrow({
      where: { email: "jane@example.com" },
    });
    expect(orderInDb.user_id).toBe(user.id);
  });

  it("sends an order confirmation email to the signed-in user", async () => {
    let capturedRequest: { to: string; subject: string } | null = null;
    server.use(
      http.post("https://api.resend.com/emails", async ({ request }) => {
        capturedRequest = (await request.json()) as {
          to: string;
          subject: string;
        };
        return HttpResponse.json({ id: "email_test_id" });
      }),
    );

    const ag = agent(app);
    await ag.post("/cart/products").send({ productId, quantity: 1 });
    const cartRes = await ag.get("/cart");
    const cartId = cartRes.body.id;
    await signUpAgent(ag);

    const pi = await createConfirmedPaymentIntent(15);

    const res = await ag
      .post("/order")
      .send({
        cartId,
        paymentIntentId: pi.id,
        address_details: {
          name: "Jane Smith",
          street: "10 Downing Street",
          city: "London",
          postcode: "SW1A 2AA",
        },
      })
      .expect(201);

    expect(capturedRequest).toMatchObject({
      to: "jane@example.com",
      subject: `Order Confirmation — #${res.body.id}`,
    });
  });

  it("still creates the order and returns 201 when the confirmation email fails to send", async () => {
    server.use(
      http.post("https://api.resend.com/emails", () => {
        return HttpResponse.json(
          { message: "rate limit exceeded", name: "rate_limit_exceeded" },
          { status: 429 },
        );
      }),
    );

    const ag = agent(app);
    await ag.post("/cart/products").send({ productId, quantity: 1 });
    const cartRes = await ag.get("/cart");
    const cartId = cartRes.body.id;
    await signUpAgent(ag);

    const pi = await createConfirmedPaymentIntent(15);

    const res = await ag
      .post("/order")
      .send({
        cartId,
        paymentIntentId: pi.id,
        address_details: {
          name: "Jane Smith",
          street: "10 Downing Street",
          city: "London",
          postcode: "SW1A 2AA",
        },
      })
      .expect(201);

    expect(res.body.total_price).toBe(15);
  });

  it("returns 403 when placing an order without signing in", async () => {
    const ag = agent(app);
    await ag.post("/cart/products").send({ productId, quantity: 1 });
    const cartRes = await ag.get("/cart");

    const res = await ag
      .post("/order")
      .send({
        cartId: cartRes.body.id,
        paymentIntentId: "pi_test",
        address_details: {
          name: "Jane",
          street: "1 St",
          city: "London",
          postcode: "SW1A 1AA",
        },
      })
      .expect(403);

    expect(res.body).toMatchObject({ error: expect.any(String) });
  });

  it("returns 400 when paymentIntentId does not exist or is not succeeded", async () => {
    const ag = agent(app);
    await ag.post("/cart/products").send({ productId, quantity: 1 });
    const cartRes = await ag.get("/cart");
    await signUpAgent(ag);

    const res = await ag
      .post("/order")
      .send({
        cartId: cartRes.body.id,
        paymentIntentId: "pi_fake_id",
        address_details: {
          name: "Jane",
          street: "1 St",
          city: "London",
          postcode: "SW1A 1AA",
        },
      })
      .expect(400);

    expect(res.body).toMatchObject({ error: expect.any(String) });
  });

  it("returns 403 when cartId does not belong to the session", async () => {
    // Session A creates a cart
    const agentA = agent(app);
    await agentA.post("/cart/products").send({ productId, quantity: 1 });
    const cartRes = await agentA.get("/cart");
    const cartId = cartRes.body.id;

    // Session B (signed in as a different user) tries to place an order on session A's cart
    const agentB = agent(app);
    await signUpAgent(agentB, "other@example.com");
    const res = await agentB
      .post("/order")
      .send({
        cartId,
        paymentIntentId: "pi_test",
        address_details: {
          name: "X",
          street: "Y",
          city: "Z",
          postcode: "ZZ1 1ZZ",
        },
      })
      .expect(403);

    expect(res.body).toMatchObject({ error: expect.any(String) });
  });

  it("returns 400 when the payment intent amount does not match the cart total", async () => {
    const ag = agent(app);
    // Cart total is 2 x £15.00 = £30.00
    await ag.post("/cart/products").send({ productId, quantity: 2 });
    const cartRes = await ag.get("/cart");
    const cartId = cartRes.body.id;
    await signUpAgent(ag);

    // Simulates the product's price changing (or a stale client-supplied
    // amount) between payment-intent creation and order placement: the
    // payment intent was only confirmed for £20.00.
    const pi = await createConfirmedPaymentIntent(20);

    const res = await ag
      .post("/order")
      .send({
        cartId,
        paymentIntentId: pi.id,
        address_details: {
          name: "Jane Smith",
          street: "10 Downing Street",
          city: "London",
          postcode: "SW1A 2AA",
        },
      })
      .expect(400);

    expect(res.body).toMatchObject({
      error: expect.any(String),
      code: "PAYMENT_FAILED",
    });

    // No order should have been created, and the cart must survive so the
    // customer isn't left with a charge and no way to retry.
    expect(await prisma.order.findMany()).toHaveLength(0);
    const cartAfter = await ag.get("/cart");
    expect(cartAfter.body.items).toHaveLength(1);
  });
});

describe("GET /order/:id", () => {
  it("returns the order with items, address and payment details", async () => {
    const ag = agent(app);
    await signUpAgent(ag);
    const user = await prisma.user.findUniqueOrThrow({
      where: { email: "jane@example.com" },
    });
    const order = await prisma.order.create({
      data: {
        total_price: 30,
        stripe_payment_id: "pi_test_get_order",
        card_last_four: "4242",
        address_name: "Jane Smith",
        address_street: "10 Downing Street",
        address_city: "London",
        address_postcode: "SW1A 2AA",
        user_id: user.id,
        items: {
          create: [{ product_id: productId, quantity: 2, price: 30 }],
        },
      },
    });

    const res = await ag.get(`/order/${order.id}`).expect(200);

    expect(res.body).toMatchObject({
      id: order.id,
      total_price: 30,
      currency: "GBP",
      status: "confirmed",
      address_details: {
        name: "Jane Smith",
        street: "10 Downing Street",
        city: "London",
        postcode: "SW1A 2AA",
      },
      payment_details: { card_last_four_digits: "4242" },
    });
    expect(res.body.items).toEqual([
      {
        quantity: 2,
        price: 30,
        currency: "GBP",
        product: {
          id: productId,
          name: "Test Product",
          primary_image: "img.jpg",
        },
      },
    ]);
  });

  it("returns 403 for a signed-out request", async () => {
    const owner = await prisma.user.create({
      data: {
        id: "owner-1",
        name: "Owner",
        email: "owner1@example.com",
        emailVerified: true,
      },
    });
    const order = await prisma.order.create({
      data: {
        total_price: 30,
        stripe_payment_id: "pi_owner_1",
        card_last_four: "4242",
        address_name: "Owner",
        address_street: "1 St",
        address_city: "London",
        address_postcode: "SW1A 1AA",
        user_id: owner.id,
        items: { create: [{ product_id: productId, quantity: 1, price: 30 }] },
      },
    });

    const res = await agent(app).get(`/order/${order.id}`).expect(403);

    expect(res.body).toMatchObject({ error: expect.any(String) });
  });

  it("returns 404 when the order belongs to a different user", async () => {
    const owner = await prisma.user.create({
      data: {
        id: "owner-2",
        name: "Owner",
        email: "owner2@example.com",
        emailVerified: true,
      },
    });
    const order = await prisma.order.create({
      data: {
        total_price: 30,
        stripe_payment_id: "pi_owner_2",
        card_last_four: "4242",
        address_name: "Owner",
        address_street: "1 St",
        address_city: "London",
        address_postcode: "SW1A 1AA",
        user_id: owner.id,
        items: { create: [{ product_id: productId, quantity: 1, price: 30 }] },
      },
    });

    const ag = agent(app);
    await signUpAgent(ag, "someone-else@example.com");
    const res = await ag.get(`/order/${order.id}`).expect(404);

    expect(res.body).toMatchObject({ error: expect.any(String) });
  });

  it("returns 404 for an order id that does not exist", async () => {
    const ag = agent(app);
    await signUpAgent(ag);
    const res = await ag.get("/order/999999").expect(404);

    expect(res.body).toMatchObject({ error: expect.any(String) });
  });

  it("returns 404 for a non-numeric order id", async () => {
    const ag = agent(app);
    await signUpAgent(ag);
    const res = await ag.get("/order/not-a-number").expect(404);

    expect(res.body).toMatchObject({ error: expect.any(String) });
  });
});

describe("GET /order", () => {
  it("returns the signed-in user's orders, newest first, with summary fields", async () => {
    const ag = agent(app);
    await signUpAgent(ag);
    const user = await prisma.user.findUniqueOrThrow({
      where: { email: "jane@example.com" },
    });

    const older = await prisma.order.create({
      data: {
        total_price: 15,
        stripe_payment_id: "pi_list_1",
        card_last_four: "4242",
        address_name: "Jane",
        address_street: "1 St",
        address_city: "London",
        address_postcode: "SW1A 1AA",
        user_id: user.id,
        created_at: new Date("2026-01-01T00:00:00.000Z"),
        items: { create: [{ product_id: productId, quantity: 1, price: 15 }] },
      },
    });
    const newer = await prisma.order.create({
      data: {
        total_price: 30,
        stripe_payment_id: "pi_list_2",
        card_last_four: "4242",
        address_name: "Jane",
        address_street: "1 St",
        address_city: "London",
        address_postcode: "SW1A 1AA",
        user_id: user.id,
        created_at: new Date("2026-02-01T00:00:00.000Z"),
        items: {
          create: [
            { product_id: productId, quantity: 1, price: 15 },
            { product_id: productId, quantity: 1, price: 15 },
          ],
        },
      },
    });

    const res = await ag.get("/order").expect(200);

    expect(res.body).toEqual([
      {
        id: newer.id,
        created_at: newer.created_at.toISOString(),
        status: "confirmed",
        total_price: 30,
        currency: "GBP",
        item_count: 2,
      },
      {
        id: older.id,
        created_at: older.created_at.toISOString(),
        status: "confirmed",
        total_price: 15,
        currency: "GBP",
        item_count: 1,
      },
    ]);
  });

  it("does not include another user's orders", async () => {
    const owner = await prisma.user.create({
      data: {
        id: "owner-3",
        name: "Owner",
        email: "owner3@example.com",
        emailVerified: true,
      },
    });
    await prisma.order.create({
      data: {
        total_price: 10,
        stripe_payment_id: "pi_other_user",
        card_last_four: "4242",
        address_name: "Owner",
        address_street: "1 St",
        address_city: "London",
        address_postcode: "SW1A 1AA",
        user_id: owner.id,
        items: { create: [{ product_id: productId, quantity: 1, price: 10 }] },
      },
    });

    const ag = agent(app);
    await signUpAgent(ag, "self@example.com");

    const res = await ag.get("/order").expect(200);

    expect(res.body).toEqual([]);
  });

  it("returns an empty array when the user has no orders", async () => {
    const ag = agent(app);
    await signUpAgent(ag);

    const res = await ag.get("/order").expect(200);

    expect(res.body).toEqual([]);
  });

  it("returns 403 when listing orders without signing in", async () => {
    const res = await agent(app).get("/order").expect(403);

    expect(res.body).toMatchObject({ error: expect.any(String) });
  });
});

describe("POST /checkout/payment-intent", () => {
  it("creates a Stripe PaymentIntent and returns clientSecret", async () => {
    const ag = agent(app);
    await ag.post("/cart/products").send({ productId, quantity: 2 });
    const cartRes = await ag.get("/cart");
    const cartId = cartRes.body.id;
    await signUpAgent(ag);

    const res = await ag
      .post("/checkout/payment-intent")
      .send({ cartId })
      .expect(200);

    expect(res.body.clientSecret).toMatch(/^pi_.*_secret_.*/);
    expect(res.body.amount).toBe(30); // 15.00 × 2
  });

  it("returns 403 when creating a payment intent without signing in", async () => {
    const ag = agent(app);
    await ag.post("/cart/products").send({ productId, quantity: 1 });
    const cartRes = await ag.get("/cart");
    const cartId = cartRes.body.id;

    await ag.post("/checkout/payment-intent").send({ cartId }).expect(403);
  });

  it("returns 404 when cart is empty or does not exist", async () => {
    // Create a cart and register it in the session, then empty it so the
    // ownership check passes but the "not found or empty" guard fires.
    const ag = agent(app);
    await ag.post("/cart/products").send({ productId, quantity: 1 });
    const cartRes = await ag.get("/cart");
    const cartId = cartRes.body.id;
    await prisma.cartItem.deleteMany({ where: { cart_id: cartId } });
    await signUpAgent(ag);

    await ag.post("/checkout/payment-intent").send({ cartId }).expect(404);
  });

  it("returns 403 when cartId does not belong to the session", async () => {
    // Session A creates a cart
    const agentA = agent(app);
    await agentA.post("/cart/products").send({ productId, quantity: 1 });
    const cartRes = await agentA.get("/cart");
    const cartId = cartRes.body.id;

    // Session B (signed in as a different user) tries to create a payment
    // intent for session A's cart
    const agentB = agent(app);
    await signUpAgent(agentB, "other@example.com");
    const res = await agentB
      .post("/checkout/payment-intent")
      .send({ cartId })
      .expect(403);

    expect(res.body).toMatchObject({ error: expect.any(String) });
  });
});
