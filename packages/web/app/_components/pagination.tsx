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

const navLinkClasses =
  "flex min-h-11 items-center gap-1.5 rounded-sm border border-border px-4 font-mono text-xs tracking-widest text-foreground uppercase outline-none transition-colors hover:border-primary hover:bg-primary hover:text-primary-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50";

const pageLinkClasses =
  "flex size-11 items-center justify-center rounded-sm border border-border font-mono text-sm text-foreground outline-none transition-colors hover:border-primary hover:bg-primary hover:text-primary-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50";

export function Pagination({ page, totalPages, sort, category }: Props) {
  if (totalPages <= 1) return null;

  const pages = Array.from({ length: totalPages }, (_, i) => i + 1);

  return (
    <nav
      aria-label="Pagination"
      className="mt-12 flex flex-wrap items-center justify-center gap-2 border-t border-border pt-8"
    >
      {page > 1 && (
        <Link
          href={buildHref(page - 1, sort, category)}
          aria-label="Previous page"
          className={navLinkClasses}
        >
          <span aria-hidden="true">&larr;</span>
          Previous
        </Link>
      )}
      {pages.map((p) =>
        p === page ? (
          <span
            key={p}
            aria-current="page"
            className="flex size-11 items-center justify-center rounded-full bg-accent font-mono text-sm font-bold text-accent-foreground shadow-[inset_0_1px_2px_rgba(0,0,0,0.25)]"
          >
            {p}
          </span>
        ) : (
          <Link
            key={p}
            href={buildHref(p, sort, category)}
            className={pageLinkClasses}
          >
            {p}
          </Link>
        ),
      )}
      {page < totalPages && (
        <Link
          href={buildHref(page + 1, sort, category)}
          aria-label="Next page"
          className={navLinkClasses}
        >
          Next
          <span aria-hidden="true">&rarr;</span>
        </Link>
      )}
    </nav>
  );
}
