import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Pagination } from "./pagination";

function buildHref(page: number) {
  return page > 1 ? `/?page=${page}` : "/";
}

describe("Pagination", () => {
  it("renders nothing when there is only one page", () => {
    const { container } = render(
      <Pagination page={1} totalPages={1} buildHref={buildHref} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders a link for each page", () => {
    render(<Pagination page={1} totalPages={3} buildHref={buildHref} />);
    expect(screen.getByRole("link", { name: "2" })).toHaveAttribute(
      "href",
      "/?page=2",
    );
    expect(screen.getByRole("link", { name: "3" })).toHaveAttribute(
      "href",
      "/?page=3",
    );
  });

  it("marks the current page and does not link it", () => {
    render(<Pagination page={2} totalPages={3} buildHref={buildHref} />);
    const current = screen.getByText("2");
    expect(current).toHaveAttribute("aria-current", "page");
    expect(current.tagName).not.toBe("A");
  });

  it("hides Previous on the first page", () => {
    render(<Pagination page={1} totalPages={2} buildHref={buildHref} />);
    expect(
      screen.queryByRole("link", { name: "Previous page" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Next page" })).toBeInTheDocument();
  });

  it("hides Next on the last page", () => {
    render(<Pagination page={2} totalPages={2} buildHref={buildHref} />);
    expect(
      screen.queryByRole("link", { name: "Next page" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Previous page" }),
    ).toBeInTheDocument();
  });

  it("delegates href construction to buildHref", () => {
    render(
      <Pagination
        page={1}
        totalPages={3}
        buildHref={(p) => `/?page=${p}&sort=price_asc&category=Footwear`}
      />,
    );
    expect(screen.getByRole("link", { name: "2" })).toHaveAttribute(
      "href",
      "/?page=2&sort=price_asc&category=Footwear",
    );
  });
});
