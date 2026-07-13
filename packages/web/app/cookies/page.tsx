import type { Metadata } from "next";
import { getFooterPage } from "@/lib/contentful";
import { RichText } from "@/components/rich-text";
import { FooterPageShell } from "@/components/footer-page-shell";

export const metadata: Metadata = { title: "Cookies" };

export default async function CookiesPage() {
  const page = await getFooterPage("cookies");

  return (
    <FooterPageShell slug="cookies" title={page?.title ?? "Cookies"}>
      {page ? (
        <RichText document={page.body} />
      ) : (
        <p className="mt-8 text-muted-foreground">Content coming soon.</p>
      )}
    </FooterPageShell>
  );
}
