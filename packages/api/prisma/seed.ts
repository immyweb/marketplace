import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { config } from "dotenv";
import { resolve } from "node:path";
import { PRODUCT_CATEGORIES, type ProductCategory } from "@marketplace/core";
import { embedText } from "../src/shared/embeddings/embeddings.service";

config({ path: resolve(__dirname, "../.env") });

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const CATEGORY_BY_NAME: Record<string, ProductCategory> = {
  "Classic White T-Shirt": "Tops",
  "Navy Chino Trousers": "Trousers",
  "Merino Wool Jumper": "Knitwear",
  "Leather Chelsea Boots": "Footwear",
  "Canvas Tote Bag": "Accessories",
  "Slim Leather Belt": "Accessories",
  "Oxford Cotton Shirt": "Tops",
  "Merino Crew Socks (3-Pack)": "Accessories",
  "Waxed Cotton Jacket": "Outerwear",
  "Grey Marl Sweatshirt": "Tops",
  "Selvedge Denim Jeans": "Trousers",
  "Suede Derby Shoes": "Footwear",
  "Cashmere Scarf": "Accessories",
  "Corduroy Trousers": "Trousers",
  "Quilted Gilet": "Outerwear",
  "Linen Short-Sleeve Shirt": "Tops",
  "Leather Card Holder": "Accessories",
  "Wool Flat Cap": "Accessories",
  "Cable Knit Cardigan": "Knitwear",
  "Canvas Weekender Bag": "Accessories",
  "Striped Breton Top": "Tops",
  "Suede Chukka Boots": "Footwear",
  "Merino Beanie": "Accessories",
  "Signet Cufflinks": "Accessories",
};

function mulberry32(seed: number) {
  return function random() {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type GeneratedProduct = {
  name: string;
  description: string;
  primary_image: string;
  image_urls: string[];
  unit_price: number;
  currency: string;
  category: ProductCategory;
};

const CATEGORY_WORDS: Record<
  ProductCategory,
  {
    descriptors: string[];
    styles: string[];
    items: string[];
    hex: string;
    priceRange: [number, number];
  }
> = {
  Tops: {
    descriptors: ["Cotton", "Organic Cotton", "Jersey", "Poplin"],
    styles: ["Crew Neck", "V-Neck", "Button-Down", "Relaxed Fit"],
    items: ["T-Shirt"],
    hex: "e8e2d0/333",
    priceRange: [15, 45],
  },
  Trousers: {
    descriptors: [
      "Cotton Twill",
      "Stretch Cotton",
      "Brushed Cotton",
      "Technical",
    ],
    styles: ["Slim Fit", "Straight Leg", "Tapered", "Relaxed"],
    items: ["Trousers"],
    hex: "1a2744/f5f5f5",
    priceRange: [30, 70],
  },
  Knitwear: {
    descriptors: ["Merino Wool", "Lambswool", "Cashmere", "Shetland Wool"],
    styles: ["Crew Neck", "V-Neck", "Zip-Through", "Roll Neck"],
    items: ["Jumper", "Cardigan"],
    hex: "8b4513/f5f5f5",
    priceRange: [35, 90],
  },
  Outerwear: {
    descriptors: ["Waxed Cotton", "Quilted", "Wool Blend", "Technical Shell"],
    styles: ["Field", "Bomber", "Overshirt", "Parka"],
    items: ["Jacket", "Coat"],
    hex: "2f3b2c/f5f1e6",
    priceRange: [60, 180],
  },
  Footwear: {
    descriptors: ["Leather", "Suede", "Nubuck", "Waxed Leather"],
    styles: ["Chelsea", "Derby", "Chukka", "Oxford"],
    items: ["Boots", "Shoes"],
    hex: "2c1810/f5f5f5",
    priceRange: [45, 140],
  },
  Accessories: {
    descriptors: ["Leather", "Canvas", "Wool", "Silk"],
    styles: ["Classic", "Woven", "Quilted", "Textured"],
    items: ["Belt", "Scarf", "Card Holder", "Tote Bag"],
    hex: "5c3d2e/f5f5f5",
    priceRange: [12, 60],
  },
};

const COLORS = [
  "Black",
  "Navy",
  "Charcoal",
  "Stone",
  "Olive",
  "Tan",
  "Burgundy",
  "Ivory",
];

const GENERATED_COUNTS: Record<ProductCategory, number> = {
  Tops: 13,
  Trousers: 13,
  Knitwear: 13,
  Outerwear: 12,
  Footwear: 13,
  Accessories: 12,
};

function generateProducts(): GeneratedProduct[] {
  const rng = mulberry32(42);
  const products: GeneratedProduct[] = [];
  let colorIndex = 0;

  for (const category of PRODUCT_CATEGORIES) {
    const { descriptors, styles, items, hex, priceRange } =
      CATEGORY_WORDS[category];
    const count = GENERATED_COUNTS[category];
    let added = 0;

    outer: for (const descriptor of descriptors) {
      for (const style of styles) {
        for (const item of items) {
          if (added >= count) break outer;

          const color = COLORS[colorIndex % COLORS.length];
          colorIndex++;
          const name = `${color} ${descriptor} ${style} ${item}`;
          const [min, max] = priceRange;
          const unit_price =
            Math.round((min + rng() * (max - min)) * 100) / 100;
          const image = `https://placehold.co/800x800/${hex}.png?text=${encodeURIComponent(name)}`;

          products.push({
            name,
            description: `${name}. A versatile addition to the ${category.toLowerCase()} collection.`,
            primary_image: image,
            image_urls: [image],
            unit_price,
            currency: "GBP",
            category,
          });

          added++;
        }
      }
    }
  }

  return products;
}

async function main() {
  await prisma.cartItem.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.product.deleteMany();
  await prisma.$executeRaw`ALTER SEQUENCE products_id_seq RESTART WITH 1`;

  const existingProducts = [
    {
      name: "Classic White T-Shirt",
      description:
        "A wardrobe essential. 100% organic cotton, preshrunk, relaxed fit.",
      primary_image:
        "https://placehold.co/800x800/f5f5f5/333.png?text=White+T-Shirt",
      image_urls: [
        "https://placehold.co/800x800/f5f5f5/333.png?text=White+T-Shirt",
        "https://placehold.co/800x800/f5f5f5/333.png?text=White+T-Shirt+Back",
      ],
      unit_price: 18.99,
      currency: "GBP",
    },
    {
      name: "Navy Chino Trousers",
      description:
        "Slim fit chinos in a versatile navy. Suitable for smart-casual occasions.",
      primary_image:
        "https://placehold.co/800x800/1a2744/f5f5f5.png?text=Navy+Chinos",
      image_urls: [
        "https://placehold.co/800x800/1a2744/f5f5f5.png?text=Navy+Chinos",
        "https://placehold.co/800x800/1a2744/f5f5f5.png?text=Navy+Chinos+Detail",
      ],
      unit_price: 42.0,
      currency: "GBP",
    },
    {
      name: "Merino Wool Jumper",
      description:
        "Fine merino wool. Temperature-regulating and machine washable.",
      primary_image:
        "https://placehold.co/800x800/8b4513/f5f5f5.png?text=Merino+Jumper",
      image_urls: [
        "https://placehold.co/800x800/8b4513/f5f5f5.png?text=Merino+Jumper",
        "https://placehold.co/800x800/8b4513/f5f5f5.png?text=Merino+Detail",
      ],
      unit_price: 65.0,
      currency: "GBP",
    },
    {
      name: "Leather Chelsea Boots",
      description:
        "Full-grain leather upper, elastic side panels, leather sole.",
      primary_image:
        "https://placehold.co/800x800/2c1810/f5f5f5.png?text=Chelsea+Boots",
      image_urls: [
        "https://placehold.co/800x800/2c1810/f5f5f5.png?text=Chelsea+Boots",
        "https://placehold.co/800x800/2c1810/f5f5f5.png?text=Boots+Side",
      ],
      unit_price: 120.0,
      currency: "GBP",
    },
    {
      name: "Canvas Tote Bag",
      description:
        "Heavy-duty canvas tote with internal zip pocket. 20L capacity.",
      primary_image:
        "https://placehold.co/800x800/d4c5a9/333.png?text=Tote+Bag",
      image_urls: [
        "https://placehold.co/800x800/d4c5a9/333.png?text=Tote+Bag",
        "https://placehold.co/800x800/d4c5a9/333.png?text=Tote+Interior",
      ],
      unit_price: 24.99,
      currency: "GBP",
    },
    {
      name: "Slim Leather Belt",
      description:
        "Vegetable-tanned leather belt. 30mm width. Solid brass buckle.",
      primary_image:
        "https://placehold.co/800x800/5c3d2e/f5f5f5.png?text=Leather+Belt",
      image_urls: [
        "https://placehold.co/800x800/5c3d2e/f5f5f5.png?text=Leather+Belt",
        "https://placehold.co/800x800/5c3d2e/f5f5f5.png?text=Belt+Buckle",
      ],
      unit_price: 34.99,
      currency: "GBP",
    },
    {
      name: "Oxford Cotton Shirt",
      description:
        "Brushed cotton oxford weave. Button-down collar, regular fit.",
      primary_image:
        "https://placehold.co/800x800/b8cfe0/1a2744.png?text=Oxford+Shirt",
      image_urls: [
        "https://placehold.co/800x800/b8cfe0/1a2744.png?text=Oxford+Shirt",
        "https://placehold.co/800x800/b8cfe0/1a2744.png?text=Oxford+Detail",
      ],
      unit_price: 38.0,
      currency: "GBP",
    },
    {
      name: "Merino Crew Socks (3-Pack)",
      description:
        "Cushioned sole, ribbed cuff. Three pairs in charcoal, navy, and oatmeal.",
      primary_image:
        "https://placehold.co/800x800/4a4a4a/f5f5f5.png?text=Wool+Socks",
      image_urls: [
        "https://placehold.co/800x800/4a4a4a/f5f5f5.png?text=Wool+Socks",
        "https://placehold.co/800x800/4a4a4a/f5f5f5.png?text=Socks+Pack",
      ],
      unit_price: 14.99,
      currency: "GBP",
    },
    {
      name: "Waxed Cotton Jacket",
      description:
        "British waxed cotton, corduroy collar. Showerproof and windproof.",
      primary_image:
        "https://placehold.co/800x800/2f3b2c/f5f1e6.png?text=Waxed+Jacket",
      image_urls: [
        "https://placehold.co/800x800/2f3b2c/f5f1e6.png?text=Waxed+Jacket",
        "https://placehold.co/800x800/2f3b2c/f5f1e6.png?text=Jacket+Collar",
      ],
      unit_price: 145.0,
      currency: "GBP",
    },
    {
      name: "Grey Marl Sweatshirt",
      description: "Heavyweight loopback cotton. Ribbed hem and cuffs.",
      primary_image:
        "https://placehold.co/800x800/8a8a8a/f5f5f5.png?text=Grey+Sweatshirt",
      image_urls: [
        "https://placehold.co/800x800/8a8a8a/f5f5f5.png?text=Grey+Sweatshirt",
        "https://placehold.co/800x800/8a8a8a/f5f5f5.png?text=Sweatshirt+Detail",
      ],
      unit_price: 32.0,
      currency: "GBP",
    },
    {
      name: "Selvedge Denim Jeans",
      description: "13oz Japanese selvedge denim. Straight fit, button fly.",
      primary_image:
        "https://placehold.co/800x800/2c3e5c/f5f5f5.png?text=Denim+Jeans",
      image_urls: [
        "https://placehold.co/800x800/2c3e5c/f5f5f5.png?text=Denim+Jeans",
        "https://placehold.co/800x800/2c3e5c/f5f5f5.png?text=Selvedge+Detail",
      ],
      unit_price: 78.0,
      currency: "GBP",
    },
    {
      name: "Suede Derby Shoes",
      description: "Soft suede upper, leather sole. Five-eyelet lacing.",
      primary_image:
        "https://placehold.co/800x800/6b4423/f5f5f5.png?text=Derby+Shoes",
      image_urls: [
        "https://placehold.co/800x800/6b4423/f5f5f5.png?text=Derby+Shoes",
        "https://placehold.co/800x800/6b4423/f5f5f5.png?text=Shoes+Side",
      ],
      unit_price: 110.0,
      currency: "GBP",
    },
    {
      name: "Cashmere Scarf",
      description: "Pure cashmere, woven in Scotland. 180cm length.",
      primary_image:
        "https://placehold.co/800x800/c9a876/333.png?text=Cashmere+Scarf",
      image_urls: [
        "https://placehold.co/800x800/c9a876/333.png?text=Cashmere+Scarf",
        "https://placehold.co/800x800/c9a876/333.png?text=Scarf+Weave",
      ],
      unit_price: 55.0,
      currency: "GBP",
    },
    {
      name: "Corduroy Trousers",
      description: "8-wale cotton corduroy. Tapered fit, side-adjuster waist.",
      primary_image:
        "https://placehold.co/800x800/6b5842/f5f5f5.png?text=Corduroy+Trousers",
      image_urls: [
        "https://placehold.co/800x800/6b5842/f5f5f5.png?text=Corduroy+Trousers",
        "https://placehold.co/800x800/6b5842/f5f5f5.png?text=Corduroy+Detail",
      ],
      unit_price: 48.0,
      currency: "GBP",
    },
    {
      name: "Quilted Gilet",
      description:
        "Diamond-quilted shell, recycled fill. Zip and popper front.",
      primary_image:
        "https://placehold.co/800x800/3c4a3a/f5f1e6.png?text=Quilted+Gilet",
      image_urls: [
        "https://placehold.co/800x800/3c4a3a/f5f1e6.png?text=Quilted+Gilet",
        "https://placehold.co/800x800/3c4a3a/f5f1e6.png?text=Gilet+Detail",
      ],
      unit_price: 68.0,
      currency: "GBP",
    },
    {
      name: "Linen Short-Sleeve Shirt",
      description: "European linen, garment-washed for softness. Relaxed fit.",
      primary_image:
        "https://placehold.co/800x800/e8e2d0/333.png?text=Linen+Shirt",
      image_urls: [
        "https://placehold.co/800x800/e8e2d0/333.png?text=Linen+Shirt",
        "https://placehold.co/800x800/e8e2d0/333.png?text=Linen+Detail",
      ],
      unit_price: 36.0,
      currency: "GBP",
    },
    {
      name: "Leather Card Holder",
      description: "Vegetable-tanned leather. Four card slots, slim profile.",
      primary_image:
        "https://placehold.co/800x800/4a2f1f/f5f5f5.png?text=Card+Holder",
      image_urls: [
        "https://placehold.co/800x800/4a2f1f/f5f5f5.png?text=Card+Holder",
        "https://placehold.co/800x800/4a2f1f/f5f5f5.png?text=Card+Slots",
      ],
      unit_price: 22.0,
      currency: "GBP",
    },
    {
      name: "Wool Flat Cap",
      description:
        "Harris Tweed wool, satin lining. One size, adjustable band.",
      primary_image:
        "https://placehold.co/800x800/3d3d3d/f5f5f5.png?text=Flat+Cap",
      image_urls: [
        "https://placehold.co/800x800/3d3d3d/f5f5f5.png?text=Flat+Cap",
        "https://placehold.co/800x800/3d3d3d/f5f5f5.png?text=Cap+Detail",
      ],
      unit_price: 28.0,
      currency: "GBP",
    },
    {
      name: "Cable Knit Cardigan",
      description: "Lambswool cable knit. Horn buttons, ribbed collar.",
      primary_image:
        "https://placehold.co/800x800/9c7a3e/333.png?text=Cable+Cardigan",
      image_urls: [
        "https://placehold.co/800x800/9c7a3e/333.png?text=Cable+Cardigan",
        "https://placehold.co/800x800/9c7a3e/333.png?text=Cardigan+Detail",
      ],
      unit_price: 72.0,
      currency: "GBP",
    },
    {
      name: "Canvas Weekender Bag",
      description:
        "Waxed canvas and leather trim. 45L capacity, detachable strap.",
      primary_image:
        "https://placehold.co/800x800/d4c5a9/333.png?text=Weekender+Bag",
      image_urls: [
        "https://placehold.co/800x800/d4c5a9/333.png?text=Weekender+Bag",
        "https://placehold.co/800x800/d4c5a9/333.png?text=Bag+Interior",
      ],
      unit_price: 58.0,
      currency: "GBP",
    },
    {
      name: "Striped Breton Top",
      description:
        "Cotton jersey, Breton stripe. Boat neck, three-quarter sleeve.",
      primary_image:
        "https://placehold.co/800x800/f5f5f5/1a2744.png?text=Breton+Top",
      image_urls: [
        "https://placehold.co/800x800/f5f5f5/1a2744.png?text=Breton+Top",
        "https://placehold.co/800x800/f5f5f5/1a2744.png?text=Breton+Detail",
      ],
      unit_price: 29.99,
      currency: "GBP",
    },
    {
      name: "Suede Chukka Boots",
      description: "Suede upper, crepe sole. Two-eyelet chukka silhouette.",
      primary_image:
        "https://placehold.co/800x800/8b5a2b/f5f5f5.png?text=Chukka+Boots",
      image_urls: [
        "https://placehold.co/800x800/8b5a2b/f5f5f5.png?text=Chukka+Boots",
        "https://placehold.co/800x800/8b5a2b/f5f5f5.png?text=Boots+Side",
      ],
      unit_price: 95.0,
      currency: "GBP",
    },
    {
      name: "Merino Beanie",
      description: "Fine merino rib knit. Turn-up cuff, one size.",
      primary_image:
        "https://placehold.co/800x800/5c3d2e/f5f1e6.png?text=Merino+Beanie",
      image_urls: [
        "https://placehold.co/800x800/5c3d2e/f5f1e6.png?text=Merino+Beanie",
        "https://placehold.co/800x800/5c3d2e/f5f1e6.png?text=Beanie+Detail",
      ],
      unit_price: 19.99,
      currency: "GBP",
    },
    {
      name: "Signet Cufflinks",
      description:
        "Brushed brass, engravable face. Presented in a canvas pouch.",
      primary_image:
        "https://placehold.co/800x800/b98a44/26231f.png?text=Cufflinks",
      image_urls: [
        "https://placehold.co/800x800/b98a44/26231f.png?text=Cufflinks",
        "https://placehold.co/800x800/b98a44/26231f.png?text=Cufflinks+Case",
      ],
      unit_price: 26.0,
      currency: "GBP",
    },
  ];

  const generated = generateProducts();

  await prisma.product.createMany({
    data: [
      ...existingProducts.map((p) => ({
        ...p,
        category: CATEGORY_BY_NAME[p.name],
      })),
      ...generated,
    ],
  });

  console.log(`Seeded ${existingProducts.length + generated.length} products`);

  const insertedProducts = await prisma.product.findMany({
    select: { id: true, name: true, description: true, category: true },
  });

  for (const product of insertedProducts) {
    const embedding = await embedText(
      `${product.name}. ${product.description}. Category: ${product.category}.`,
    );
    const vectorLiteral = `[${embedding.join(",")}]`;
    await prisma.$executeRaw`UPDATE products SET embedding = ${vectorLiteral}::vector WHERE id = ${product.id}`;
  }

  console.log(`Embedded ${insertedProducts.length} products`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
