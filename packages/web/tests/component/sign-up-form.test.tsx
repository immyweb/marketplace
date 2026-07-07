import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { SignUpForm } from "@/app/sign-up/_components";
import { authClient } from "@/lib/auth-client";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
let mockSearchParams = "";

vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  useRouter: () => ({ push, refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(mockSearchParams),
}));

vi.mock("@/lib/auth-client", () => ({
  authClient: { signUp: { email: vi.fn() } },
}));

function fillForm(
  overrides: Partial<{ name: string; email: string; password: string }> = {},
) {
  const values = {
    name: "Ada Lovelace",
    email: "ada@example.com",
    password: "password123",
    ...overrides,
  };
  fireEvent.change(screen.getByLabelText("Full name"), {
    target: { value: values.name },
  });
  fireEvent.change(screen.getByLabelText("Email"), {
    target: { value: values.email },
  });
  fireEvent.change(screen.getByLabelText("Password"), {
    target: { value: values.password },
  });
}

describe("SignUpForm", () => {
  beforeEach(() => {
    push.mockClear();
    mockSearchParams = "";
    vi.mocked(authClient.signUp.email).mockReset();
  });

  it("renders the sign-up fields", () => {
    render(<SignUpForm />);

    expect(screen.getByLabelText("Full name")).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
  });

  it("shows validation errors when submitting an empty form", async () => {
    render(<SignUpForm />);

    fireEvent.click(screen.getByRole("button", { name: "Sign Up" }));

    expect(
      await screen.findByText("Full name is required"),
    ).toBeInTheDocument();
    expect(screen.getByText("Enter a valid email address")).toBeInTheDocument();
    expect(
      screen.getByText("Password must be at least 8 characters"),
    ).toBeInTheDocument();
  });

  it("signs up and redirects to / by default", async () => {
    vi.mocked(authClient.signUp.email).mockResolvedValue({
      data: { user: { id: "1" }, token: "tok" },
      error: null,
    } as never);

    render(<SignUpForm />);
    fillForm();
    fireEvent.click(screen.getByRole("button", { name: "Sign Up" }));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/"));
    expect(authClient.signUp.email).toHaveBeenCalledWith({
      name: "Ada Lovelace",
      email: "ada@example.com",
      password: "password123",
    });
  });

  it("redirects to the ?redirect target when present", async () => {
    mockSearchParams = "redirect=/checkout";
    vi.mocked(authClient.signUp.email).mockResolvedValue({
      data: { user: { id: "1" }, token: "tok" },
      error: null,
    } as never);

    render(<SignUpForm />);
    fillForm();
    fireEvent.click(screen.getByRole("button", { name: "Sign Up" }));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/checkout"));
  });

  it("shows a server error message when sign-up fails", async () => {
    vi.mocked(authClient.signUp.email).mockResolvedValue({
      data: null,
      error: { message: "Email already in use" },
    } as never);

    render(<SignUpForm />);
    fillForm();
    fireEvent.click(screen.getByRole("button", { name: "Sign Up" }));

    expect(await screen.findByText("Email already in use")).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });
});
