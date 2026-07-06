import "dotenv/config";
import express from "express";
import cors from "cors";
import { sessionMiddleware } from "./shared/middleware/session.js";
import { errorHandler } from "./shared/middleware/error.js";
import { productsRouter } from "./features/products/index.js";
import { cartRouter } from "./features/cart/index.js";
import { checkoutRouter } from "./features/checkout/index.js";
import { ordersRouter } from "./features/orders/index.js";

export const app = express();

app.use(cors({ origin: "http://localhost:3000", credentials: true }));
app.use(express.json());
app.use(sessionMiddleware);

app.get("/health", (_req, res) => res.json({ status: "ok" }));

app.use("/products", productsRouter);
app.use("/cart", cartRouter);
app.use("/checkout", checkoutRouter);
app.use("/order", ordersRouter);

app.use(errorHandler);
