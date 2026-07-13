import Link from "next/link";
import { FOOTER_LINKS } from "@/lib/footer-links";
import { cn } from "@/lib/utils";

function slugFromHref(href: string) {
  return href.slice(1);
}

function ordinal(n: number) {
  return String(n).padStart(2, "0");
}

export function FooterPageShell({
  slug,
  title,
  children,
}: {
  slug: string;
  title: string;
  children: React.ReactNode;
}) {
  const index = FOOTER_LINKS.findIndex(
    (link) => slugFromHref(link.href) === slug,
  );

  return (
    <div className="sm:grid sm:grid-cols-[11rem_1fr] sm:gap-10">
      <nav
        aria-label="Related policies"
        className="-mx-4 flex divide-x divide-dashed divide-border overflow-x-auto border-b border-dashed border-border px-4 pb-3 sm:sticky sm:top-24 sm:mx-0 sm:h-fit sm:flex-col sm:divide-x-0 sm:divide-y sm:self-start sm:overflow-visible sm:border-b-0 sm:px-0 sm:pb-0"
      >
        {FOOTER_LINKS.map((link, i) => {
          const current = slugFromHref(link.href) === slug;
          return (
            <Link
              key={link.href}
              href={link.href}
              aria-current={current ? "page" : undefined}
              className={cn(
                "flex shrink-0 items-start gap-2 px-3 py-2 font-mono text-xs uppercase",
                current
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-accent",
              )}
            >
              <span className="tracking-widest">{ordinal(i + 1)}</span>
              <span className="tracking-wide leading-snug">{link.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-8 sm:mt-0">
        <p className="font-mono text-xs tracking-widest text-secondary uppercase">
          Policy {ordinal(index + 1)} of {ordinal(FOOTER_LINKS.length)}
        </p>
        <h1 className="mt-2 text-3xl sm:text-4xl">{title}</h1>
        <hr className="mt-6 border-t border-dashed border-border" />
        {children}
      </div>
    </div>
  );
}
