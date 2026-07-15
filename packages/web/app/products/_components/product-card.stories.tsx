import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { ProductCard } from "./product-card";

const meta = {
  title: "Products/ProductCard",
  component: ProductCard,
  tags: ["autodocs"],
  args: {
    id: 1,
    name: "Classic White T-Shirt",
    primary_image:
      "https://placehold.co/800x800/f5f5f5/333.png?text=White+T-Shirt",
    unit_price: 18.99,
    currency: "GBP",
  },
} satisfies Meta<typeof ProductCard>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const LongName: Story = {
  args: {
    id: 9,
    name: "Waxed Cotton Field Jacket with Corduroy Collar",
    primary_image:
      "https://placehold.co/800x800/2f3b2c/f5f1e6.png?text=Waxed+Jacket",
    unit_price: 145,
  },
};

export const NonGbpCurrency: Story = {
  args: {
    id: 2,
    name: "Navy Chino Trousers",
    primary_image:
      "https://placehold.co/800x800/1a2744/f5f5f5.png?text=Navy+Chinos",
    unit_price: 52,
    currency: "USD",
  },
};
