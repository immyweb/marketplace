import { CartProduct } from "../cart/types";

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

export interface OrderSummary {
  id: number;
  created_at: string;
  status: string;
  total_price: number;
  currency: string;
  item_count: number;
}
