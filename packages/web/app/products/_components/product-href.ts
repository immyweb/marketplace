interface ProductsHrefParams {
  page?: number;
  sort?: string;
  category?: string;
  q?: string;
}

export function buildProductsHref({
  page,
  sort,
  category,
  q,
}: ProductsHrefParams) {
  const params = new URLSearchParams();
  if (q) {
    params.set("q", q);
  } else {
    if (page && page > 1) params.set("page", String(page));
    if (sort) params.set("sort", sort);
    if (category) params.set("category", category);
  }
  const qs = params.toString();
  return qs ? `/?${qs}` : "/";
}
