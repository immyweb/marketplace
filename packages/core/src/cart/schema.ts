import { z } from "zod";

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

export type AddToCartInput = z.infer<typeof AddToCartSchema>;
export type UpdateCartItemInput = z.infer<typeof UpdateCartItemSchema>;
