import { prisma } from "@/shared/db/prisma";
import { NotFoundError } from "@/shared/errors";
import { embedText } from "@/shared/embeddings/embeddings.service";
import type { ProductListQuery } from "@marketplace/core";

export type ProductDTO = {
  id: number;
  name: string;
  primary_image: string;
  unit_price: number;
  currency: string;
  category: string;
};

const PAGE_SIZE = 16;

export async function listProducts(query: ProductListQuery): Promise<{
  results: ProductDTO[];
  total: number;
  page: number;
  totalPages: number;
}> {
  const { page, sort, category } = query;
  const where = category ? { category } : undefined;
  const orderBy =
    sort === "category"
      ? [{ category: "asc" as const }, { id: "asc" as const }]
      : sort === "price_asc"
        ? [{ unit_price: "asc" as const }, { id: "asc" as const }]
        : sort === "price_desc"
          ? [{ unit_price: "desc" as const }, { id: "asc" as const }]
          : { id: "asc" as const };

  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy,
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        name: true,
        primary_image: true,
        unit_price: true,
        currency: true,
        category: true,
      },
    }),
    prisma.product.count({ where }),
  ]);

  return {
    results: products.map((p) => ({
      ...p,
      unit_price: Number(p.unit_price),
    })),
    total,
    page,
    totalPages: Math.ceil(total / PAGE_SIZE),
  };
}

type SearchRow = {
  id: number;
  name: string;
  primary_image: string;
  unit_price: string;
  currency: string;
  category: string;
};

export async function searchProducts(q: string): Promise<{
  results: ProductDTO[];
  total: number;
  page: number;
  totalPages: number;
}> {
  const embedding = await embedText(q);
  const vector = `[${embedding.join(",")}]`;

  const rows = await prisma.$queryRaw<SearchRow[]>`
    SELECT id, name, primary_image, unit_price, currency, category
    FROM products
    WHERE embedding IS NOT NULL
    ORDER BY embedding <=> ${vector}::vector
    LIMIT ${PAGE_SIZE}
  `;

  return {
    results: rows.map((row) => ({
      ...row,
      unit_price: Number(row.unit_price),
    })),
    total: rows.length,
    page: 1,
    totalPages: 1,
  };
}

export async function getProductById(id: number) {
  const product = await prisma.product.findUnique({ where: { id } });

  if (!product) {
    throw new NotFoundError("Product not found");
  }

  return { ...product, unit_price: Number(product.unit_price) };
}
