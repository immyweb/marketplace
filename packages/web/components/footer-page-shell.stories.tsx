import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { FooterPageShell } from "./footer-page-shell";

const meta = {
  title: "Layout/FooterPageShell",
  component: FooterPageShell,
  tags: ["autodocs"],
  args: {
    children: (
      <p className="mt-8 text-muted-foreground">
        We take your privacy seriously. This notice explains what data we
        collect and how we use it.
      </p>
    ),
  },
} satisfies Meta<typeof FooterPageShell>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    slug: "privacy",
    title: "Privacy Notice",
  },
};

export const FirstPolicy: Story = {
  args: {
    slug: "terms",
    title: "Terms & Conditions",
  },
};

export const LastPolicy: Story = {
  args: {
    slug: "reviews-policy",
    title: "Reviews Policy",
  },
};
