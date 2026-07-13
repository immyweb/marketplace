import type { Metadata } from "next";
import { getFooterPage } from "@/lib/contentful";
import { RichText } from "@/components/rich-text";
import { FooterPageShell } from "@/components/footer-page-shell";

export const metadata: Metadata = { title: "Sustainability" };

export default async function SustainabilityPage() {
  const page = await getFooterPage("sustainability");

  return (
    <FooterPageShell
      slug="sustainability"
      title={page?.title ?? "Sustainability"}
    >
      {page ? (
        <RichText document={page.body} />
      ) : (
        <p className="mt-8 text-muted-foreground">Content coming soon.</p>
      )}
    </FooterPageShell>
  );
}
