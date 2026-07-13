import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import type { Document } from "@contentful/rich-text-types";
import { RichText } from "@/components/rich-text";

const document = {
  nodeType: "document",
  data: {},
  content: [
    {
      nodeType: "paragraph",
      data: {},
      content: [
        { nodeType: "text", value: "Hello world", marks: [], data: {} },
      ],
    },
  ],
} as unknown as Document;

describe("RichText", () => {
  it("renders paragraph text from a Contentful rich text document", () => {
    render(<RichText document={document} />);

    expect(screen.getByText("Hello world")).toBeInTheDocument();
  });
});
