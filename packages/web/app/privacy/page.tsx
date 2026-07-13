import type { Metadata } from "next";
import { getFooterPage } from "@/lib/contentful";
import { RichText } from "@/components/rich-text";
import { FooterPageShell } from "@/components/footer-page-shell";

export const metadata: Metadata = { title: "Privacy Notice" };

export default async function PrivacyPage() {
  const page = await getFooterPage("privacy");

  return (
    <FooterPageShell slug="privacy" title={page?.title ?? "Privacy Notice"}>
      {page ? (
        <RichText document={page.body} />
      ) : (
        <p className="mt-8 text-muted-foreground">Content coming soon.</p>
      )}
    </FooterPageShell>
  );
}
