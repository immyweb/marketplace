import { Router } from "express";
import { prisma } from "../db/prisma.js";

const router = Router();

router.get("/", async (_req, res, next) => {
  try {
    const products = await prisma.product.findMany({
      select: {
        id: true,
        name: true,
        primary_image: true,
        unit_price: true,
        currency: true,
      },
    });

    res.json({
      results: products.map((p) => ({
        ...p,
        unit_price: Number(p.unit_price),
      })),
    });
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

    const product = await prisma.product.findUnique({ where: { id } });

    if (!product) {
      res.status(404).json({ error: "Product not found", code: "NOT_FOUND" });
      return;
    }

    res.json({ ...product, unit_price: Number(product.unit_price) });
  } catch (err) {
    next(err);
  }
});

export default router;
