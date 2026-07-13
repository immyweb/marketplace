import type { Document } from "@contentful/rich-text-types";

export type FooterPage = { title: string; body: Document };

export async function getFooterPage(slug: string): Promise<FooterPage | null> {
  try {
    const url = `https://cdn.contentful.com/spaces/${process.env.CONTENTFUL_SPACE_ID}/environments/master/entries?content_type=footerPage&fields.slug=${slug}&limit=1`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${process.env.CONTENTFUL_ACCESS_TOKEN}`,
      },
      next: { revalidate: 60 },
    });

    if (!res.ok) return null;

    const data = await res.json();
    const entry = data.items?.[0];
    return entry
      ? { title: entry.fields.title, body: entry.fields.body }
      : null;
  } catch {
    return null;
  }
}
