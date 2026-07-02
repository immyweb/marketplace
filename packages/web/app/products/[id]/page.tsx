import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ApiRequestError, fetchProduct } from "@/lib/api";
import { ProductGallery } from "@/components/product-gallery";
import { AddToCartButton } from "@/components/add-to-cart-button";

interface Props {
  params: Promise<{ id: string }>;
}

async function fetchProductOrNotFound(id: number) {
  try {
    return await fetchProduct(id);
  } catch (err) {
    if (err instanceof ApiRequestError && err.status === 404) return null;
    throw err;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const product = await fetchProductOrNotFound(parseInt(id, 10));
  if (!product) return {};
  return {
    title: product.name,
    description: product.description,
    openGraph: {
      title: product.name,
      description: product.description,
      images: [product.primary_image],
    },
  };
}

export default async function ProductDetailPage({ params }: Props) {
  const { id } = await params;
  const product = await fetchProductOrNotFound(parseInt(id, 10));

  if (!product) notFound();

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

  return (
    <>
      <article aria-label={product.name} className="grid gap-8 sm:grid-cols-2">
        <ProductGallery
          images={product.image_urls}
          productName={product.name}
        />
        <div>
          <h1 className="text-2xl font-semibold">{product.name}</h1>
          <p className="mt-2 text-muted-foreground">{product.description}</p>
          <p
            aria-label={`Price: ${product.currency} ${product.unit_price.toFixed(2)}`}
            className="mt-4 text-lg font-medium"
          >
            {product.currency === "GBP" ? "£" : product.currency}
            {product.unit_price.toFixed(2)}
          </p>
          <AddToCartButton productId={product.id} />
        </div>
      </article>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    </>
  );
}
