import { Router } from "express";
import { PlaceOrderSchema } from "@marketplace/core";
import { ForbiddenError } from "../../shared/errors.js";
import { placeOrder, getOrderById } from "./orders.service.js";

const router = Router();

router.post("/", async (req, res, next) => {
  try {
    const parsed = PlaceOrderSchema.safeParse(req.body);
    if (!parsed.success) {
      res
        .status(400)
        .json({ error: parsed.error.errors[0].message, code: "INVALID_INPUT" });
      return;
    }
    const { cartId, paymentIntentId, address_details } = parsed.data;

    // Ensure the cart belongs to the current session to prevent IDOR
    if (cartId !== req.session.cartId) {
      throw new ForbiddenError("Cart does not belong to this session");
    }

    const order = await placeOrder({
      cartId,
      paymentIntentId,
      addressDetails: address_details,
    });

    req.session.cartId = undefined;
    res.status(201).json(order);
  } catch (err) {
    next(err);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(404).json({ error: "Order not found", code: "NOT_FOUND" });
      return;
    }

    const order = await getOrderById(id);
    res.json(order);
  } catch (err) {
    next(err);
  }
});

export default router;
