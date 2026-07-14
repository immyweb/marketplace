import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import request from "supertest";
import { app } from "@/app";
import { prisma } from "@/shared/db/prisma";
import { embedText } from "@/shared/embeddings/embeddings.service";

vi.mock("@/shared/embeddings/embeddings.service", () => ({
  embedText: vi.fn(),
}));

async function resetProducts() {
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.cartItem.deleteMany();
  await prisma.cart.deleteMany();
  await prisma.product.deleteMany();
}

afterAll(async () => {
  await resetProducts();
});

describe("GET /products", () => {
  beforeEach(async () => {
    await resetProducts();
    await prisma.product.createMany({
      data: Array.from({ length: 20 }, (_, i) => ({
        name: `Test Product ${i + 1}`,
        description: "A test product",
        primary_image: "https://example.com/img.jpg",
        image_urls: ["https://example.com/img.jpg"],
        unit_price: (i + 1) * 10,
        currency: "GBP",
        category: ["Tops", "Trousers", "Footwear", "Accessories"][i % 4],
      })),
    });
  });

  it("returns the first page with 16 results by default", async () => {
    const res = await request(app).get("/products").expect(200);
    expect(res.body.results).toHaveLength(16);
    expect(res.body.total).toBe(20);
    expect(res.body.page).toBe(1);
    expect(res.body.totalPages).toBe(2);
  });

  it("does not include description or image_urls in listing", async () => {
    const res = await request(app).get("/products").expect(200);
    expect(res.body.results[0]).not.toHaveProperty("description");
    expect(res.body.results[0]).not.toHaveProperty("image_urls");
  });

  it("returns the remaining results on page 2", async () => {
    const res = await request(app).get("/products?page=2").expect(200);
    expect(res.body.results).toHaveLength(4);
    expect(res.body.page).toBe(2);
  });

  it("sorts by price ascending", async () => {
    const res = await request(app).get("/products?sort=price_asc").expect(200);
    const prices = res.body.results.map(
      (p: { unit_price: number }) => p.unit_price,
    );
    expect(prices).toEqual([...prices].sort((a, b) => a - b));
  });

  it("sorts by price descending", async () => {
    const res = await request(app).get("/products?sort=price_desc").expect(200);
    const prices = res.body.results.map(
      (p: { unit_price: number }) => p.unit_price,
    );
    expect(prices).toEqual([...prices].sort((a, b) => b - a));
  });

  it("sorts by category ascending", async () => {
    const res = await request(app).get("/products?sort=category").expect(200);
    const categories = res.body.results.map(
      (p: { category: string }) => p.category,
    );
    expect(categories).toEqual([...categories].sort());
  });

  it("breaks ties on id when sorting by category", async () => {
    const res = await request(app).get("/products?sort=category").expect(200);
    const tops = res.body.results.filter(
      (p: { category: string }) => p.category === "Tops",
    );
    const ids = tops.map((p: { id: number }) => p.id);
    expect(ids).toEqual([...ids].sort((a, b) => a - b));
  });

  it("filters by category", async () => {
    const res = await request(app)
      .get("/products?category=Footwear")
      .expect(200);
    expect(res.body.total).toBe(5);
    for (const product of res.body.results) {
      expect(product.category).toBe("Footwear");
    }
  });

  it("returns 400 for an invalid sort value", async () => {
    const res = await request(app).get("/products?sort=bogus").expect(400);
    expect(res.body).toMatchObject({ code: "INVALID_INPUT" });
  });

  it("returns 400 for an invalid category value", async () => {
    const res = await request(app).get("/products?category=bogus").expect(400);
    expect(res.body).toMatchObject({ code: "INVALID_INPUT" });
  });
});

describe("GET /products?q=", () => {
  beforeEach(async () => {
    await resetProducts();
  });

  function vector(activeIndex: number): number[] {
    const values = new Array(1536).fill(0);
    values[activeIndex] = 1;
    return values;
  }

  it("ranks results by embedding similarity to the query", async () => {
    const closeMatch = await prisma.product.create({
      data: {
        name: "Warm Jacket",
        description: "A cozy winter jacket",
        primary_image: "https://example.com/a.jpg",
        image_urls: ["https://example.com/a.jpg"],
        unit_price: 80,
        currency: "GBP",
        category: "Outerwear",
      },
    });
    const farMatch = await prisma.product.create({
      data: {
        name: "Summer Shorts",
        description: "Light cotton shorts",
        primary_image: "https://example.com/b.jpg",
        image_urls: ["https://example.com/b.jpg"],
        unit_price: 20,
        currency: "GBP",
        category: "Trousers",
      },
    });

    await prisma.$executeRaw`UPDATE products SET embedding = ${`[${vector(0).join(",")}]`}::vector WHERE id = ${closeMatch.id}`;
    await prisma.$executeRaw`UPDATE products SET embedding = ${`[${vector(1).join(",")}]`}::vector WHERE id = ${farMatch.id}`;

    vi.mocked(embedText).mockResolvedValue(vector(0));

    const res = await request(app).get("/products?q=warm+jacket").expect(200);

    expect(res.body.results).toHaveLength(2);
    expect(res.body.results[0].id).toBe(closeMatch.id);
    expect(res.body.results[1].id).toBe(farMatch.id);
    expect(res.body.total).toBe(2);
    expect(embedText).toHaveBeenCalledWith("warm jacket");
  });

  it("excludes products with no embedding", async () => {
    const embedded = await prisma.product.create({
      data: {
        name: "Warm Jacket",
        description: "A cozy winter jacket",
        primary_image: "https://example.com/a.jpg",
        image_urls: ["https://example.com/a.jpg"],
        unit_price: 80,
        currency: "GBP",
        category: "Outerwear",
      },
    });
    await prisma.product.create({
      data: {
        name: "Unembedded Product",
        description: "Never got embedded",
        primary_image: "https://example.com/c.jpg",
        image_urls: ["https://example.com/c.jpg"],
        unit_price: 10,
        currency: "GBP",
        category: "Accessories",
      },
    });

    await prisma.$executeRaw`UPDATE products SET embedding = ${`[${vector(0).join(",")}]`}::vector WHERE id = ${embedded.id}`;

    vi.mocked(embedText).mockResolvedValue(vector(0));

    const res = await request(app).get("/products?q=jacket").expect(200);

    expect(res.body.results).toHaveLength(1);
    expect(res.body.results[0].id).toBe(embedded.id);
    expect(res.body.total).toBe(1);
  });

  it("returns a 500 when the embedding call fails", async () => {
    vi.mocked(embedText).mockRejectedValue(new Error("rate limited"));

    await request(app).get("/products?q=jacket").expect(500);
  });

  it("always returns a single page, even with more embedded products than fit on one page", async () => {
    const products = await Promise.all(
      Array.from({ length: 20 }, (_, i) =>
        prisma.product.create({
          data: {
            name: `Product ${i}`,
            description: "A test product",
            primary_image: `https://example.com/${i}.jpg`,
            image_urls: [`https://example.com/${i}.jpg`],
            unit_price: 10,
            currency: "GBP",
            category: "Accessories",
          },
        }),
      ),
    );

    for (const product of products) {
      await prisma.$executeRaw`UPDATE products SET embedding = ${`[${vector(0).join(",")}]`}::vector WHERE id = ${product.id}`;
    }

    vi.mocked(embedText).mockResolvedValue(vector(0));

    const res = await request(app).get("/products?q=jacket&page=2").expect(200);

    expect(res.body.results).toHaveLength(16);
    expect(res.body.total).toBe(16);
    expect(res.body.page).toBe(1);
    expect(res.body.totalPages).toBe(1);
  });
});

describe("GET /products/:id", () => {
  let productId: number;

  beforeEach(async () => {
    await resetProducts();
    const product = await prisma.product.create({
      data: {
        name: "Test T-Shirt",
        description: "A test product",
        primary_image: "https://example.com/img.jpg",
        image_urls: ["https://example.com/img.jpg"],
        unit_price: 12.99,
        currency: "GBP",
        category: "Tops",
      },
    });
    productId = product.id;
  });

  it("returns full product details", async () => {
    const res = await request(app).get(`/products/${productId}`).expect(200);
    expect(res.body).toMatchObject({
      id: productId,
      name: "Test T-Shirt",
      description: "A test product",
      primary_image: "https://example.com/img.jpg",
      image_urls: ["https://example.com/img.jpg"],
      unit_price: 12.99,
      currency: "GBP",
      category: "Tops",
    });
  });

  it("returns 404 for a non-existent product", async () => {
    const res = await request(app).get("/products/999999").expect(404);
    expect(res.body).toMatchObject({ error: expect.any(String) });
  });
});
