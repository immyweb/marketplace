import { Router } from "express";
import { AddToCartSchema, UpdateCartItemSchema } from "@marketplace/core";
import {
  findCartById,
  addProductToCart,
  updateCartItemQuantity,
  removeCartItem,
} from "./cart.service.js";

const router = Router();

const EMPTY_CART = { id: null, items: [], total_price: 0, currency: "GBP" };

router.get("/", async (req, res, next) => {
  try {
    if (!req.session.cartId) {
      res.json(EMPTY_CART);
      return;
    }

    const cart = await findCartById(req.session.cartId);

    if (!cart) {
      req.session.cartId = undefined;
      res.json(EMPTY_CART);
      return;
    }

    res.json(cart);
  } catch (err) {
    next(err);
  }
});

router.post("/products", async (req, res, next) => {
  try {
    const parsed = AddToCartSchema.safeParse(req.body);
    if (!parsed.success) {
      res
        .status(400)
        .json({ error: parsed.error.errors[0].message, code: "INVALID_INPUT" });
      return;
    }
    const { productId, quantity } = parsed.data;

    const result = await addProductToCart(
      req.session.cartId ?? null,
      req.session.id,
      productId,
      quantity,
    );

    req.session.cartId = result.cartId;
    res.json(result.cart);
  } catch (err) {
    next(err);
  }
});

router.put("/products/:productId", async (req, res, next) => {
  try {
    const productId = parseInt(req.params.productId, 10);
    const parsed = UpdateCartItemSchema.safeParse(req.body);

    if (isNaN(productId) || !parsed.success) {
      res.status(400).json({
        error: parsed.success
          ? "Invalid productId"
          : parsed.error.errors[0].message,
        code: "INVALID_INPUT",
      });
      return;
    }

    const cart = await updateCartItemQuantity(
      req.session.cartId ?? null,
      productId,
      parsed.data.quantity,
    );

    res.json(cart);
  } catch (err) {
    next(err);
  }
});

router.delete("/products/:productId", async (req, res, next) => {
  try {
    const productId = parseInt(req.params.productId, 10);

    if (isNaN(productId)) {
      res
        .status(400)
        .json({ error: "Invalid productId", code: "INVALID_INPUT" });
      return;
    }

    const cart = await removeCartItem(req.session.cartId ?? null, productId);
    res.json(cart);
  } catch (err) {
    next(err);
  }
});

export default router;
