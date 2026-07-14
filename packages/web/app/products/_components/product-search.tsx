"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { buildProductsHref } from "./product-href";

const DEBOUNCE_MS = 400;

export function ProductSearch() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(searchParams.get("q") ?? "");

  useEffect(() => {
    const currentQ = searchParams.get("q") ?? "";
    if (value === currentQ) return;

    const timeout = setTimeout(() => {
      router.push(buildProductsHref({ q: value || undefined }));
    }, DEBOUNCE_MS);

    return () => clearTimeout(timeout);
  }, [value, searchParams, router]);

  return (
    <input
      type="search"
      aria-label="Search products"
      placeholder="Search products…"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      className="mt-6 w-full max-w-sm rounded-full border border-border bg-transparent px-4 py-2 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none"
    />
  );
}
