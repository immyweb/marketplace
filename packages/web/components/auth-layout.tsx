import type { ReactNode } from "react";

interface Props {
  eyebrow: string;
  headline: string;
  supportText: string;
  stamp?: string;
  children: ReactNode;
}

function CornerRivets() {
  return (
    <>
      <span
        aria-hidden="true"
        className="absolute top-3 left-3 h-1.5 w-1.5 rounded-full bg-accent"
      />
      <span
        aria-hidden="true"
        className="absolute top-3 right-3 h-1.5 w-1.5 rounded-full bg-accent"
      />
      <span
        aria-hidden="true"
        className="absolute bottom-3 left-3 h-1.5 w-1.5 rounded-full bg-accent"
      />
      <span
        aria-hidden="true"
        className="absolute right-3 bottom-3 h-1.5 w-1.5 rounded-full bg-accent"
      />
    </>
  );
}

export function AuthLayout({
  eyebrow,
  headline,
  supportText,
  stamp,
  children,
}: Props) {
  return (
    <div className="grid items-stretch gap-6 sm:grid-cols-2 sm:gap-10">
      <div className="relative flex flex-col overflow-hidden rounded-sm bg-primary bg-[repeating-linear-gradient(135deg,rgba(245,241,230,0.05)_0px,rgba(245,241,230,0.05)_1px,transparent_1px,transparent_11px)] px-8 py-10 text-primary-foreground sm:py-12">
        <CornerRivets />
        <p className="font-mono text-xs font-bold tracking-widest text-primary-foreground/70 uppercase">
          {eyebrow}
        </p>
        <h1 className="mt-4 text-3xl sm:text-4xl">{headline}</h1>
        <p className="mt-4 max-w-xs text-sm leading-relaxed text-primary-foreground/70">
          {supportText}
        </p>
        {stamp && (
          <div
            aria-hidden="true"
            className="mt-8 -rotate-6 self-end rounded-sm border-2 border-secondary bg-card px-3 py-1 font-mono text-xs font-bold tracking-widest text-secondary uppercase sm:mt-auto"
          >
            {stamp}
          </div>
        )}
      </div>
      <div className="relative rounded-sm border border-border bg-card px-6 py-8 sm:px-8 sm:py-10">
        <CornerRivets />
        {children}
      </div>
    </div>
  );
}
