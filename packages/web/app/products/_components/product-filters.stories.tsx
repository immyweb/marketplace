import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { ProductFilters } from "./product-filters";

const meta = {
  title: "Products/ProductFilters",
  component: ProductFilters,
  parameters: {
    nextjs: {
      appDirectory: true,
    },
  },
} satisfies Meta<typeof ProductFilters>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const CategorySelected: Story = {
  args: {
    activeCategory: "Footwear",
  },
};

export const SortApplied: Story = {
  args: {
    activeCategory: "Outerwear",
    sort: "price_asc",
  },
  parameters: {
    nextjs: {
      appDirectory: true,
      // SortSelect reads its displayed label from the URL, not this
      // story's `sort` arg, so the query must be mocked too.
      navigation: {
        query: { sort: "price_asc" },
      },
    },
  },
};
