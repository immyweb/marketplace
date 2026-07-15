import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, within } from "storybook/test";

import { AddedToCartModal } from "./added-to-cart-modal";

const meta = {
  title: "Products/AddedToCartModal",
  component: AddedToCartModal,
  tags: ["autodocs"],
  parameters: {
    nextjs: {
      appDirectory: true,
    },
  },
  args: {
    open: true,
    onOpenChange: fn(),
  },
} satisfies Meta<typeof AddedToCartModal>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Open: Story = {};

export const Closed: Story = {
  args: {
    open: false,
  },
  play: async () => {
    await expect(
      within(document.body).queryByRole("dialog"),
    ).not.toBeInTheDocument();
  },
};

export const ContinueShopping: Story = {
  play: async ({ args }) => {
    await userEvent.click(
      within(document.body).getByRole("button", { name: "Continue Shopping" }),
    );

    await expect(args.onOpenChange).toHaveBeenCalledWith(false);
  },
};

export const Checkout: Story = {
  play: async ({ args }) => {
    await userEvent.click(
      within(document.body).getByRole("button", { name: "Checkout" }),
    );

    await expect(args.onOpenChange).toHaveBeenCalledWith(false);
  },
};
