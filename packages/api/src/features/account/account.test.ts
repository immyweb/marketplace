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

beforeEach(async () => {
  await prisma.session.deleteMany();
  await prisma.account.deleteMany();
  await prisma.user.deleteMany();
});

afterAll(async () => {
  await prisma.session.deleteMany();
  await prisma.account.deleteMany();
  await prisma.user.deleteMany();
});

describe("GET /account/address", () => {
  it("returns null when the user has no saved address", async () => {
    const ag = agent(app);
    await signUpAgent(ag);

    const res = await ag.get("/account/address").expect(200);

    expect(res.body).toBeNull();
  });

  it("returns the saved address when one exists", async () => {
    const ag = agent(app);
    await signUpAgent(ag);
    const user = await prisma.user.findUniqueOrThrow({
      where: { email: "jane@example.com" },
    });
    await prisma.user.update({
      where: { id: user.id },
      data: {
        addressName: "Jane Smith",
        addressStreet: "10 Downing Street",
        addressCity: "London",
        addressPostcode: "SW1A 2AA",
      },
    });

    const res = await ag.get("/account/address").expect(200);

    expect(res.body).toEqual({
      name: "Jane Smith",
      street: "10 Downing Street",
      city: "London",
      postcode: "SW1A 2AA",
    });
  });

  it("returns 403 when signed out", async () => {
    const res = await agent(app).get("/account/address").expect(403);

    expect(res.body).toMatchObject({ error: expect.any(String) });
  });
});
