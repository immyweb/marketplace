import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, mocked, userEvent, waitFor } from "storybook/test";
import type { CartItem } from "@marketplace/core";

import { CartItemRow } from "./cart-item-row";
import { updateCartItem, removeFromCart } from "@/lib/api";

const sampleItem: CartItem = {
  quantity: 2,
  price: 37.98,
  currency: "GBP",
  product: {
    id: 42,
    name: "Waxed Cotton Field Jacket",
    primary_image: "https://placehold.co/160x160/2f3b2c/f5f1e6.png?text=Jacket",
  },
};

const meta = {
  title: "Cart/CartItemRow",
  component: CartItemRow,
  tags: ["autodocs"],
  parameters: {
    nextjs: {
      appDirectory: true,
    },
  },
  args: {
    item: sampleItem,
    index: 0,
  },
  decorators: [
    (Story) => (
      <ul className="max-w-lg list-none">
        <Story />
      </ul>
    ),
  ],
  beforeEach: async () => {
    mocked(updateCartItem).mockResolvedValue({
      id: 1,
      items: [],
      total_price: 0,
      currency: "GBP",
    });
    mocked(removeFromCart).mockResolvedValue({
      id: 1,
      items: [],
      total_price: 0,
      currency: "GBP",
    });
  },
} satisfies Meta<typeof CartItemRow>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const MinimumQuantity: Story = {
  args: {
    item: { ...sampleItem, quantity: 1, price: 18.99 },
  },
  play: async ({ canvas }) => {
    await expect(
      canvas.getByRole("button", { name: "Decrease quantity" }),
    ).toBeDisabled();
  },
};

export const IncreasingQuantity: Story = {
  play: async ({ canvas }) => {
    await userEvent.click(
      canvas.getByRole("button", { name: "Increase quantity" }),
    );

    await waitFor(() => {
      expect(updateCartItem).toHaveBeenCalledWith(42, 3);
    });
  },
};

export const RemovingItem: Story = {
  play: async ({ canvas }) => {
    await userEvent.click(
      canvas.getByRole("button", { name: "Remove Waxed Cotton Field Jacket" }),
    );

    await waitFor(() => {
      expect(removeFromCart).toHaveBeenCalledWith(42);
    });
  },
};
