import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { server } from "@/test-support/setup";
import { Nav } from "@/components/nav";

const API_URL = "http://localhost:3001";

vi.mock("next/headers", () => ({
  headers: () => Promise.resolve(new Headers()),
}));

vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  useRouter: () => ({ refresh: vi.fn() }),
}));

describe("Nav", () => {
  it("shows a sign-in link when logged out", async () => {
    server.use(
      http.get(`${API_URL}/api/auth/get-session`, () =>
        HttpResponse.json(null),
      ),
    );

    render(await Nav());

    expect(screen.getByRole("link", { name: "Sign in" })).toBeInTheDocument();
    expect(screen.queryByText("Sign out")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Orders" }),
    ).not.toBeInTheDocument();
  });

  it("shows the user's name, and hovering the account menu reveals Orders and Sign out", async () => {
    server.use(
      http.get(`${API_URL}/api/auth/get-session`, () =>
        HttpResponse.json({
          session: {
            id: "s1",
            userId: "u1",
            expiresAt: new Date().toISOString(),
          },
          user: { id: "u1", name: "Ada", email: "ada@example.com" },
        }),
      ),
    );

    render(await Nav());

    expect(
      screen.queryByRole("link", { name: "Sign in" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("menuitem", { name: "Orders" }),
    ).not.toBeInTheDocument();

    // The menu opens on hover, not click (mouse users have no click-based
    // fallback here — see account-menu.tsx). userEvent.click() synthesizes a
    // realistic hover-then-click gesture, and the click half would toggle
    // straight back closed on top of the hover-open, so hover directly
    // instead of clicking.
    const user = userEvent.setup();
    await user.hover(screen.getByRole("button", { name: /Ada/ }));

    expect(screen.getByRole("menuitem", { name: "Orders" })).toHaveAttribute(
      "href",
      "/orders",
    );
    expect(
      screen.getByRole("menuitem", { name: "Sign out" }),
    ).toBeInTheDocument();
  });
});
