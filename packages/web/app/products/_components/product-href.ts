interface ProductsHrefParams {
  page?: number;
  sort?: string;
  category?: string;
}

export function buildProductsHref({
  page,
  sort,
  category,
}: ProductsHrefParams) {
  const params = new URLSearchParams();
  if (page && page > 1) params.set("page", String(page));
  if (sort) params.set("sort", sort);
  if (category) params.set("category", category);
  const qs = params.toString();
  return qs ? `/?${qs}` : "/";
}
