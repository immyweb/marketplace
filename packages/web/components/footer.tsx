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
    <footer className="bg-primary text-primary-foreground">
      <div className="mx-auto flex max-w-6xl flex-wrap gap-x-6 gap-y-2 px-4 py-4 sm:px-6">
        {FOOTER_LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="font-mono text-sm tracking-wide uppercase hover:text-accent"
          >
            {link.label}
          </Link>
        ))}
      </div>
    </footer>
  );
}
