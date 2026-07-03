import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ProductFilters } from "@/components/product-filters";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
let mockSearchParams = "";

vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  useRouter: () => ({ push, refresh: vi.fn() }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(mockSearchParams),
}));

describe("ProductFilters", () => {
  beforeEach(() => {
    push.mockClear();
    mockSearchParams = "";
  });

  it("renders a link for each category plus All", () => {
    render(<ProductFilters activeCategory={undefined} />);

    expect(screen.getByRole("link", { name: "All" })).toBeInTheDocument();
    for (const category of [
      "Tops",
      "Trousers",
      "Knitwear",
      "Outerwear",
      "Footwear",
      "Accessories",
    ]) {
      expect(screen.getByRole("link", { name: category })).toHaveAttribute(
        "href",
        `/?category=${category}`,
      );
    }
  });

  it("preserves the active sort in category link hrefs", () => {
    mockSearchParams = "sort=price_asc";
    render(<ProductFilters activeCategory={undefined} sort="price_asc" />);

    expect(screen.getByRole("link", { name: "All" })).toHaveAttribute(
      "href",
      "/?sort=price_asc",
    );
    expect(screen.getByRole("link", { name: "Footwear" })).toHaveAttribute(
      "href",
      "/?category=Footwear&sort=price_asc",
    );
  });

  it("marks the active category link with aria-current", () => {
    render(<ProductFilters activeCategory="Footwear" />);

    expect(screen.getByRole("link", { name: "Footwear" })).toHaveAttribute(
      "aria-current",
      "true",
    );
    expect(screen.getByRole("link", { name: "All" })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("marks All as active when no category is selected", () => {
    render(<ProductFilters activeCategory={undefined} />);

    expect(screen.getByRole("link", { name: "All" })).toHaveAttribute(
      "aria-current",
      "true",
    );
  });

  it("navigates with the chosen sort and clears page", () => {
    mockSearchParams = "page=3";
    render(<ProductFilters activeCategory={undefined} />);

    fireEvent.change(screen.getByLabelText("Sort products"), {
      target: { value: "price_asc" },
    });

    expect(push).toHaveBeenCalledWith("/?sort=price_asc");
  });

  it("preserves the category param when changing sort", () => {
    mockSearchParams = "category=Footwear";
    render(<ProductFilters activeCategory="Footwear" />);

    fireEvent.change(screen.getByLabelText("Sort products"), {
      target: { value: "price_desc" },
    });

    expect(push).toHaveBeenCalledWith("/?category=Footwear&sort=price_desc");
  });

  it("removes the sort param when Featured is selected", () => {
    mockSearchParams = "sort=price_asc";
    render(<ProductFilters activeCategory={undefined} />);

    fireEvent.change(screen.getByLabelText("Sort products"), {
      target: { value: "" },
    });

    expect(push).toHaveBeenCalledWith("/");
  });
});
