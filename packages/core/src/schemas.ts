import { z } from 'zod';

export const AddToCartSchema = z.object({
  productId: z
    .number({ required_error: 'productId is required' })
    .int()
    .positive(),
  quantity: z
    .number({ required_error: 'quantity is required' })
    .int()
    .min(1, 'Quantity must be at least 1')
});

export const UpdateCartItemSchema = z.object({
  quantity: z.number({ required_error: 'quantity is required' }).int().min(0)
});

export const AddressSchema = z.object({
  name: z.string().min(1, 'Full name is required'),
  street: z.string().min(1, 'Street address is required'),
  city: z.string().min(1, 'City is required'),
  postcode: z
    .string()
    .regex(/^[A-Z]{1,2}\d[A-Z\d]? ?\d[A-Z]{2}$/i, 'Enter a valid UK postcode')
});

export const PlaceOrderSchema = z.object({
  cartId: z.number({ required_error: 'cartId is required' }).int().positive(),
  paymentIntentId: z.string().min(1, 'paymentIntentId is required'),
  address_details: AddressSchema
});

export type AddToCartInput = z.infer<typeof AddToCartSchema>;
export type UpdateCartItemInput = z.infer<typeof UpdateCartItemSchema>;
export type AddressInput = z.infer<typeof AddressSchema>;
export type PlaceOrderInput = z.infer<typeof PlaceOrderSchema>;
