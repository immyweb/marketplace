import type { Metadata } from "next";
import { getFooterPage } from "@/lib/contentful";
import { RichText } from "@/components/rich-text";
import { FooterPageShell } from "@/components/footer-page-shell";

export const metadata: Metadata = { title: "Accessibility" };

export default async function AccessibilityPage() {
  const page = await getFooterPage("accessibility");

  return (
    <FooterPageShell
      slug="accessibility"
      title={page?.title ?? "Accessibility"}
    >
      {page ? (
        <RichText document={page.body} />
      ) : (
        <p className="mt-8 text-muted-foreground">Content coming soon.</p>
      )}
    </FooterPageShell>
  );
}
