import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import { logger } from "@/shared/logger";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  pgPool?: pg.Pool;
};

// Shared with the session store (shared/middleware/session.ts) so the app
// opens one Postgres connection pool, not two.
export const pool =
  globalForPrisma.pgPool ??
  new pg.Pool({ connectionString: process.env.DATABASE_URL });

if (!globalForPrisma.pgPool) {
  pool.on("error", (err) => {
    logger.error({ err }, "Postgres pool error");
  });
}

function createPrismaClient() {
  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
  globalForPrisma.pgPool = pool;
}
