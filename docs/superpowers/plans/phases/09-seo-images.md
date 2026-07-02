> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Phase 9 — SEO & Images** | [link to overview](../2026-06-30-marketplace.md)

**Global Constraints:** See [overview](../2026-06-30-marketplace.md#global-constraints) — all constraints apply here.

---

## Phase 9 — SEO & Images

### Task 24: Image Optimization

**Files:**

- Modify: `packages/web/next.config.ts` (add image formats — already done in Task 5)
- Audit: `packages/web/components/product-card.tsx`, `packages/web/components/product-gallery.tsx`, `packages/web/components/cart-item-row.tsx`

> Next.js `<Image>` already handles AVIF/WebP via the `formats` config set in Task 5. This task verifies correct `sizes`, `priority`, and `loading` attributes are set on all images.

- [ ] **Step 1: Audit all `<Image>` usages**

Check each file against these rules:

- PLP (`product-card.tsx`): `sizes` set for responsive grid ✓ (set in Task 16)
- PDP (`product-gallery.tsx`): primary image has `priority` ✓ (set in Task 17)
- Cart (`cart-item-row.tsx`): thumbnail images — add explicit `width/height` and no `priority`

In `packages/web/components/cart-item-row.tsx`, confirm the `<Image>` has:

```typescript
<Image
  src={item.product.primary_image}
  alt={item.product.name}
  width={80}
  height={80}
  style={{ objectFit: 'cover' }}
/>
```

No `priority` needed here — cart thumbnails are not LCP candidates.

- [ ] **Step 2: Add `sizes` to PDP gallery thumbnails in `packages/web/components/product-gallery.tsx`**

The thumbnail buttons currently have `width={80} height={80}`. Add `sizes="80px"` to prevent the browser fetching a larger image:

```typescript
<Image
  src={src}
  alt={`${productName} view ${i + 1}`}
  width={80}
  height={80}
  sizes="80px"
  style={{ objectFit: 'cover' }}
/>
```

- [ ] **Step 3: Verify AVIF/WebP delivery**

Start both servers. Open browser DevTools → Network → filter by `Img`. Reload `/`. Confirm image requests have `Accept: image/avif,image/webp` header and the response `Content-Type` is `image/webp` or `image/avif`.

- [ ] **Step 4: Commit**

```bash
git add packages/web/components/product-gallery.tsx
git commit -m "perf: add correct sizes attribute to PDP thumbnail images"
```

---

### Task 25: SEO — Metadata, JSON-LD, and Sitemap

**Files:**

- Modify: `packages/web/app/layout.tsx` (add base OG metadata)
- Modify: `packages/web/app/page.tsx` (already has metadata — add OG)
- Modify: `packages/web/app/products/[id]/page.tsx` (already has metadata + OG — add JSON-LD)
- Create: `packages/web/app/sitemap.ts`

**Interfaces:**

- Produces: `GET /sitemap.xml` — lists PLP and all PDP URLs for crawlers

- [ ] **Step 1: Add base Open Graph metadata to `packages/web/app/layout.tsx`**

Update the `metadata` export:

```typescript
export const metadata: Metadata = {
  title: { default: "Marketplace", template: "%s | Marketplace" },
  description: "Quality clothing and accessories, delivered to your door.",
  openGraph: {
    siteName: "Marketplace",
    locale: "en_GB",
    type: "website",
  },
};
```

- [ ] **Step 2: Add JSON-LD structured data to `packages/web/app/products/[id]/page.tsx`**

Add a `<script>` tag inside the returned JSX with Product schema:

```typescript
const jsonLd = {
  "@context": "https://schema.org",
  "@type": "Product",
  name: product.name,
  description: product.description,
  image: product.image_urls,
  offers: {
    "@type": "Offer",
    priceCurrency: product.currency,
    price: product.unit_price.toFixed(2),
    availability: "https://schema.org/InStock",
    seller: { "@type": "Organization", name: "Marketplace" },
  },
};
```

Add inside the returned JSX (after `<article>`):

```typescript
<script
  type="application/ld+json"
  dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
/>
```

- [ ] **Step 3: Create `packages/web/app/sitemap.ts`**

```typescript
import type { MetadataRoute } from "next";
import { fetchProducts } from "@/lib/api";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  const { results } = await fetchProducts();

  const productUrls: MetadataRoute.Sitemap = results.map((product) => ({
    url: `${BASE_URL}/products/${product.id}`,
    lastModified: new Date(),
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  return [
    {
      url: BASE_URL,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
    ...productUrls,
  ];
}
```

Add `NEXT_PUBLIC_SITE_URL=http://localhost:3000` to `packages/web/.env.local`.

- [ ] **Step 4: Verify**

```bash
curl http://localhost:3000/sitemap.xml
```

Expected: XML with URLs for `/` and `/products/1` through `/products/6`.
