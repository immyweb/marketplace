import { describe, it, expect, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "../../../tests/setup";
import { sendWelcomeEmail } from "./welcome.email";
import { logger } from "@/shared/logger";
import { resend } from "@/shared/email";

describe("sendWelcomeEmail", () => {
  it("sends a welcome email via Resend without throwing", async () => {
    await expect(
      sendWelcomeEmail("jane@example.com", "Jane Smith"),
    ).resolves.toBeUndefined();
  });

  it("logs a warning and does not throw when Resend returns an error", async () => {
    server.use(
      http.post("https://api.resend.com/emails", () => {
        return HttpResponse.json(
          { message: "Invalid `from` field" },
          { status: 422 },
        );
      }),
    );
    const warnSpy = vi.spyOn(logger, "warn").mockImplementation(() => {});

    await expect(
      sendWelcomeEmail("jane@example.com", "Jane Smith"),
    ).resolves.toBeUndefined();

    expect(warnSpy).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.anything() }),
      "Failed to send welcome email",
    );
    warnSpy.mockRestore();
  });

  it("logs a warning and does not throw when the network call itself throws", async () => {
    const sendSpy = vi
      .spyOn(resend.emails, "send")
      .mockRejectedValue(new Error("network down"));
    const warnSpy = vi.spyOn(logger, "warn").mockImplementation(() => {});

    await expect(
      sendWelcomeEmail("jane@example.com", "Jane Smith"),
    ).resolves.toBeUndefined();

    expect(warnSpy).toHaveBeenCalledWith(
      expect.objectContaining({ err: expect.anything() }),
      "Failed to send welcome email",
    );
    sendSpy.mockRestore();
    warnSpy.mockRestore();
  });
});
