import { Router } from "express";
import { AddressSchema } from "@marketplace/core";
import { requireAuth } from "@/shared/middleware/require-auth";
import { getSavedAddress, saveAddress } from "./account.service";

const router = Router();

router.get("/address", requireAuth, async (req, res, next) => {
  try {
    const address = await getSavedAddress(req.userId!);
    res.json(address);
  } catch (err) {
    next(err);
  }
});

router.put("/address", requireAuth, async (req, res, next) => {
  try {
    const parsed = AddressSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: parsed.error.errors[0].message,
        code: "INVALID_INPUT",
      });
      return;
    }

    const address = await saveAddress(req.userId!, parsed.data);
    res.json(address);
  } catch (err) {
    next(err);
  }
});

export default router;
