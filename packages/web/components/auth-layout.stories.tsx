import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { AuthLayout } from "./auth-layout";
import { SignInForm } from "@/app/sign-in/_components";
import { SignUpForm } from "@/app/sign-up/_components";

const meta = {
  title: "Layout/AuthLayout",
  component: AuthLayout,
  tags: ["autodocs"],
  parameters: {
    nextjs: {
      appDirectory: true,
    },
  },
} satisfies Meta<typeof AuthLayout>;

export default meta;

type Story = StoryObj<typeof meta>;

export const SignIn: Story = {
  args: {
    eyebrow: "Welcome Back",
    headline: "Pick Up Where You Left Off",
    supportText: "Your cart and order history are right where you left them.",
    children: <SignInForm />,
  },
};

export const SignUp: Story = {
  args: {
    eyebrow: "Member Ledger",
    headline: "Open Your Account",
    supportText:
      "Save your fit, track orders, and breeze through checkout next time.",
    stamp: "Established July 2026",
    children: <SignUpForm />,
  },
};
