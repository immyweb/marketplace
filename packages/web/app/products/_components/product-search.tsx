"use client";

import { useEffect, useId, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SearchIcon } from "lucide-react";
import { buildProductsHref } from "./product-href";

const DEBOUNCE_MS = 400;

export function ProductSearch() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(searchParams.get("q") ?? "");
  const inputId = useId();

  useEffect(() => {
    const currentQ = searchParams.get("q") ?? "";
    if (value === currentQ) return;

    const timeout = setTimeout(() => {
      router.push(buildProductsHref({ q: value || undefined }));
    }, DEBOUNCE_MS);

    return () => clearTimeout(timeout);
  }, [value, searchParams, router]);

  return (
    <div className="mt-6 w-full max-w-xl rounded-sm border border-dashed border-border bg-card p-4">
      <label
        htmlFor={inputId}
        className="font-mono text-xs tracking-widest text-secondary uppercase"
      >
        Search by description
      </label>
      <div className="relative mt-2">
        <SearchIcon
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <input
          id={inputId}
          type="search"
          placeholder={`"a warm jacket for a rainy hike"`}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="w-full rounded-sm border border-border bg-background py-2 pr-3 pl-9 text-sm placeholder:text-muted-foreground/70 placeholder:italic focus:border-secondary focus:outline-none"
        />
      </div>
    </div>
  );
}
