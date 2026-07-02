import { Router } from "express";
import { listProducts, getProductById } from "../services/products.service.js";

const router = Router();

router.get("/", async (_req, res, next) => {
  try {
    const results = await listProducts();
    res.json({ results });
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
