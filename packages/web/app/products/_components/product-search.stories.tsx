import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { ProductSearch } from "./product-search";

const meta = {
  title: "Products/ProductSearch",
  component: ProductSearch,
  parameters: {
    nextjs: {
      appDirectory: true,
    },
  },
} satisfies Meta<typeof ProductSearch>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithQuery: Story = {
  parameters: {
    nextjs: {
      appDirectory: true,
      navigation: {
        query: { q: "warm jacket for a rainy hike" },
      },
    },
  },
};
