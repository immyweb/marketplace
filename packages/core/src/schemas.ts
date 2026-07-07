import { z } from "zod";
import { PRODUCT_CATEGORIES } from "./types";

export const AddToCartSchema = z.object({
  productId: z
    .number({ required_error: "productId is required" })
    .int()
    .positive(),
  quantity: z
    .number({ required_error: "quantity is required" })
    .int()
    .min(1, "Quantity must be at least 1"),
});

export const UpdateCartItemSchema = z.object({
  quantity: z.number({ required_error: "quantity is required" }).int().min(0),
});

export const AddressSchema = z.object({
  name: z.string().min(1, "Full name is required"),
  street: z.string().min(1, "Street address is required"),
  city: z.string().min(1, "City is required"),
  postcode: z
    .string()
    .regex(/^[A-Z]{1,2}\d[A-Z\d]? ?\d[A-Z]{2}$/i, "Enter a valid UK postcode"),
});

export const PlaceOrderSchema = z.object({
  cartId: z.number({ required_error: "cartId is required" }).int().positive(),
  paymentIntentId: z.string().min(1, "paymentIntentId is required"),
  address_details: AddressSchema,
});

export type AddToCartInput = z.infer<typeof AddToCartSchema>;
export type UpdateCartItemInput = z.infer<typeof UpdateCartItemSchema>;
export type AddressInput = z.infer<typeof AddressSchema>;
export type PlaceOrderInput = z.infer<typeof PlaceOrderSchema>;

export const SignUpSchema = z.object({
  name: z.string().min(1, "Full name is required"),
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export const SignInSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

export type SignUpInput = z.infer<typeof SignUpSchema>;
export type SignInInput = z.infer<typeof SignInSchema>;

export const ProductListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  sort: z.enum(["category", "price_asc", "price_desc"]).optional(),
  category: z.enum(PRODUCT_CATEGORIES).optional(),
});

export type ProductListQuery = z.infer<typeof ProductListQuerySchema>;
