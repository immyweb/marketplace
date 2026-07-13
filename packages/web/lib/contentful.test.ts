import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "@/test-support/setup";
import { getFooterPage } from "@/lib/contentful";

const CONTENTFUL_URL =
  "https://cdn.contentful.com/spaces/:spaceId/environments/master/entries";

beforeEach(() => {
  vi.stubEnv("CONTENTFUL_SPACE_ID", "test-space");
  vi.stubEnv("CONTENTFUL_ACCESS_TOKEN", "test-token");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("getFooterPage", () => {
  it("returns the entry's title and body when Contentful has a matching entry", async () => {
    server.use(
      http.get(CONTENTFUL_URL, () =>
        HttpResponse.json({
          items: [
            {
              fields: {
                title: "Terms & Conditions",
                body: { nodeType: "document", data: {}, content: [] },
              },
            },
          ],
        }),
      ),
    );

    const page = await getFooterPage("terms");

    expect(page).toEqual({
      title: "Terms & Conditions",
      body: { nodeType: "document", data: {}, content: [] },
    });
  });

  it("returns null when Contentful has no entry for the slug", async () => {
    server.use(
      http.get(CONTENTFUL_URL, () => HttpResponse.json({ items: [] })),
    );

    expect(await getFooterPage("terms")).toBeNull();
  });

  it("returns null when the Contentful request fails", async () => {
    server.use(
      http.get(CONTENTFUL_URL, () =>
        HttpResponse.json({ message: "Internal error" }, { status: 500 }),
      ),
    );

    expect(await getFooterPage("terms")).toBeNull();
  });

  it("returns null on a network error", async () => {
    server.use(http.get(CONTENTFUL_URL, () => HttpResponse.error()));

    expect(await getFooterPage("terms")).toBeNull();
  });
});
