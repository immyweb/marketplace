import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { SignInForm } from "@/app/sign-in/_components";
import { authClient } from "@/lib/auth-client";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
let mockSearchParams = "";

vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  useRouter: () => ({ push, refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(mockSearchParams),
}));

vi.mock("@/lib/auth-client", () => ({
  authClient: { signIn: { email: vi.fn() } },
}));

function fillForm(
  overrides: Partial<{ email: string; password: string }> = {},
) {
  const values = {
    email: "ada@example.com",
    password: "password123",
    ...overrides,
  };
  fireEvent.change(screen.getByLabelText("Email"), {
    target: { value: values.email },
  });
  fireEvent.change(screen.getByLabelText("Password"), {
    target: { value: values.password },
  });
}

describe("SignInForm", () => {
  beforeEach(() => {
    push.mockClear();
    mockSearchParams = "";
    vi.mocked(authClient.signIn.email).mockReset();
  });

  it("renders the sign-in fields", () => {
    render(<SignInForm />);

    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
  });

  it("shows validation errors when submitting an empty form", async () => {
    render(<SignInForm />);

    fireEvent.click(screen.getByRole("button", { name: "Sign In" }));

    expect(
      await screen.findByText("Enter a valid email address"),
    ).toBeInTheDocument();
    expect(screen.getByText("Password is required")).toBeInTheDocument();
  });

  it("signs in and redirects to / by default", async () => {
    vi.mocked(authClient.signIn.email).mockResolvedValue({
      data: { user: { id: "1" }, token: "tok" },
      error: null,
    } as never);

    render(<SignInForm />);
    fillForm();
    fireEvent.click(screen.getByRole("button", { name: "Sign In" }));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/"));
    expect(authClient.signIn.email).toHaveBeenCalledWith({
      email: "ada@example.com",
      password: "password123",
    });
  });

  it("redirects to the ?redirect target when present", async () => {
    mockSearchParams = "redirect=/checkout";
    vi.mocked(authClient.signIn.email).mockResolvedValue({
      data: { user: { id: "1" }, token: "tok" },
      error: null,
    } as never);

    render(<SignInForm />);
    fillForm();
    fireEvent.click(screen.getByRole("button", { name: "Sign In" }));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/checkout"));
  });

  it("shows a server error message when sign-in fails", async () => {
    vi.mocked(authClient.signIn.email).mockResolvedValue({
      data: null,
      error: { message: "Invalid email or password" },
    } as never);

    render(<SignInForm />);
    fillForm();
    fireEvent.click(screen.getByRole("button", { name: "Sign In" }));

    expect(
      await screen.findByText("Invalid email or password"),
    ).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });
});
