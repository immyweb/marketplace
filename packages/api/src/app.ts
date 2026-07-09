import "dotenv/config";
import express from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import { toNodeHandler } from "better-auth/node";
import { auth } from "@/shared/auth";
import { logger } from "@/shared/logger";
import { sessionMiddleware } from "@/shared/middleware/session";
import { errorHandler } from "@/shared/middleware/error";
import { productsRouter } from "@/features/products";
import { cartRouter } from "@/features/cart";
import { checkoutRouter } from "@/features/checkout";
import { ordersRouter } from "@/features/orders";
import { accountRouter } from "@/features/account";

export const app = express();

app.use(
  pinoHttp({
    logger,
    redact: {
      paths: [
        "req.headers.cookie",
        "req.headers.authorization",
        "res.headers['set-cookie']",
      ],
    },
  }),
);

app.use(cors({ origin: "http://localhost:3000", credentials: true }));

// Better Auth's handler must run before express.json() parses the body,
// or its client hangs on "pending".
app.all("/api/auth/*splat", toNodeHandler(auth));

app.use(express.json());
app.use(sessionMiddleware);

app.get("/health", (_req, res) => res.json({ status: "ok" }));

app.use("/products", productsRouter);
app.use("/cart", cartRouter);
app.use("/checkout", checkoutRouter);
app.use("/order", ordersRouter);
app.use("/account", accountRouter);

app.use(errorHandler);
