import { z } from "zod";

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
  saveAddress: z.boolean({ required_error: "saveAddress is required" }),
});

export type AddressInput = z.infer<typeof AddressSchema>;
export type PlaceOrderInput = z.infer<typeof PlaceOrderSchema>;
