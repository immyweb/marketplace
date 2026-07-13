import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { server } from "@/test-support/setup";
import PrivacyPage from "@/app/privacy/page";

const CONTENTFUL_URL =
  "https://cdn.contentful.com/spaces/:spaceId/environments/master/entries";

describe("PrivacyPage", () => {
  it("falls back to the placeholder when no Contentful entry exists", async () => {
    server.use(
      http.get(CONTENTFUL_URL, () => HttpResponse.json({ items: [] })),
    );

    render(await PrivacyPage());

    expect(
      screen.getByRole("heading", { name: "Privacy Notice" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Content coming soon.")).toBeInTheDocument();
  });
});
