import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Pagination } from "@/app/products/_components";

describe("Pagination", () => {
  it("renders nothing when there is only one page", () => {
    const { container } = render(<Pagination page={1} totalPages={1} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders a link for each page", () => {
    render(<Pagination page={1} totalPages={3} />);
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
    render(<Pagination page={2} totalPages={3} />);
    const current = screen.getByText("2");
    expect(current).toHaveAttribute("aria-current", "page");
    expect(current.tagName).not.toBe("A");
  });

  it("hides Previous on the first page", () => {
    render(<Pagination page={1} totalPages={2} />);
    expect(
      screen.queryByRole("link", { name: "Previous page" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Next page" })).toBeInTheDocument();
  });

  it("hides Next on the last page", () => {
    render(<Pagination page={2} totalPages={2} />);
    expect(
      screen.queryByRole("link", { name: "Next page" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Previous page" }),
    ).toBeInTheDocument();
  });

  it("preserves sort and category params in page links", () => {
    render(
      <Pagination
        page={1}
        totalPages={3}
        sort="price_asc"
        category="Footwear"
      />,
    );
    expect(screen.getByRole("link", { name: "2" })).toHaveAttribute(
      "href",
      "/?page=2&sort=price_asc&category=Footwear",
    );
  });
});
