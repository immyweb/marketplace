import "dotenv/config";
import express from "express";
import cors from "cors";
import { sessionMiddleware } from "./middleware/session.js";
import { errorHandler } from "./middleware/error.js";
import productsRouter from "./routes/products.js";
import cartRouter from "./routes/cart.js";
import checkoutRouter from "./routes/checkout.js";
import ordersRouter from "./routes/orders.js";

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
