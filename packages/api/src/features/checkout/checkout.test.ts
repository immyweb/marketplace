import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { agent } from "supertest";
import { app } from "@/app";
import { prisma } from "@/shared/db/prisma";

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

  it("returns 400 when cartId is missing from the request body", async () => {
    const ag = agent(app);
    await signUpAgent(ag);

    const res = await ag.post("/checkout/payment-intent").send({}).expect(400);

    expect(res.body).toMatchObject({ code: "INVALID_INPUT" });
  });
});
