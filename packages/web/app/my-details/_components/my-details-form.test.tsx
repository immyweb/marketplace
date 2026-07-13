import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { server } from "@/test-support/setup";
import { savedAddress } from "@/test-support/msw-handlers";
import { MyDetailsForm } from "@/app/my-details/_components";

const API_URL = "http://localhost:3001";

function fillAddress(
  overrides: Partial<{
    name: string;
    street: string;
    city: string;
    postcode: string;
  }> = {},
) {
  const values = {
    name: "Ada Lovelace",
    street: "12 Analytical Engine Ave",
    city: "London",
    postcode: "SW1A 2AA",
    ...overrides,
  };
  fireEvent.change(screen.getByLabelText("Full name"), {
    target: { value: values.name },
  });
  fireEvent.change(screen.getByLabelText("Street address"), {
    target: { value: values.street },
  });
  fireEvent.change(screen.getByLabelText("City"), {
    target: { value: values.city },
  });
  fireEvent.change(screen.getByLabelText("Postcode"), {
    target: { value: values.postcode },
  });
}

describe("MyDetailsForm", () => {
  it("renders blank when there is no saved address", () => {
    render(<MyDetailsForm savedAddress={null} />);

    expect(screen.getByLabelText("Full name")).toHaveValue("");
    expect(screen.getByLabelText("Street address")).toHaveValue("");
    expect(screen.getByLabelText("City")).toHaveValue("");
    expect(screen.getByLabelText("Postcode")).toHaveValue("");
    expect(screen.getByText("Not On File")).toBeInTheDocument();
  });

  it("prefills the address fields when a saved address is passed in", () => {
    render(<MyDetailsForm savedAddress={savedAddress} />);

    expect(screen.getByLabelText("Full name")).toHaveValue(savedAddress.name);
    expect(screen.getByLabelText("Street address")).toHaveValue(
      savedAddress.street,
    );
    expect(screen.getByLabelText("City")).toHaveValue(savedAddress.city);
    expect(screen.getByLabelText("Postcode")).toHaveValue(
      savedAddress.postcode,
    );
    expect(screen.getByText("On File")).toBeInTheDocument();
  });

  it("shows validation errors when submitting an empty form", async () => {
    render(<MyDetailsForm savedAddress={null} />);

    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(
      await screen.findByText("Full name is required"),
    ).toBeInTheDocument();
    expect(screen.getByText("Street address is required")).toBeInTheDocument();
    expect(screen.getByText("City is required")).toBeInTheDocument();
    expect(screen.getByText("Enter a valid UK postcode")).toBeInTheDocument();
  });

  it("saves the address and shows a success message", async () => {
    let capturedBody: unknown = null;
    server.use(
      http.put(`${API_URL}/account/address`, async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json(savedAddress);
      }),
    );

    render(<MyDetailsForm savedAddress={null} />);
    expect(screen.getByText("Not On File")).toBeInTheDocument();
    fillAddress();

    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Address saved")).toBeInTheDocument();
    expect(capturedBody).toEqual({
      name: "Ada Lovelace",
      street: "12 Analytical Engine Ave",
      city: "London",
      postcode: "SW1A 2AA",
    });
    expect(screen.getByText("On File")).toBeInTheDocument();
  });

  it("shows an inline error message when the save request fails", async () => {
    server.use(
      http.put(`${API_URL}/account/address`, () =>
        HttpResponse.json({ error: "Something broke" }, { status: 500 }),
      ),
    );

    render(<MyDetailsForm savedAddress={null} />);
    fillAddress();

    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Something broke")).toBeInTheDocument();
  });
});
