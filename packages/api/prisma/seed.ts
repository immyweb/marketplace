import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { config } from "dotenv";
import { resolve } from "node:path";

config({ path: resolve(__dirname, "../.env") });

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  await prisma.product.deleteMany();
  await prisma.product.createMany({
    data: [
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
    ],
  });
  console.log("Seeded 6 products");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
