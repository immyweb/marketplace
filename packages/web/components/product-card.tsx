import Image from "next/image";
import Link from "next/link";

interface Props {
  id: number;
  name: string;
  primary_image: string;
  unit_price: number;
  currency: string;
  eager?: boolean;
}

export function ProductCard({
  id,
  name,
  primary_image,
  unit_price,
  currency,
  eager = false,
}: Props) {
  const price = `${currency === "GBP" ? "£" : currency}${unit_price.toFixed(2)}`;
  const priceLabel = `Price: ${currency} ${unit_price.toFixed(2)}`;

  return (
    <article>
      <Link href={`/products/${id}`} className="group block">
        <Image
          src={primary_image}
          alt={name}
          width={400}
          height={400}
          loading={eager ? "eager" : "lazy"}
          sizes="(max-width: 640px) 50vw, 33vw"
          className="aspect-square w-full rounded-sm object-cover"
        />
        <h2 className="mt-3 truncate font-sans text-sm font-medium normal-case tracking-normal group-hover:text-secondary">
          {name}
        </h2>
        <p
          aria-label={priceLabel}
          className="mt-1 font-mono text-sm text-secondary"
        >
          {price}
        </p>
      </Link>
    </article>
  );
}
