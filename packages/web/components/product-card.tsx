import Image from "next/image";
import Link from "next/link";

interface Props {
  id: number;
  name: string;
  primary_image: string;
  unit_price: number;
  currency: string;
}

export function ProductCard({
  id,
  name,
  primary_image,
  unit_price,
  currency,
}: Props) {
  return (
    <article>
      <Link href={`/products/${id}`}>
        <Image
          src={primary_image}
          alt={name}
          width={400}
          height={400}
          // No pagination (all products render in one grid), so any card
          // can end up being the browser's actual LCP element depending on
          // load timing — eager-load them all rather than guess which.
          loading="eager"
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          className="aspect-square w-full rounded-md object-cover"
        />
        <h2 className="mt-3 text-sm font-medium">{name}</h2>
        <p
          aria-label={`Price: ${currency} ${unit_price.toFixed(2)}`}
          className="mt-1 text-sm text-muted-foreground"
        >
          {currency === "GBP" ? "£" : currency}
          {unit_price.toFixed(2)}
        </p>
      </Link>
    </article>
  );
}
