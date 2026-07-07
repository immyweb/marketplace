import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProductFilters } from "@/app/_components";

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

  it("navigates with the chosen sort and clears page", async () => {
    mockSearchParams = "page=3";
    render(<ProductFilters activeCategory={undefined} />);

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /^Sort:/ }));
    await user.click(
      screen.getByRole("menuitemradio", { name: "Price: Low to High" }),
    );

    expect(push).toHaveBeenCalledWith("/?sort=price_asc");
  });

  it("preserves the category param when changing sort", async () => {
    mockSearchParams = "category=Footwear";
    render(<ProductFilters activeCategory="Footwear" />);

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /^Sort:/ }));
    await user.click(
      screen.getByRole("menuitemradio", { name: "Price: High to Low" }),
    );

    expect(push).toHaveBeenCalledWith("/?category=Footwear&sort=price_desc");
  });

  it("removes the sort param when Featured is selected", async () => {
    mockSearchParams = "sort=price_asc";
    render(<ProductFilters activeCategory={undefined} />);

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /^Sort:/ }));
    await user.click(screen.getByRole("menuitemradio", { name: "Featured" }));

    expect(push).toHaveBeenCalledWith("/");
  });
});
