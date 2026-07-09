import { Router } from "express";
import { requireAuth } from "@/shared/middleware/require-auth";
import { getSavedAddress } from "./account.service";

const router = Router();

router.get("/address", requireAuth, async (req, res, next) => {
  try {
    const address = await getSavedAddress(req.userId!);
    res.json(address);
  } catch (err) {
    next(err);
  }
});

export default router;
