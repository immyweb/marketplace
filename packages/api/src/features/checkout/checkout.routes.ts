import { Router } from "express";
import { ForbiddenError } from "../../shared/errors";
import { createPaymentIntent } from "./checkout.service";

const router = Router();

router.post("/payment-intent", async (req, res, next) => {
  try {
    const { cartId } = req.body as { cartId?: unknown };

    if (typeof cartId !== "number") {
      res
        .status(400)
        .json({ error: "cartId is required", code: "INVALID_INPUT" });
      return;
    }

    if (cartId !== req.session.cartId) {
      throw new ForbiddenError("Cart does not belong to this session");
    }

    const result = await createPaymentIntent(cartId);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
