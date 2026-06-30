export interface Product {
  id: number;
  name: string;
  description: string;
  primary_image: string;
  image_urls: string[];
  unit_price: number;
  currency: string;
}

export interface CartProduct {
  id: number;
  name: string;
  primary_image: string;
}

export interface CartItem {
  quantity: number;
  price: number;
  currency: string;
  product: CartProduct;
}

export interface Cart {
  id: number | null;
  items: CartItem[];
  total_price: number;
  currency: string;
}

export interface AddressDetails {
  name: string;
  street: string;
  city: string;
  postcode: string;
}

export interface OrderItem {
  quantity: number;
  price: number;
  currency: string;
  product: CartProduct;
}

export interface Order {
  id: number;
  total_price: number;
  currency: string;
  status: string;
  items: OrderItem[];
  address_details: AddressDetails;
  payment_details: { card_last_four_digits: string };
}

export interface ApiError {
  error: string;
  code?: string;
}
