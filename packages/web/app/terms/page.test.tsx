import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { server } from "@/test-support/setup";
import TermsPage from "@/app/terms/page";

const CONTENTFUL_URL =
  "https://cdn.contentful.com/spaces/:spaceId/environments/master/entries";

describe("TermsPage", () => {
  it("renders the Contentful title and body when an entry exists", async () => {
    server.use(
      http.get(CONTENTFUL_URL, () =>
        HttpResponse.json({
          items: [
            {
              fields: {
                title: "Our Terms",
                body: {
                  nodeType: "document",
                  data: {},
                  content: [
                    {
                      nodeType: "paragraph",
                      data: {},
                      content: [
                        {
                          nodeType: "text",
                          value: "Terms body text",
                          marks: [],
                          data: {},
                        },
                      ],
                    },
                  ],
                },
              },
            },
          ],
        }),
      ),
    );

    render(await TermsPage());

    expect(
      screen.getByRole("heading", { name: "Our Terms" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Terms body text")).toBeInTheDocument();
  });

  it("falls back to the placeholder when no entry exists", async () => {
    server.use(
      http.get(CONTENTFUL_URL, () => HttpResponse.json({ items: [] })),
    );

    render(await TermsPage());

    expect(
      screen.getByRole("heading", { name: "Terms & Conditions" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Content coming soon.")).toBeInTheDocument();
  });
});
