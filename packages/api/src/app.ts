import "dotenv/config";
import express from "express";
import cors from "cors";
import { sessionMiddleware } from "./shared/middleware/session";
import { errorHandler } from "./shared/middleware/error";
import { productsRouter } from "./features/products";
import { cartRouter } from "./features/cart";
import { checkoutRouter } from "./features/checkout";
import { ordersRouter } from "./features/orders";

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
