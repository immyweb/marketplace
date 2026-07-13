import type { Metadata } from "next";
import { getFooterPage } from "@/lib/contentful";
import { RichText } from "@/components/rich-text";
import { FooterPageShell } from "@/components/footer-page-shell";

export const metadata: Metadata = { title: "Reviews Policy" };

export default async function ReviewsPolicyPage() {
  const page = await getFooterPage("reviews-policy");

  return (
    <FooterPageShell
      slug="reviews-policy"
      title={page?.title ?? "Reviews Policy"}
    >
      {page ? (
        <RichText document={page.body} />
      ) : (
        <p className="mt-8 text-muted-foreground">Content coming soon.</p>
      )}
    </FooterPageShell>
  );
}
