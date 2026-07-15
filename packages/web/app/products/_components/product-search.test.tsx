import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProductSearch } from "@/app/products/_components";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
let mockSearchParams = "";

vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  useRouter: () => ({ push, refresh: vi.fn() }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(mockSearchParams),
}));

describe("ProductSearch", () => {
  beforeEach(() => {
    push.mockClear();
    mockSearchParams = "";
    vi.useFakeTimers();
    // @testing-library/react's asyncWrapper (dist/pure.js) drains the
    // microtask queue after every user-event action via a zero-delay
    // setTimeout, and only auto-advances it when it detects Jest's fake
    // timers (`typeof jest !== "undefined"`). Vitest has no such global,
    // so under `vi.useFakeTimers()` that internal setTimeout is faked but
    // never fires, and `await user.type(...)` hangs until the real test
    // timeout. Shimming a minimal `jest` global lets its detection succeed
    // and route the advance through `vi.advanceTimersByTime`.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).jest = { advanceTimersByTime: vi.advanceTimersByTime };
  });

  afterEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (globalThis as any).jest;
    vi.useRealTimers();
  });

  it("navigates to a search URL after the user stops typing", async () => {
    const user = userEvent.setup({ delay: null });
    render(<ProductSearch />);

    await user.type(
      screen.getByRole("searchbox", { name: "Search by description" }),
      "warm jacket",
    );
    vi.advanceTimersByTime(400);

    expect(push).toHaveBeenCalledWith("/?q=warm+jacket");
  });

  it("navigates back to the browse view when the query is cleared", async () => {
    mockSearchParams = "q=warm+jacket";
    const user = userEvent.setup({ delay: null });
    render(<ProductSearch />);

    await user.clear(
      screen.getByRole("searchbox", { name: "Search by description" }),
    );
    vi.advanceTimersByTime(400);

    expect(push).toHaveBeenCalledWith("/");
  });

  it("reflects the existing q param as the initial input value", () => {
    mockSearchParams = "q=warm+jacket";
    render(<ProductSearch />);

    expect(
      screen.getByRole("searchbox", { name: "Search by description" }),
    ).toHaveValue("warm jacket");
  });

  it("does not navigate before the debounce window elapses", async () => {
    const user = userEvent.setup({ delay: null });
    render(<ProductSearch />);

    await user.type(
      screen.getByRole("searchbox", { name: "Search by description" }),
      "w",
    );
    vi.advanceTimersByTime(100);

    expect(push).not.toHaveBeenCalled();
  });
});
