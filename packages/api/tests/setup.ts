import { afterAll, beforeAll } from "vitest";
import { prisma } from "../src/shared/db/prisma.js";

beforeAll(async () => {
  process.env.DATABASE_URL =
    "postgresql://marketplace:marketplace@localhost:5433/marketplace_test";
  await prisma.$connect();
});

afterAll(async () => {
  await prisma.$disconnect();
});
