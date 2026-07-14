import { z } from "zod";
import { PRODUCT_CATEGORIES } from "./types";

export const ProductListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  sort: z.enum(["category", "price_asc", "price_desc"]).optional(),
  category: z.enum(PRODUCT_CATEGORIES).optional(),
  q: z.string().min(1).optional(),
});

export type ProductListQuery = z.infer<typeof ProductListQuerySchema>;
