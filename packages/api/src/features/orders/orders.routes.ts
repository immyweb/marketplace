import { Router } from "express";
import { PlaceOrderSchema } from "@marketplace/core";
import { ForbiddenError } from "@/shared/errors";
import { requireAuth } from "@/shared/middleware/require-auth";
import { placeOrder, getOrderById, listOrdersByUser } from "./orders.service";

const router = Router();

router.get("/", requireAuth, async (req, res, next) => {
  try {
    const orders = await listOrdersByUser(req.userId!);
    res.json(orders);
  } catch (err) {
    next(err);
  }
});

router.post("/", requireAuth, async (req, res, next) => {
  try {
    const parsed = PlaceOrderSchema.safeParse(req.body);
    if (!parsed.success) {
      res
        .status(400)
        .json({ error: parsed.error.errors[0].message, code: "INVALID_INPUT" });
      return;
    }
    const { cartId, paymentIntentId, address_details, saveAddress } =
      parsed.data;

    // Ensure the cart belongs to the current session to prevent IDOR
    if (cartId !== req.session.cartId) {
      throw new ForbiddenError("Cart does not belong to this session");
    }

    const order = await placeOrder({
      cartId,
      paymentIntentId,
      addressDetails: address_details,
      saveAddress,
      userId: req.userId!,
    });

    req.session.cartId = undefined;
    res.status(201).json(order);
  } catch (err) {
    next(err);
  }
});

router.get<{ id: string }>("/:id", requireAuth, async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(404).json({ error: "Order not found", code: "NOT_FOUND" });
      return;
    }

    const order = await getOrderById(id, req.userId!);
    res.json(order);
  } catch (err) {
    next(err);
  }
});

export default router;
