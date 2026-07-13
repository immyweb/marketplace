import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { server } from "@/test-support/setup";
import MyDetailsPage from "@/app/my-details/page";

const API_URL = "http://localhost:3001";

vi.mock("next/headers", () => ({
  headers: () => Promise.resolve(new Headers()),
}));

const { redirect } = vi.hoisted(() => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));

vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  redirect,
}));

vi.mock("@/app/my-details/_components", () => ({
  MyDetailsForm: () => <div>my details form</div>,
}));

describe("MyDetailsPage auth gate", () => {
  it("redirects to sign-in when there is no session", async () => {
    server.use(
      http.get(`${API_URL}/api/auth/get-session`, () =>
        HttpResponse.json(null),
      ),
    );

    await expect(MyDetailsPage()).rejects.toThrow(
      "REDIRECT:/sign-in?redirect=/my-details",
    );
  });

  it("renders the my details form when a session exists", async () => {
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

    render(await MyDetailsPage());

    expect(screen.getByText("my details form")).toBeInTheDocument();
  });
});
