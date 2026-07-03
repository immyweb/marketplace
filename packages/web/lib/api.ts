import type { AddressDetails, Cart, Order, Product } from "@marketplace/core";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export class ApiRequestError extends Error {
  code?: string;
  status: number;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...init?.headers },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: "Request failed" }));
    throw new ApiRequestError(
      body.error ?? "Request failed",
      res.status,
      body.code,
    );
  }

  return res.json() as Promise<T>;
}

export function fetchProducts(params?: {
  page?: number;
  sort?: string;
  category?: string;
}) {
  const qs = new URLSearchParams();
  if (params?.page) qs.set("page", String(params.page));
  if (params?.sort) qs.set("sort", params.sort);
  if (params?.category) qs.set("category", params.category);
  const query = qs.toString();

  return apiFetch<{
    results: Omit<Product, "description" | "image_urls">[];
    total: number;
    page: number;
    totalPages: number;
  }>(`/products${query ? `?${query}` : ""}`);
}

export function fetchProduct(id: number) {
  return apiFetch<Product>(`/products/${id}`);
}

export function fetchCart(init?: RequestInit) {
  return apiFetch<Cart>("/cart", init);
}

export function addToCart(productId: number, quantity: number) {
  return apiFetch<Cart>("/cart/products", {
    method: "POST",
    body: JSON.stringify({ productId, quantity }),
  });
}

export function updateCartItem(productId: number, quantity: number) {
  return apiFetch<Cart>(`/cart/products/${productId}`, {
    method: "PUT",
    body: JSON.stringify({ quantity }),
  });
}

export function removeFromCart(productId: number) {
  return apiFetch<Cart>(`/cart/products/${productId}`, { method: "DELETE" });
}

export function createPaymentIntent(cartId: number) {
  return apiFetch<{ clientSecret: string; amount: number }>(
    "/checkout/payment-intent",
    {
      method: "POST",
      body: JSON.stringify({ cartId }),
    },
  );
}

export function placeOrder(body: {
  cartId: number;
  paymentIntentId: string;
  address_details: AddressDetails;
}) {
  return apiFetch<Order>("/order", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function fetchOrder(id: number) {
  return apiFetch<Order>(`/order/${id}`);
}
