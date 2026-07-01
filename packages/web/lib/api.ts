import type { Cart, Order, Product } from '@marketplace/core';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...init?.headers }
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: 'Request failed' }));
    throw Object.assign(new Error(body.error ?? 'Request failed'), {
      code: body.code,
      status: res.status
    });
  }

  return res.json() as Promise<T>;
}

export function fetchProducts() {
  return apiFetch<{ results: Omit<Product, 'description' | 'image_urls'>[] }>(
    '/products'
  );
}

export function fetchProduct(id: number) {
  return apiFetch<Product>(`/products/${id}`);
}

export function fetchCart() {
  return apiFetch<Cart>('/cart');
}

export function addToCart(productId: number, quantity: number) {
  return apiFetch<Cart>('/cart/products', {
    method: 'POST',
    body: JSON.stringify({ productId, quantity })
  });
}

export function updateCartItem(productId: number, quantity: number) {
  return apiFetch<Cart>(`/cart/products/${productId}`, {
    method: 'PUT',
    body: JSON.stringify({ quantity })
  });
}

export function removeFromCart(productId: number) {
  return apiFetch<Cart>(`/cart/products/${productId}`, { method: 'DELETE' });
}

export function createPaymentIntent(cartId: number) {
  return apiFetch<{ clientSecret: string; amount: number }>(
    '/checkout/payment-intent',
    {
      method: 'POST',
      body: JSON.stringify({ cartId })
    }
  );
}

export function placeOrder(body: {
  cartId: number;
  paymentIntentId: string;
  address_details: {
    name: string;
    street: string;
    city: string;
    postcode: string;
  };
}) {
  return apiFetch<Order>('/order', {
    method: 'POST',
    body: JSON.stringify(body)
  });
}
