import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { agent } from "supertest";
import Stripe from "stripe";
import { app } from "@/app";
import { prisma } from "@/shared/db/prisma";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

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
    const user = await prisma.user.create({
      data: {
        id: "test-user-1",
        name: "Jane Smith",
        email: "jane@example.com",
        emailVerified: true,
      },
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

    const res = await agent(app).get(`/order/${order.id}`).expect(200);

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

  it("returns 404 for an order id that does not exist", async () => {
    const res = await agent(app).get("/order/999999").expect(404);

    expect(res.body).toMatchObject({ error: expect.any(String) });
  });

  it("returns 404 for a non-numeric order id", async () => {
    const res = await agent(app).get("/order/not-a-number").expect(404);

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
