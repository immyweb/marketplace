import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, mocked, userEvent, waitFor } from "storybook/test";

import { SignUpForm } from "./sign-up-form";
import { authClient } from "@/lib/auth-client";

async function fillForm(
  canvas: Parameters<NonNullable<Story["play"]>>[0]["canvas"],
  overrides: Partial<{ name: string; email: string; password: string }> = {},
) {
  const values = {
    name: "Ada Lovelace",
    email: "ada@example.com",
    password: "password123",
    ...overrides,
  };
  await userEvent.type(canvas.getByLabelText("Full name"), values.name);
  await userEvent.type(canvas.getByLabelText("Email"), values.email);
  await userEvent.type(canvas.getByLabelText("Password"), values.password);
}

const meta = {
  title: "Auth/SignUpForm",
  component: SignUpForm,
  tags: ["autodocs"],
  parameters: {
    nextjs: {
      appDirectory: true,
    },
  },
  beforeEach: async () => {
    mocked(authClient.signUp.email).mockResolvedValue({
      data: { user: { id: "1" }, token: "tok" },
      error: null,
    } as never);
  },
} satisfies Meta<typeof SignUpForm>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const ValidationErrors: Story = {
  play: async ({ canvas }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Sign Up" }));

    await expect(
      await canvas.findByText("Full name is required"),
    ).toBeInTheDocument();
    await expect(
      canvas.getByText("Enter a valid email address"),
    ).toBeInTheDocument();
    await expect(
      canvas.getByText("Password must be at least 8 characters"),
    ).toBeInTheDocument();
  },
};

export const SignsUpSuccessfully: Story = {
  play: async ({ canvas }) => {
    await fillForm(canvas);
    await userEvent.click(canvas.getByRole("button", { name: "Sign Up" }));

    await waitFor(() => {
      expect(authClient.signUp.email).toHaveBeenCalledWith({
        name: "Ada Lovelace",
        email: "ada@example.com",
        password: "password123",
      });
    });

    await expect(
      canvas.getByRole("button", { name: "Creating account..." }),
    ).toBeDisabled();
  },
};

export const ServerError: Story = {
  beforeEach: async () => {
    mocked(authClient.signUp.email).mockResolvedValue({
      data: null,
      error: { message: "Email already in use" },
    } as never);
  },
  play: async ({ canvas }) => {
    await fillForm(canvas);
    await userEvent.click(canvas.getByRole("button", { name: "Sign Up" }));

    await expect(
      await canvas.findByText("Email already in use"),
    ).toBeInTheDocument();
    await expect(canvas.getByRole("button", { name: "Sign Up" })).toBeEnabled();
  },
};
