import { http, HttpResponse } from "msw";

export const resendHandlers = [
  http.post("https://api.resend.com/emails", () => {
    return HttpResponse.json({ id: "email_test_id" });
  }),
];
