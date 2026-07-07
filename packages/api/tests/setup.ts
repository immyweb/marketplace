import { afterAll, beforeAll } from "vitest";
import { prisma } from "@/shared/db/prisma";

beforeAll(async () => {
  process.env.DATABASE_URL =
    "postgresql://marketplace:marketplace@localhost:5433/marketplace_test";
  await prisma.$connect();
});

afterAll(async () => {
  await prisma.$disconnect();
});
