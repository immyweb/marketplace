import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, mocked, userEvent, waitFor } from "storybook/test";

import { SignInForm } from "./sign-in-form";
import { authClient } from "@/lib/auth-client";

async function fillForm(
  canvas: Parameters<NonNullable<Story["play"]>>[0]["canvas"],
  overrides: Partial<{ email: string; password: string }> = {},
) {
  const values = {
    email: "ada@example.com",
    password: "password123",
    ...overrides,
  };
  await userEvent.type(canvas.getByLabelText("Email"), values.email);
  await userEvent.type(canvas.getByLabelText("Password"), values.password);
}

const meta = {
  title: "Auth/SignInForm",
  component: SignInForm,
  tags: ["autodocs"],
  parameters: {
    nextjs: {
      appDirectory: true,
    },
  },
  beforeEach: async () => {
    mocked(authClient.signIn.email).mockResolvedValue({
      data: { user: { id: "1" }, token: "tok" },
      error: null,
    } as never);
  },
} satisfies Meta<typeof SignInForm>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const ValidationErrors: Story = {
  play: async ({ canvas }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Sign In" }));

    await expect(
      await canvas.findByText("Enter a valid email address"),
    ).toBeInTheDocument();
    await expect(canvas.getByText("Password is required")).toBeInTheDocument();
  },
};

export const SignsInSuccessfully: Story = {
  play: async ({ canvas }) => {
    await fillForm(canvas);
    await userEvent.click(canvas.getByRole("button", { name: "Sign In" }));

    await waitFor(() => {
      expect(authClient.signIn.email).toHaveBeenCalledWith({
        email: "ada@example.com",
        password: "password123",
      });
    });

    await expect(
      canvas.getByRole("button", { name: "Signing in..." }),
    ).toBeDisabled();
  },
};

export const ServerError: Story = {
  beforeEach: async () => {
    mocked(authClient.signIn.email).mockResolvedValue({
      data: null,
      error: { message: "Invalid email or password" },
    } as never);
  },
  play: async ({ canvas }) => {
    await fillForm(canvas);
    await userEvent.click(canvas.getByRole("button", { name: "Sign In" }));

    await expect(
      await canvas.findByText("Invalid email or password"),
    ).toBeInTheDocument();
    await expect(canvas.getByRole("button", { name: "Sign In" })).toBeEnabled();
  },
};
