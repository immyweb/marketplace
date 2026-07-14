import { describe, it, expect, vi, beforeEach } from "vitest";

const mockCreate = vi.fn();

vi.mock("openai", () => ({
  default: vi.fn().mockImplementation(function () {
    return {
      embeddings: { create: mockCreate },
    };
  }),
}));

import { embedText } from "./embeddings.service";

describe("embedText", () => {
  beforeEach(() => {
    mockCreate.mockReset();
  });

  it("returns the embedding vector from the OpenAI response", async () => {
    mockCreate.mockResolvedValue({
      data: [{ embedding: [0.1, 0.2, 0.3] }],
    });

    const result = await embedText("warm jacket for hiking");

    expect(result).toEqual([0.1, 0.2, 0.3]);
    expect(mockCreate).toHaveBeenCalledWith({
      model: "text-embedding-3-small",
      input: "warm jacket for hiking",
    });
  });

  it("propagates an error when the OpenAI call fails", async () => {
    mockCreate.mockRejectedValue(new Error("rate limited"));

    await expect(embedText("warm jacket")).rejects.toThrow("rate limited");
  });
});
