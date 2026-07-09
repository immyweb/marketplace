import { Fragment } from "react";
import Link from "next/link";

const FOOTER_LINKS = [
  { href: "/terms", label: "Terms & Conditions" },
  { href: "/privacy", label: "Privacy Notice" },
  { href: "/cookies", label: "Cookies" },
  { href: "/sustainability", label: "Sustainability" },
  { href: "/accessibility", label: "Accessibility" },
  { href: "/reviews-policy", label: "Reviews Policy" },
] as const;

export function Footer() {
  return (
    <footer className="bg-primary bg-[repeating-linear-gradient(135deg,rgba(245,241,230,0.05)_0px,rgba(245,241,230,0.05)_1px,transparent_1px,transparent_11px)] text-primary-foreground">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <p className="font-display text-lg font-bold tracking-wide uppercase">
              Marketplace <span className="text-accent">·</span> Goods
            </p>
            <p className="mt-2 max-w-sm text-sm text-primary-foreground/70">
              Quality clothing and accessories, delivered to your door.
            </p>
          </div>
          <div className="-rotate-2 rounded-sm border-2 border-secondary bg-card px-3 py-1 font-mono text-xs font-bold tracking-widest text-secondary uppercase">
            © {new Date().getFullYear()} Marketplace
          </div>
        </div>

        <nav
          aria-label="Policies"
          className="mt-8 flex flex-wrap items-center gap-x-2 gap-y-2 border-t border-dashed border-primary-foreground/30 pt-6"
        >
          {FOOTER_LINKS.map((link, index) => (
            <Fragment key={link.href}>
              {index > 0 && (
                <span aria-hidden="true" className="text-primary-foreground/40">
                  ·
                </span>
              )}
              <Link
                href={link.href}
                className="font-mono text-xs tracking-widest text-primary-foreground/80 uppercase hover:text-accent"
              >
                {link.label}
              </Link>
            </Fragment>
          ))}
        </nav>
      </div>
    </footer>
  );
}
