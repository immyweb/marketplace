import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Footer } from "@/components/footer";

const EXPECTED_LINKS = [
  { name: "Terms & Conditions", href: "/terms" },
  { name: "Privacy Notice", href: "/privacy" },
  { name: "Cookies", href: "/cookies" },
  { name: "Sustainability", href: "/sustainability" },
  { name: "Accessibility", href: "/accessibility" },
  { name: "Reviews Policy", href: "/reviews-policy" },
];

describe("Footer", () => {
  it("renders a link to each policy page", () => {
    render(<Footer />);

    for (const { name, href } of EXPECTED_LINKS) {
      expect(screen.getByRole("link", { name })).toHaveAttribute("href", href);
    }
  });
});
