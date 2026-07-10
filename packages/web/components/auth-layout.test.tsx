import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { AuthLayout } from "@/components/auth-layout";

describe("AuthLayout", () => {
  it("renders the eyebrow, headline, support text, and children", () => {
    render(
      <AuthLayout
        eyebrow="Member Ledger"
        headline="Open Your Account"
        supportText="Save your fit, track orders, and breeze through checkout next time."
        stamp="Established July 2026"
      >
        <p>Form content</p>
      </AuthLayout>,
    );

    expect(screen.getByText("Member Ledger")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 1, name: "Open Your Account" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Save your fit, track orders, and breeze through checkout next time.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("Form content")).toBeInTheDocument();
  });

  it("renders the stamp when provided", () => {
    render(
      <AuthLayout
        eyebrow="Member Ledger"
        headline="Open Your Account"
        supportText="Save your fit."
        stamp="Established July 2026"
      >
        <p>Form content</p>
      </AuthLayout>,
    );

    expect(screen.getByText("Established July 2026")).toBeInTheDocument();
  });

  it("omits the stamp when not provided", () => {
    render(
      <AuthLayout
        eyebrow="Welcome Back"
        headline="Pick Up Where You Left Off"
        supportText="Your cart and order history are right where you left them."
      >
        <p>Form content</p>
      </AuthLayout>,
    );

    expect(screen.queryByText(/established/i)).not.toBeInTheDocument();
  });
});
