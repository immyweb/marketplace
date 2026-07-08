export const PRODUCT_CATEGORIES = [
  "Tops",
  "Trousers",
  "Knitwear",
  "Outerwear",
  "Footwear",
  "Accessories",
] as const;

export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number];

export interface Product {
  id: number;
  name: string;
  description: string;
  primary_image: string;
  image_urls: string[];
  unit_price: number;
  currency: string;
  category: ProductCategory;
}
