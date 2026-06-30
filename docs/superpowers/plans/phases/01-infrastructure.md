> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Phase 1 — Infrastructure** | [link to overview](../2026-06-30-marketplace.md)

**Global Constraints:** See [overview](../2026-06-30-marketplace.md#global-constraints) — all constraints apply here.

---

## Phase 1 — Infrastructure

### Task 1: Docker + PostgreSQL

**Files:**

- Create: `docker-compose.yml`
- Create: `package.json` (workspace root)

**Interfaces:**

- Produces: PostgreSQL running on `localhost:5433`, databases `marketplace` and `marketplace_test`

- [x] **Step 1: Create `docker-compose.yml`**

```yaml
services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: marketplace
      POSTGRES_PASSWORD: marketplace
      POSTGRES_DB: marketplace
    ports:
      - '5433:5432'
    volumes:
      - pgdata:/var/lib/postgresql/data
      - ./docker/init.sql:/docker-entrypoint-initdb.d/init.sql

volumes:
  pgdata:
```

- [x] **Step 2: Create `docker/init.sql`** (creates the test database)

```sql
CREATE DATABASE marketplace_test;
GRANT ALL PRIVILEGES ON DATABASE marketplace_test TO marketplace;
```

- [x] **Step 3: Create workspace root `package.json`**

```json
{
  "name": "marketplace",
  "private": true,
  "workspaces": ["packages/core", "packages/api", "packages/web"],
  "scripts": {
    "dev": "bun run --filter api dev & bun run --filter web dev",
    "dev:api": "bun run --filter api dev",
    "dev:web": "bun run --filter web dev",
    "test:api": "bun run --filter api test",
    "test:e2e": "bun run --filter web test:e2e"
  }
}
```

- [x] **Step 4: Start PostgreSQL and verify**

```bash
docker compose up -d
docker compose ps
```

Expected: `db` container status `running`, listening on `0.0.0.0:5433`

- [x] **Step 5: Commit**

```bash
git add docker-compose.yml docker/init.sql package.json
git commit -m "chore: add Docker Compose with PostgreSQL and test database"
```

---

### Task 2: API Project Scaffold

**Files:**

- Create: `packages/api/package.json`
- Create: `packages/api/tsconfig.json`
- Create: `packages/api/vitest.config.ts`
- Create: `packages/api/.env` (gitignored)
- Create: `packages/api/.env.test` (gitignored)
- Create: `.gitignore`

**Interfaces:**

- Produces: `bun run --filter api dev` starts the API; `bun run --filter api test` runs Vitest

- [x] **Step 1: Create `packages/api/package.json`**

```json
{
  "name": "api",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "bun --watch index.ts",
    "build": "tsc",
    "test": "vitest run",
    "db:migrate": "prisma migrate dev",
    "db:migrate:test": "DATABASE_URL=$DATABASE_URL_TEST prisma migrate deploy",
    "db:seed": "bun run prisma/seed.ts"
  },
  "dependencies": {
    "@marketplace/core": "*",
    "@prisma/client": "^6.0.0",
    "connect-pg-simple": "^9.0.0",
    "pg": "^8.0.0",
    "cors": "^2.8.5",
    "express": "^5.0.0",
    "express-session": "^1.18.0",
    "stripe": "^17.0.0",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "@types/connect-pg-simple": "^7.0.0",
    "@types/cors": "^2.8.0",
    "@types/express": "^5.0.0",
    "@types/express-session": "^1.18.0",
    "@types/pg": "^8.0.0",
    "@types/node": "^22.0.0",
    "@types/supertest": "^6.0.0",
    "prisma": "^6.0.0",
    "supertest": "^7.0.0",
    "typescript": "^5.0.0",
    "vitest": "^2.0.0"
  }
}
```

- [x] **Step 2: Create `packages/api/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "CommonJS",
    "lib": ["ES2022"],
    "outDir": "dist",
    "rootDir": ".",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "paths": {
      "@marketplace/core": ["../core/src/index.ts"]
    }
  },
  "include": ["src", "prisma", "tests", "index.ts"],
  "exclude": ["node_modules", "dist"]
}
```

- [x] **Step 3: Create `packages/api/vitest.config.ts`**

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } }
  }
});
```

> `singleFork: true` ensures tests run serially against the shared test database, preventing parallel writes from corrupting state.

- [x] **Step 4: Create `packages/api/.env`**

```
DATABASE_URL=postgresql://marketplace:marketplace@localhost:5433/marketplace
SESSION_SECRET=dev-secret-change-in-production
STRIPE_SECRET_KEY=sk_test_YOUR_KEY_HERE
```

- [x] **Step 5: Create `packages/api/.env.test`**

```
DATABASE_URL=postgresql://marketplace:marketplace@localhost:5433/marketplace_test
SESSION_SECRET=test-secret
STRIPE_SECRET_KEY=sk_test_YOUR_KEY_HERE
```

- [x] **Step 6: Create `.gitignore` at repo root**

```
node_modules/
dist/
.env
.env.test
.env.local
```

- [x] **Step 7: Install API dependencies**

```bash
bun install
```

Expected: `node_modules` populated, no errors

- [x] **Step 8: Commit**

```bash
git add packages/api/package.json api/tsconfig.json api/vitest.config.ts .gitignore
git commit -m "chore: scaffold API project with Express, Prisma, Vitest"
```

---

### Task 3: Core Package — Shared Types and Schemas

**Files:**

- Create: `packages/core/package.json`
- Create: `packages/core/tsconfig.json`
- Create: `packages/core/src/types.ts`
- Create: `packages/core/src/schemas.ts`
- Create: `packages/core/src/index.ts`

**Interfaces:**

- Produces: `@marketplace/core` importable by both `api` and `web`
- Produces: TypeScript interfaces for all domain objects
- Produces: Zod schemas used by API routes for request validation and by the web checkout form

- [x] **Step 1: Create `packages/core/package.json`**

```json
{
  "name": "@marketplace/core",
  "version": "1.0.0",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "dependencies": {
    "zod": "^3.23.0"
  }
}
```

> `main` and `types` both point to the TypeScript source. `api` resolves it via Bun at dev time; `web` resolves it via Next.js's transpiler. No build step needed.

- [x] **Step 2: Create `packages/core/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "CommonJS",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true,
    "outDir": "dist"
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist"]
}
```

- [x] **Step 3: Create `packages/core/src/types.ts`**

```typescript
export interface Product {
  id: number;
  name: string;
  description: string;
  primary_image: string;
  image_urls: string[];
  unit_price: number;
  currency: string;
}

export interface CartProduct {
  id: number;
  name: string;
  primary_image: string;
}

export interface CartItem {
  quantity: number;
  price: number;
  currency: string;
  product: CartProduct;
}

export interface Cart {
  id: number | null;
  items: CartItem[];
  total_price: number;
  currency: string;
}

export interface AddressDetails {
  name: string;
  street: string;
  city: string;
  postcode: string;
}

export interface OrderItem {
  quantity: number;
  price: number;
  currency: string;
  product: CartProduct;
}

export interface Order {
  id: number;
  total_price: number;
  currency: string;
  status: string;
  items: OrderItem[];
  address_details: AddressDetails;
  payment_details: { card_last_four_digits: string };
}

export interface ApiError {
  error: string;
  code?: string;
}
```

- [x] **Step 4: Create `packages/core/src/schemas.ts`**

```typescript
import { z } from 'zod';

export const AddToCartSchema = z.object({
  productId: z
    .number({ required_error: 'productId is required' })
    .int()
    .positive(),
  quantity: z
    .number({ required_error: 'quantity is required' })
    .int()
    .min(1, 'Quantity must be at least 1')
});

export const UpdateCartItemSchema = z.object({
  quantity: z.number({ required_error: 'quantity is required' }).int().min(0)
});

export const AddressSchema = z.object({
  name: z.string().min(1, 'Full name is required'),
  street: z.string().min(1, 'Street address is required'),
  city: z.string().min(1, 'City is required'),
  postcode: z
    .string()
    .regex(/^[A-Z]{1,2}\d[A-Z\d]? ?\d[A-Z]{2}$/i, 'Enter a valid UK postcode')
});

export const PlaceOrderSchema = z.object({
  cartId: z.number({ required_error: 'cartId is required' }).int().positive(),
  paymentIntentId: z.string().min(1, 'paymentIntentId is required'),
  address_details: AddressSchema
});

export type AddToCartInput = z.infer<typeof AddToCartSchema>;
export type UpdateCartItemInput = z.infer<typeof UpdateCartItemSchema>;
export type AddressInput = z.infer<typeof AddressSchema>;
export type PlaceOrderInput = z.infer<typeof PlaceOrderSchema>;
```

- [x] **Step 5: Create `packages/core/src/index.ts`**

```typescript
export * from './types.js';
export * from './schemas.js';
```

- [x] **Step 6: Install core dependencies**

```bash
bun install
```

- [x] **Step 7: Type-check core**

```bash
cd packages/core && npx tsc --noEmit && cd ../..
```

Expected: no errors

- [x] **Step 8: Commit**

```bash
git add packages/core/
git commit -m "feat: add @marketplace/core package with shared types and Zod schemas"
```

---

### Task 4: Prisma Schema, Migration, and Seed

**Files:**

- Create: `packages/api/prisma/schema.prisma`
- Create: `packages/api/prisma/seed.ts`
- Create: `packages/api/src/db/prisma.ts`

**Interfaces:**

- Produces: `prisma.product`, `prisma.cart`, `prisma.cartItem`, `prisma.order`, `prisma.orderItem` — all queryable

- [x] **Step 1: Create `packages/api/prisma/schema.prisma`**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Product {
  id            Int         @id @default(autoincrement())
  name          String
  description   String
  primary_image String
  image_urls    String[]
  unit_price    Decimal     @db.Decimal(10, 2)
  currency      String      @default("GBP")
  cart_items    CartItem[]
  order_items   OrderItem[]

  @@map("products")
}

model Cart {
  id         Int        @id @default(autoincrement())
  session_id String     @unique
  currency   String     @default("GBP")
  items      CartItem[]
  created_at DateTime   @default(now())
  updated_at DateTime   @updatedAt

  @@map("carts")
}

model CartItem {
  id         Int     @id @default(autoincrement())
  cart_id    Int
  product_id Int
  quantity   Int
  cart       Cart    @relation(fields: [cart_id], references: [id], onDelete: Cascade)
  product    Product @relation(fields: [product_id], references: [id])

  @@unique([cart_id, product_id])
  @@map("cart_items")
}

model Order {
  id                Int         @id @default(autoincrement())
  total_price       Decimal     @db.Decimal(10, 2)
  currency          String      @default("GBP")
  status            String      @default("confirmed")
  stripe_payment_id String
  card_last_four    String
  address_name      String
  address_street    String
  address_city      String
  address_postcode  String
  items             OrderItem[]
  created_at        DateTime    @default(now())

  @@map("orders")
}

model OrderItem {
  id         Int     @id @default(autoincrement())
  order_id   Int
  product_id Int
  quantity   Int
  price      Decimal @db.Decimal(10, 2)
  order      Order   @relation(fields: [order_id], references: [id])
  product    Product @relation(fields: [product_id], references: [id])

  @@map("order_items")
}
```

> `CartItem` does not store `price` — it is computed from `product.unit_price * quantity` at query time so it always reflects current prices.
> `OrderItem` does store `price` — it locks in the price at the moment of purchase.

- [x] **Step 2: Create `packages/api/src/db/prisma.ts`**

```typescript
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
```

- [x] **Step 3: Run migration against both databases**

```bash
cd packages/api && npx prisma migrate dev --name init
DATABASE_URL=postgresql://marketplace:marketplace@localhost:5433/marketplace_test npx prisma migrate deploy
cd ../..
```

Expected: `migrations/` folder created, both databases have tables

- [x] **Step 4: Create `packages/api/prisma/seed.ts`**

```typescript
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  await prisma.product.deleteMany();
  await prisma.product.createMany({
    data: [
      {
        name: 'Classic White T-Shirt',
        description:
          'A wardrobe essential. 100% organic cotton, preshrunk, relaxed fit.',
        primary_image:
          'https://placehold.co/800x800/f5f5f5/333?text=White+T-Shirt',
        image_urls: [
          'https://placehold.co/800x800/f5f5f5/333?text=White+T-Shirt',
          'https://placehold.co/800x800/f5f5f5/333?text=White+T-Shirt+Back'
        ],
        unit_price: 18.99,
        currency: 'GBP'
      },
      {
        name: 'Navy Chino Trousers',
        description:
          'Slim fit chinos in a versatile navy. Suitable for smart-casual occasions.',
        primary_image:
          'https://placehold.co/800x800/1a2744/f5f5f5?text=Navy+Chinos',
        image_urls: [
          'https://placehold.co/800x800/1a2744/f5f5f5?text=Navy+Chinos',
          'https://placehold.co/800x800/1a2744/f5f5f5?text=Navy+Chinos+Detail'
        ],
        unit_price: 42.0,
        currency: 'GBP'
      },
      {
        name: 'Merino Wool Jumper',
        description:
          'Fine merino wool. Temperature-regulating and machine washable.',
        primary_image:
          'https://placehold.co/800x800/8b4513/f5f5f5?text=Merino+Jumper',
        image_urls: [
          'https://placehold.co/800x800/8b4513/f5f5f5?text=Merino+Jumper',
          'https://placehold.co/800x800/8b4513/f5f5f5?text=Merino+Detail'
        ],
        unit_price: 65.0,
        currency: 'GBP'
      },
      {
        name: 'Leather Chelsea Boots',
        description:
          'Full-grain leather upper, elastic side panels, leather sole.',
        primary_image:
          'https://placehold.co/800x800/2c1810/f5f5f5?text=Chelsea+Boots',
        image_urls: [
          'https://placehold.co/800x800/2c1810/f5f5f5?text=Chelsea+Boots',
          'https://placehold.co/800x800/2c1810/f5f5f5?text=Boots+Side'
        ],
        unit_price: 120.0,
        currency: 'GBP'
      },
      {
        name: 'Canvas Tote Bag',
        description:
          'Heavy-duty canvas tote with internal zip pocket. 20L capacity.',
        primary_image: 'https://placehold.co/800x800/d4c5a9/333?text=Tote+Bag',
        image_urls: [
          'https://placehold.co/800x800/d4c5a9/333?text=Tote+Bag',
          'https://placehold.co/800x800/d4c5a9/333?text=Tote+Interior'
        ],
        unit_price: 24.99,
        currency: 'GBP'
      },
      {
        name: 'Slim Leather Belt',
        description:
          'Vegetable-tanned leather belt. 30mm width. Solid brass buckle.',
        primary_image:
          'https://placehold.co/800x800/5c3d2e/f5f5f5?text=Leather+Belt',
        image_urls: [
          'https://placehold.co/800x800/5c3d2e/f5f5f5?text=Leather+Belt',
          'https://placehold.co/800x800/5c3d2e/f5f5f5?text=Belt+Buckle'
        ],
        unit_price: 34.99,
        currency: 'GBP'
      }
    ]
  });
  console.log('Seeded 6 products');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

- [x] **Step 5: Add seed script to `packages/api/package.json`**

In `packages/api/package.json`, the `db:seed` script already exists. Also add this to the package.json so Prisma knows the seed file:

```json
"prisma": {
  "seed": "bun run prisma/seed.ts"
}
```

- [x] **Step 6: Run seed**

```bash
bun run --filter api db:seed
```

Expected: `Seeded 6 products`

- [x] **Step 7: Commit**

```bash
git add packages/api/prisma/ api/src/db/
git commit -m "chore: add Prisma schema, migration, and product seed data"
```

---

### Task 5: Express App, Session Middleware, Error Handler

**Files:**

- Create: `packages/api/src/types/session.d.ts`
- Create: `packages/api/src/middleware/session.ts`
- Create: `packages/api/src/middleware/error.ts`
- Create: `packages/api/src/app.ts`
- Create: `packages/api/index.ts`

**Interfaces:**

- Produces: `app` (Express app) importable by tests and `index.ts`
- Produces: `req.session.cartId` available on all routes as `number | undefined`

- [x] **Step 1: Create `packages/api/src/types/session.d.ts`**

```typescript
import 'express-session';

declare module 'express-session' {
  interface SessionData {
    cartId?: number;
  }
}
```

- [x] **Step 2: Create `packages/api/src/middleware/session.ts`**

```typescript
import session from 'express-session';
import connectPg from 'connect-pg-simple';
import pg from 'pg';

const PgSession = connectPg(session);

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

export const sessionMiddleware = session({
  store: new PgSession({
    pool,
    createTableIfMissing: true
  }),
  secret: process.env.SESSION_SECRET ?? 'fallback-dev-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 30 * 24 * 60 * 60 * 1000
  }
});
```

- [x] **Step 3: Create `packages/api/src/middleware/error.ts`**

```typescript
import type { Request, Response, NextFunction } from 'express';

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  console.error(err);
  res
    .status(500)
    .json({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
}
```

- [x] **Step 4: Create `packages/api/src/app.ts`**

```typescript
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { sessionMiddleware } from './middleware/session.js';
import { errorHandler } from './middleware/error.js';
import productsRouter from './routes/products.js';
import cartRouter from './routes/cart.js';
import checkoutRouter from './routes/checkout.js';
import ordersRouter from './routes/orders.js';

export const app = express();

app.use(cors({ origin: 'http://localhost:3000', credentials: true }));
app.use(express.json());
app.use(sessionMiddleware);

app.use('/products', productsRouter);
app.use('/cart', cartRouter);
app.use('/checkout', checkoutRouter);
app.use('/order', ordersRouter);

app.use(errorHandler);
```

- [x] **Step 5: Create `packages/api/index.ts`**

```typescript
import { app } from './src/app.js';

const PORT = process.env.PORT ?? 3001;

app.listen(PORT, () => {
  console.log(`API running on http://localhost:${PORT}`);
});
```

- [x] **Step 6: Create `packages/api/tests/setup.ts`**

```typescript
import { afterAll, beforeAll } from 'vitest';
import { prisma } from '../src/db/prisma.js';

beforeAll(async () => {
  process.env.DATABASE_URL =
    'postgresql://marketplace:marketplace@localhost:5433/marketplace_test';
  await prisma.$connect();
});

afterAll(async () => {
  await prisma.$disconnect();
});
```

- [x] **Step 7: Verify the app starts**

```bash
bun run --filter api dev
```

Expected output: `API running on http://localhost:3001`
Stop with Ctrl+C.

- [x] **Step 8: Commit**

```bash
git add packages/api/src/ api/index.ts api/tests/setup.ts
git commit -m "feat: add Express app with session middleware and error handler"
```

---

### Task 6: Web Project Scaffold

**Files:**

- Create: `packages/web/package.json`
- Create: `packages/web/tsconfig.json`
- Create: `packages/web/next.config.ts`
- Create: `packages/web/playwright.config.ts`
- Create: `packages/web/.env.local` (gitignored)

**Interfaces:**

- Produces: `bun run --filter web dev` starts Next.js on port 3000

- [x] **Step 1: Create `packages/web/package.json`**

```json
{
  "name": "web",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "test:e2e": "playwright test"
  },
  "dependencies": {
    "@marketplace/core": "*",
    "@hookform/resolvers": "^3.9.0",
    "@stripe/react-stripe-js": "^3.0.0",
    "@stripe/stripe-js": "^5.0.0",
    "next": "^15.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "react-hook-form": "^7.53.0"
  },
  "devDependencies": {
    "@playwright/test": "^1.48.0",
    "@types/node": "^22.0.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "typescript": "^5.0.0"
  }
}
```

- [x] **Step 2: Create `packages/web/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": {
      "@/*": ["./*"],
      "@marketplace/core": ["../core/src/index.ts"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [x] **Step 3: Create `packages/web/next.config.ts`**

```typescript
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@marketplace/core'],
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [{ protocol: 'https', hostname: 'placehold.co' }]
  }
};

export default nextConfig;
```

> `transpilePackages` is required because `@marketplace/core` exports TypeScript source directly (no build step). Next.js will transpile it as part of its own build.

- [x] **Step 4: Create `packages/web/playwright.config.ts`**

```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  retries: 0,
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry'
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['iPhone 13'] } }
  ],
  webServer: [
    {
      command: 'bun run --filter api dev',
      url: 'http://localhost:3001/products',
      reuseExistingServer: true
    },
    {
      command: 'bun run --filter web dev',
      url: 'http://localhost:3000',
      reuseExistingServer: true
    }
  ]
});
```

- [x] **Step 5: Create `packages/web/.env.local`**

```
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_YOUR_KEY_HERE
```

- [x] **Step 6: Install web dependencies**

```bash
bun install
bunx playwright install --with-deps chromium
```

(Run the playwright install from `packages/web/`)

- [x] **Step 7: Create `packages/web/app/layout.tsx`** (minimal — will be expanded in Task 15)

```typescript
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
```

- [x] **Step 8: Create `packages/web/app/page.tsx`** (placeholder)

```typescript
export default function HomePage() {
  return <main><h1>Marketplace</h1></main>
}
```

- [x] **Step 9: Verify Next.js starts**

```bash
bun run --filter web dev
```

Expected: `Ready on http://localhost:3000`
Stop with Ctrl+C.

- [x] **Step 10: Commit**

```bash
git add packages/web/
git commit -m "chore: scaffold Next.js web project with Playwright"
```
