import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { Pagination } from "./pagination";

const meta = {
  title: "Products/Pagination",
  component: Pagination,
  tags: ["autodocs"],
  args: {
    page: 1,
    totalPages: 7,
  },
} satisfies Meta<typeof Pagination>;

export default meta;

type Story = StoryObj<typeof meta>;

export const FirstPage: Story = {};

export const MiddlePage: Story = {
  args: { page: 4 },
};

export const LastPage: Story = {
  args: { page: 7 },
};

export const SinglePage: Story = {
  args: { page: 1, totalPages: 1 },
};

export const WithFiltersApplied: Story = {
  args: {
    page: 2,
    sort: "price_asc",
    category: "Footwear",
  },
};
