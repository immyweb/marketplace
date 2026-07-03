import Link from "next/link";

interface Props {
  page: number;
  totalPages: number;
  sort?: string;
  category?: string;
}

function buildHref(page: number, sort?: string, category?: string) {
  const params = new URLSearchParams();
  if (page > 1) params.set("page", String(page));
  if (sort) params.set("sort", sort);
  if (category) params.set("category", category);
  const qs = params.toString();
  return qs ? `/?${qs}` : "/";
}

export function Pagination({ page, totalPages, sort, category }: Props) {
  if (totalPages <= 1) return null;

  const pages = Array.from({ length: totalPages }, (_, i) => i + 1);

  return (
    <nav
      aria-label="Pagination"
      className="mt-10 flex items-center justify-center gap-2 font-mono text-sm"
    >
      {page > 1 && (
        <Link
          href={buildHref(page - 1, sort, category)}
          aria-label="Previous page"
        >
          Previous
        </Link>
      )}
      {pages.map((p) =>
        p === page ? (
          <span key={p} aria-current="page" className="font-medium">
            {p}
          </span>
        ) : (
          <Link key={p} href={buildHref(p, sort, category)}>
            {p}
          </Link>
        ),
      )}
      {page < totalPages && (
        <Link href={buildHref(page + 1, sort, category)} aria-label="Next page">
          Next
        </Link>
      )}
    </nav>
  );
}
