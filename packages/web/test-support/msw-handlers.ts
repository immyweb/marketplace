import { http, HttpResponse } from "msw";

const API_URL = "http://localhost:3001";

export const product = {
  id: 1,
  name: "Classic White T-Shirt",
  description: "A wardrobe essential. 100% organic cotton.",
  primary_image:
    "https://placehold.co/800x800/f5f5f5/333.png?text=White+T-Shirt",
  image_urls: [
    "https://placehold.co/800x800/f5f5f5/333.png?text=White+T-Shirt",
    "https://placehold.co/800x800/f5f5f5/333.png?text=White+T-Shirt+Back",
  ],
  unit_price: 18.99,
  currency: "GBP",
  category: "Tops",
};

export const productListing = {
  id: product.id,
  name: product.name,
  primary_image: product.primary_image,
  unit_price: product.unit_price,
  currency: product.currency,
  category: product.category,
};

export const cart = {
  id: 1,
  items: [
    {
      quantity: 2,
      price: 37.98,
      currency: "GBP",
      product: {
        id: product.id,
        name: product.name,
        primary_image: product.primary_image,
      },
    },
  ],
  total_price: 37.98,
  currency: "GBP",
};

export const emptyCart = {
  id: null,
  items: [],
  total_price: 0,
  currency: "GBP",
};

export const savedAddress = {
  name: "Ada Lovelace",
  street: "12 Analytical Engine Ave",
  city: "London",
  postcode: "SW1A 2AA",
};

export const order = {
  id: 42,
  total_price: 37.98,
  currency: "GBP",
  status: "confirmed",
  items: [
    {
      quantity: 2,
      price: 37.98,
      currency: "GBP",
      product: {
        id: product.id,
        name: product.name,
        primary_image: product.primary_image,
      },
    },
  ],
  address_details: {
    name: "Ada Lovelace",
    street: "12 Analytical Engine Ave",
    city: "London",
    postcode: "SW1A 2AA",
  },
  payment_details: { card_last_four_digits: "4242" },
};

export const orderSummaries = [
  {
    id: order.id,
    created_at: "2026-07-01T10:00:00.000Z",
    status: "confirmed",
    total_price: order.total_price,
    currency: order.currency,
    item_count: order.items.length,
  },
];

export const handlers = [
  http.get(`${API_URL}/products`, () => {
    return HttpResponse.json({
      results: [productListing],
      total: 1,
      page: 1,
      totalPages: 1,
    });
  }),
  http.get(`${API_URL}/products/:id`, ({ params }) => {
    if (Number(params.id) !== product.id) {
      return HttpResponse.json({ error: "Product not found" }, { status: 404 });
    }
    return HttpResponse.json(product);
  }),
  http.get(`${API_URL}/cart`, () => {
    return HttpResponse.json(cart);
  }),
  http.post(`${API_URL}/cart/products`, () => {
    return HttpResponse.json(cart);
  }),
  http.get(`${API_URL}/account/address`, () => {
    return HttpResponse.json(null);
  }),
  http.get(`${API_URL}/order/:id`, ({ params }) => {
    if (Number(params.id) !== order.id) {
      return HttpResponse.json({ error: "Order not found" }, { status: 404 });
    }
    return HttpResponse.json(order);
  }),
  http.get(`${API_URL}/order`, () => {
    return HttpResponse.json(orderSummaries);
  }),
];
