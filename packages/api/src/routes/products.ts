import { Router } from 'express';
import { prisma } from '../db/prisma.js';

const router = Router();

router.get('/', async (_req, res, next) => {
  try {
    const products = await prisma.product.findMany({
      select: {
        id: true,
        name: true,
        primary_image: true,
        unit_price: true,
        currency: true
      }
    });

    res.json({
      results: products.map((p) => ({
        ...p,
        unit_price: Number(p.unit_price)
      }))
    });
  } catch (err) {
    next(err);
  }
});

export default router;
