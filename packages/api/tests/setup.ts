import { afterAll, afterEach, beforeAll } from "vitest";
import { setupServer } from "msw/node";
import { prisma } from "@/shared/db/prisma";
import { resendHandlers } from "./resend-mock";

export const server = setupServer(...resendHandlers);

beforeAll(async () => {
  process.env.DATABASE_URL =
    "postgresql://marketplace:marketplace@localhost:5433/marketplace_test";
  await prisma.$connect();
  server.listen({ onUnhandledRequest: "bypass" });
});

afterEach(() => {
  server.resetHandlers();
});

afterAll(async () => {
  await prisma.$disconnect();
  server.close();
});
