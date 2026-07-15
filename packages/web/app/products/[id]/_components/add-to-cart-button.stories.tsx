import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, mocked, userEvent, waitFor, within } from "storybook/test";

import { AddToCartButton } from "./add-to-cart-button";
import { addToCart } from "@/lib/api";

const meta = {
  title: "Products/AddToCartButton",
  component: AddToCartButton,
  tags: ["autodocs"],
  parameters: {
    nextjs: {
      appDirectory: true,
    },
  },
  args: {
    productId: 1,
  },
  beforeEach: async () => {
    mocked(addToCart).mockResolvedValue({
      id: 1,
      items: [],
      total_price: 0,
      currency: "GBP",
    });
  },
} satisfies Meta<typeof AddToCartButton>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const AddsToCartSuccessfully: Story = {
  play: async ({ canvas }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Add to Cart" }));

    await waitFor(() => {
      expect(addToCart).toHaveBeenCalledWith(1, 1);
    });

    await expect(
      within(document.body).getByRole("dialog", { name: "Added to Cart" }),
    ).toBeInTheDocument();
  },
};

export const ErrorAddingToCart: Story = {
  beforeEach: async () => {
    mocked(addToCart).mockRejectedValue(new Error("This item is out of stock"));
  },
  play: async ({ canvas }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Add to Cart" }));

    await expect(await canvas.findByRole("alert")).toHaveTextContent(
      "This item is out of stock",
    );
  },
};
