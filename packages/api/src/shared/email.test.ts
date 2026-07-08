import { describe, it, expect } from "vitest";
import { http, HttpResponse } from "msw";
import { resend } from "./email";
import { server } from "../../tests/setup";

describe("resend client (MSW harness)", () => {
  it("returns the mocked success response for a send call", async () => {
    const { data, error } = await resend.emails.send({
      from: "test@example.com",
      to: "delivered@resend.dev",
      subject: "hello",
      html: "<p>hi</p>",
    });

    expect(error).toBeNull();
    expect(data).toMatchObject({ id: expect.any(String) });
  });

  it("returns the mocked error response when Resend reports a failure", async () => {
    server.use(
      http.post("https://api.resend.com/emails", () => {
        return HttpResponse.json(
          { message: "Invalid `to` field", name: "validation_error" },
          { status: 422 },
        );
      }),
    );

    const { data, error } = await resend.emails.send({
      from: "test@example.com",
      to: "not-an-email",
      subject: "hello",
      html: "<p>hi</p>",
    });

    expect(data).toBeNull();
    expect(error).toMatchObject({ name: "validation_error" });
  });
});
