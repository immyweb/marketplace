import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { server } from "@/test-support/setup";
import CookiesPage from "@/app/cookies/page";

const CONTENTFUL_URL =
  "https://cdn.contentful.com/spaces/:spaceId/environments/master/entries";

describe("CookiesPage", () => {
  it("falls back to the placeholder when no Contentful entry exists", async () => {
    server.use(
      http.get(CONTENTFUL_URL, () => HttpResponse.json({ items: [] })),
    );

    render(await CookiesPage());

    expect(
      screen.getByRole("heading", { name: "Cookies" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Content coming soon.")).toBeInTheDocument();
  });
});
