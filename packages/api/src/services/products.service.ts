import { prisma } from "../db/prisma.js";
import { NotFoundError } from "../errors.js";

export type ProductDTO = {
  id: number;
  name: string;
  primary_image: string;
  unit_price: number;
  currency: string;
};

export async function listProducts(): Promise<ProductDTO[]> {
  const products = await prisma.product.findMany({
    select: {
      id: true,
      name: true,
      primary_image: true,
      unit_price: true,
      currency: true,
    },
  });

  return products.map((p) => ({ ...p, unit_price: Number(p.unit_price) }));
}

export async function getProductById(id: number) {
  const product = await prisma.product.findUnique({ where: { id } });

  if (!product) {
    throw new NotFoundError("Product not found");
  }

  return { ...product, unit_price: Number(product.unit_price) };
}
