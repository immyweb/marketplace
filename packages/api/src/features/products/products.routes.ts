import { Router } from "express";
import { ProductListQuerySchema } from "@marketplace/core";
import { listProducts, getProductById } from "./products.service.js";

const router = Router();

router.get("/", async (req, res, next) => {
  try {
    const parsed = ProductListQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res
        .status(400)
        .json({ error: parsed.error.errors[0].message, code: "INVALID_INPUT" });
      return;
    }

    const result = await listProducts(parsed.data);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(404).json({ error: "Product not found", code: "NOT_FOUND" });
      return;
    }

    const product = await getProductById(id);
    res.json(product);
  } catch (err) {
    next(err);
  }
});

export default router;
