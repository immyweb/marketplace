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
