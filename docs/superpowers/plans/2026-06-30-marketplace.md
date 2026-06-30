# Marketplace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a UK e-commerce marketplace with SSR product browsing, anonymous session-based cart, Stripe checkout, and an order confirmation flow.

**Architecture:** Next.js 15 App Router (SSR) frontend talks to an Express REST API. Cart state lives server-side, tied to anonymous session cookies backed by PostgreSQL via `connect-pg-simple`. Stripe handles payments in test mode — client collects card details via Stripe CardElement, backend creates and confirms the PaymentIntent server-side, then creates the order on success.

**Tech Stack:** Next.js 15 (App Router), Express 5, PostgreSQL 16 (Docker), Prisma 6, TypeScript 5, express-session + connect-pg-simple, Stripe (test mode), React Hook Form + Zod, Vitest + supertest, Playwright

## Global Constraints

- All code TypeScript — no `.js` files
- API on port `3001`, web on port `3000`
- Currency always `GBP` — no multi-currency logic
- UK-only — no international address forms
- No authentication — all users are guests
- No pagination — `/products` returns all products
- Server is source of truth for cart totals and prices (computed from current `unit_price`, never stored on `CartItem`)
- Tests use real PostgreSQL (test database `marketplace_test`) and real Stripe test-mode keys — no mocking
- All API errors return `{ error: string, code?: string }`
- Commit after every task

---

## File Map

```
marketplace/
├── api/
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── seed.ts
│   ├── src/
│   │   ├── db/
│   │   │   └── prisma.ts            # Prisma client singleton
│   │   ├── middleware/
│   │   │   ├── session.ts           # express-session + connect-pg-simple setup
│   │   │   └── error.ts             # global error handler
│   │   ├── routes/
│   │   │   ├── products.ts          # GET /products, GET /products/:id
│   │   │   ├── cart.ts              # GET/POST/PUT/DELETE /cart
│   │   │   ├── checkout.ts          # POST /checkout/payment-intent
│   │   │   └── orders.ts            # POST /order
│   │   ├── types/
│   │   │   └── session.d.ts         # Extends express-session SessionData
│   │   └── app.ts                   # Express app (no listen — testable via supertest)
│   ├── tests/
│   │   ├── setup.ts                 # beforeAll DB clean, afterAll disconnect
│   │   ├── products.test.ts
│   │   ├── cart.test.ts
│   │   └── orders.test.ts
│   ├── index.ts                     # Calls app.listen(3001)
│   ├── package.json
│   ├── tsconfig.json
│   └── vitest.config.ts
├── web/
│   ├── app/
│   │   ├── layout.tsx               # Root layout: <html>, <Nav>
│   │   ├── page.tsx                 # PLP — server component, fetches /products
│   │   ├── products/[id]/
│   │   │   └── page.tsx             # PDP — server component, fetches /products/:id
│   │   ├── cart/
│   │   │   └── page.tsx             # Cart page — server component, fetches /cart
│   │   ├── checkout/
│   │   │   └── page.tsx             # Checkout page — client component
│   │   └── order-confirmation/[id]/
│   │       └── page.tsx             # Confirmation — server component
│   ├── components/
│   │   ├── nav.tsx                  # Header + cart item count badge
│   │   ├── product-card.tsx         # Card for PLP grid
│   │   ├── product-gallery.tsx      # Image switcher for PDP
│   │   ├── add-to-cart-button.tsx   # Client component: POST /cart/products
│   │   ├── cart-item-row.tsx        # Row with qty controls + remove
│   │   ├── address-form.tsx         # UK address fields (React Hook Form)
│   │   └── stripe-payment-form.tsx  # Stripe CardElement wrapper
│   ├── lib/
│   │   ├── api.ts                   # Typed fetch wrapper for all API calls
│   │   └── stripe.ts                # loadStripe singleton
│   ├── tests/e2e/
│   │   ├── browse.spec.ts
│   │   ├── cart.spec.ts
│   │   └── checkout.spec.ts
│   ├── next.config.ts
│   ├── playwright.config.ts
│   ├── package.json
│   └── tsconfig.json
├── core/
│   ├── src/
│   │   ├── types.ts                 # Product, Cart, CartItem, Order, ApiError — TypeScript interfaces
│   │   ├── schemas.ts               # Zod schemas for all API request bodies + address validation
│   │   └── index.ts                 # Re-exports everything from types.ts and schemas.ts
│   ├── package.json
│   └── tsconfig.json
├── docker-compose.yml
└── package.json                     # npm workspaces root: ["api", "web", "core"]
```

---

## Phase 1 — Infrastructure

### Task 1: Docker + PostgreSQL

**Files:**
- Create: `docker-compose.yml`
- Create: `package.json` (workspace root)

**Interfaces:**
- Produces: PostgreSQL running on `localhost:5432`, databases `marketplace` and `marketplace_test`

- [ ] **Step 1: Create `docker-compose.yml`**

```yaml
services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: marketplace
      POSTGRES_PASSWORD: marketplace
      POSTGRES_DB: marketplace
    ports:
      - '5432:5432'
    volumes:
      - pgdata:/var/lib/postgresql/data
      - ./docker/init.sql:/docker-entrypoint-initdb.d/init.sql

volumes:
  pgdata:
```

- [ ] **Step 2: Create `docker/init.sql`** (creates the test database)

```sql
CREATE DATABASE marketplace_test;
GRANT ALL PRIVILEGES ON DATABASE marketplace_test TO marketplace;
```

- [ ] **Step 3: Create workspace root `package.json`**

```json
{
  "name": "marketplace",
  "private": true,
  "workspaces": ["core", "api", "web"],
  "scripts": {
    "dev:api": "npm run dev -w api",
    "dev:web": "npm run dev -w web",
    "test:api": "npm run test -w api",
    "test:e2e": "npm run test:e2e -w web"
  }
}
```

- [ ] **Step 4: Start PostgreSQL and verify**

```bash
docker compose up -d
docker compose ps
```

Expected: `db` container status `running`, listening on `0.0.0.0:5432`

- [ ] **Step 5: Commit**

```bash
git add docker-compose.yml docker/init.sql package.json
git commit -m "chore: add Docker Compose with PostgreSQL and test database"
```

---

### Task 2: API Project Scaffold

**Files:**
- Create: `api/package.json`
- Create: `api/tsconfig.json`
- Create: `api/vitest.config.ts`
- Create: `api/.env` (gitignored)
- Create: `api/.env.test` (gitignored)
- Create: `.gitignore`

**Interfaces:**
- Produces: `npm run dev -w api` starts the API; `npm run test -w api` runs Vitest

- [ ] **Step 1: Create `api/package.json`**

```json
{
  "name": "api",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "test": "vitest run",
    "db:migrate": "prisma migrate dev",
    "db:migrate:test": "DATABASE_URL=$DATABASE_URL_TEST prisma migrate deploy",
    "db:seed": "tsx prisma/seed.ts"
  },
  "dependencies": {
    "@marketplace/core": "*",
    "@prisma/client": "^6.0.0",
    "connect-pg-simple": "^9.0.0",
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
    "@types/node": "^22.0.0",
    "@types/supertest": "^6.0.0",
    "prisma": "^6.0.0",
    "supertest": "^7.0.0",
    "tsx": "^4.0.0",
    "typescript": "^5.0.0",
    "vitest": "^2.0.0"
  }
}
```

- [ ] **Step 2: Create `api/tsconfig.json`**

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

- [ ] **Step 3: Create `api/vitest.config.ts`**

```typescript
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
  },
})
```

> `singleFork: true` ensures tests run serially against the shared test database, preventing parallel writes from corrupting state.

- [ ] **Step 4: Create `api/.env`**

```
DATABASE_URL=postgresql://marketplace:marketplace@localhost:5432/marketplace
SESSION_SECRET=dev-secret-change-in-production
STRIPE_SECRET_KEY=sk_test_YOUR_KEY_HERE
```

- [ ] **Step 5: Create `api/.env.test`**

```
DATABASE_URL=postgresql://marketplace:marketplace@localhost:5432/marketplace_test
SESSION_SECRET=test-secret
STRIPE_SECRET_KEY=sk_test_YOUR_KEY_HERE
```

- [ ] **Step 6: Create `.gitignore` at repo root**

```
node_modules/
dist/
.env
.env.test
.env.local
```

- [ ] **Step 7: Install API dependencies**

```bash
npm install -w api
```

Expected: `node_modules` populated, no errors

- [ ] **Step 8: Commit**

```bash
git add api/package.json api/tsconfig.json api/vitest.config.ts .gitignore
git commit -m "chore: scaffold API project with Express, Prisma, Vitest"
```

---

### Task 3: Core Package — Shared Types and Schemas

**Files:**
- Create: `core/package.json`
- Create: `core/tsconfig.json`
- Create: `core/src/types.ts`
- Create: `core/src/schemas.ts`
- Create: `core/src/index.ts`

**Interfaces:**
- Produces: `@marketplace/core` importable by both `api` and `web`
- Produces: TypeScript interfaces for all domain objects
- Produces: Zod schemas used by API routes for request validation and by the web checkout form

- [ ] **Step 1: Create `core/package.json`**

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

> `main` and `types` both point to the TypeScript source. `api` resolves it via tsx at dev time; `web` resolves it via Next.js's transpiler. No build step needed.

- [ ] **Step 2: Create `core/tsconfig.json`**

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

- [ ] **Step 3: Create `core/src/types.ts`**

```typescript
export interface Product {
  id: number
  name: string
  description: string
  primary_image: string
  image_urls: string[]
  unit_price: number
  currency: string
}

export interface CartProduct {
  id: number
  name: string
  primary_image: string
}

export interface CartItem {
  quantity: number
  price: number
  currency: string
  product: CartProduct
}

export interface Cart {
  id: number | null
  items: CartItem[]
  total_price: number
  currency: string
}

export interface AddressDetails {
  name: string
  street: string
  city: string
  postcode: string
}

export interface OrderItem {
  quantity: number
  price: number
  currency: string
  product: CartProduct
}

export interface Order {
  id: number
  total_price: number
  currency: string
  status: string
  items: OrderItem[]
  address_details: AddressDetails
  payment_details: { card_last_four_digits: string }
}

export interface ApiError {
  error: string
  code?: string
}
```

- [ ] **Step 4: Create `core/src/schemas.ts`**

```typescript
import { z } from 'zod'

export const AddToCartSchema = z.object({
  productId: z.number({ required_error: 'productId is required' }).int().positive(),
  quantity: z.number({ required_error: 'quantity is required' }).int().min(1, 'Quantity must be at least 1'),
})

export const UpdateCartItemSchema = z.object({
  quantity: z.number({ required_error: 'quantity is required' }).int().min(0),
})

export const AddressSchema = z.object({
  name: z.string().min(1, 'Full name is required'),
  street: z.string().min(1, 'Street address is required'),
  city: z.string().min(1, 'City is required'),
  postcode: z.string().regex(/^[A-Z]{1,2}\d[A-Z\d]? ?\d[A-Z]{2}$/i, 'Enter a valid UK postcode'),
})

export const PlaceOrderSchema = z.object({
  cartId: z.number({ required_error: 'cartId is required' }).int().positive(),
  paymentIntentId: z.string().min(1, 'paymentIntentId is required'),
  address_details: AddressSchema,
})

export type AddToCartInput = z.infer<typeof AddToCartSchema>
export type UpdateCartItemInput = z.infer<typeof UpdateCartItemSchema>
export type AddressInput = z.infer<typeof AddressSchema>
export type PlaceOrderInput = z.infer<typeof PlaceOrderSchema>
```

- [ ] **Step 5: Create `core/src/index.ts`**

```typescript
export * from './types.js'
export * from './schemas.js'
```

- [ ] **Step 6: Install core dependencies**

```bash
npm install -w core
```

- [ ] **Step 7: Type-check core**

```bash
cd core && npx tsc --noEmit && cd ..
```

Expected: no errors

- [ ] **Step 8: Commit**

```bash
git add core/
git commit -m "feat: add @marketplace/core package with shared types and Zod schemas"
```

---

### Task 4: Prisma Schema, Migration, and Seed

**Files:**
- Create: `api/prisma/schema.prisma`
- Create: `api/prisma/seed.ts`
- Create: `api/src/db/prisma.ts`

**Interfaces:**
- Produces: `prisma.product`, `prisma.cart`, `prisma.cartItem`, `prisma.order`, `prisma.orderItem` — all queryable

- [ ] **Step 1: Create `api/prisma/schema.prisma`**

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

- [ ] **Step 2: Create `api/src/db/prisma.ts`**

```typescript
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

export const prisma = globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
```

- [ ] **Step 3: Run migration against both databases**

```bash
cd api && npx prisma migrate dev --name init
DATABASE_URL=postgresql://marketplace:marketplace@localhost:5432/marketplace_test npx prisma migrate deploy
cd ..
```

Expected: `migrations/` folder created, both databases have tables

- [ ] **Step 4: Create `api/prisma/seed.ts`**

```typescript
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  await prisma.product.deleteMany()
  await prisma.product.createMany({
    data: [
      {
        name: 'Classic White T-Shirt',
        description: 'A wardrobe essential. 100% organic cotton, preshrunk, relaxed fit.',
        primary_image: 'https://placehold.co/800x800/f5f5f5/333?text=White+T-Shirt',
        image_urls: [
          'https://placehold.co/800x800/f5f5f5/333?text=White+T-Shirt',
          'https://placehold.co/800x800/f5f5f5/333?text=White+T-Shirt+Back',
        ],
        unit_price: 18.99,
        currency: 'GBP',
      },
      {
        name: 'Navy Chino Trousers',
        description: 'Slim fit chinos in a versatile navy. Suitable for smart-casual occasions.',
        primary_image: 'https://placehold.co/800x800/1a2744/f5f5f5?text=Navy+Chinos',
        image_urls: [
          'https://placehold.co/800x800/1a2744/f5f5f5?text=Navy+Chinos',
          'https://placehold.co/800x800/1a2744/f5f5f5?text=Navy+Chinos+Detail',
        ],
        unit_price: 42.00,
        currency: 'GBP',
      },
      {
        name: 'Merino Wool Jumper',
        description: 'Fine merino wool. Temperature-regulating and machine washable.',
        primary_image: 'https://placehold.co/800x800/8b4513/f5f5f5?text=Merino+Jumper',
        image_urls: [
          'https://placehold.co/800x800/8b4513/f5f5f5?text=Merino+Jumper',
          'https://placehold.co/800x800/8b4513/f5f5f5?text=Merino+Detail',
        ],
        unit_price: 65.00,
        currency: 'GBP',
      },
      {
        name: 'Leather Chelsea Boots',
        description: 'Full-grain leather upper, elastic side panels, leather sole.',
        primary_image: 'https://placehold.co/800x800/2c1810/f5f5f5?text=Chelsea+Boots',
        image_urls: [
          'https://placehold.co/800x800/2c1810/f5f5f5?text=Chelsea+Boots',
          'https://placehold.co/800x800/2c1810/f5f5f5?text=Boots+Side',
        ],
        unit_price: 120.00,
        currency: 'GBP',
      },
      {
        name: 'Canvas Tote Bag',
        description: 'Heavy-duty canvas tote with internal zip pocket. 20L capacity.',
        primary_image: 'https://placehold.co/800x800/d4c5a9/333?text=Tote+Bag',
        image_urls: [
          'https://placehold.co/800x800/d4c5a9/333?text=Tote+Bag',
          'https://placehold.co/800x800/d4c5a9/333?text=Tote+Interior',
        ],
        unit_price: 24.99,
        currency: 'GBP',
      },
      {
        name: 'Slim Leather Belt',
        description: 'Vegetable-tanned leather belt. 30mm width. Solid brass buckle.',
        primary_image: 'https://placehold.co/800x800/5c3d2e/f5f5f5?text=Leather+Belt',
        image_urls: [
          'https://placehold.co/800x800/5c3d2e/f5f5f5?text=Leather+Belt',
          'https://placehold.co/800x800/5c3d2e/f5f5f5?text=Belt+Buckle',
        ],
        unit_price: 34.99,
        currency: 'GBP',
      },
    ],
  })
  console.log('Seeded 6 products')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
```

- [ ] **Step 5: Add seed script to `api/package.json`**

In `api/package.json`, the `db:seed` script already exists. Also add this to the package.json so Prisma knows the seed file:

```json
"prisma": {
  "seed": "tsx prisma/seed.ts"
}
```

- [ ] **Step 6: Run seed**

```bash
npm run db:seed -w api
```

Expected: `Seeded 6 products`

- [ ] **Step 7: Commit**

```bash
git add api/prisma/ api/src/db/
git commit -m "chore: add Prisma schema, migration, and product seed data"
```

---

### Task 5: Express App, Session Middleware, Error Handler

**Files:**
- Create: `api/src/types/session.d.ts`
- Create: `api/src/middleware/session.ts`
- Create: `api/src/middleware/error.ts`
- Create: `api/src/app.ts`
- Create: `api/index.ts`

**Interfaces:**
- Produces: `app` (Express app) importable by tests and `index.ts`
- Produces: `req.session.cartId` available on all routes as `number | undefined`

- [ ] **Step 1: Create `api/src/types/session.d.ts`**

```typescript
import 'express-session'

declare module 'express-session' {
  interface SessionData {
    cartId?: number
  }
}
```

- [ ] **Step 2: Create `api/src/middleware/session.ts`**

```typescript
import session from 'express-session'
import connectPg from 'connect-pg-simple'
import pg from 'pg'

const PgSession = connectPg(session)

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })

export const sessionMiddleware = session({
  store: new PgSession({
    pool,
    createTableIfMissing: true,
  }),
  secret: process.env.SESSION_SECRET ?? 'fallback-dev-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 30 * 24 * 60 * 60 * 1000,
  },
})
```

- [ ] **Step 3: Create `api/src/middleware/error.ts`**

```typescript
import type { Request, Response, NextFunction } from 'express'

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  console.error(err)
  res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' })
}
```

- [ ] **Step 4: Create `api/src/app.ts`**

```typescript
import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { sessionMiddleware } from './middleware/session.js'
import { errorHandler } from './middleware/error.js'
import productsRouter from './routes/products.js'
import cartRouter from './routes/cart.js'
import checkoutRouter from './routes/checkout.js'
import ordersRouter from './routes/orders.js'

export const app = express()

app.use(cors({ origin: 'http://localhost:3000', credentials: true }))
app.use(express.json())
app.use(sessionMiddleware)

app.use('/products', productsRouter)
app.use('/cart', cartRouter)
app.use('/checkout', checkoutRouter)
app.use('/order', ordersRouter)

app.use(errorHandler)
```

- [ ] **Step 5: Create `api/index.ts`**

```typescript
import { app } from './src/app.js'

const PORT = process.env.PORT ?? 3001

app.listen(PORT, () => {
  console.log(`API running on http://localhost:${PORT}`)
})
```

- [ ] **Step 6: Create `api/tests/setup.ts`**

```typescript
import { afterAll, beforeAll } from 'vitest'
import { prisma } from '../src/db/prisma.js'

beforeAll(async () => {
  process.env.DATABASE_URL =
    'postgresql://marketplace:marketplace@localhost:5432/marketplace_test'
  await prisma.$connect()
})

afterAll(async () => {
  await prisma.$disconnect()
})
```

- [ ] **Step 7: Verify the app starts**

```bash
npm run dev -w api
```

Expected output: `API running on http://localhost:3001`
Stop with Ctrl+C.

- [ ] **Step 8: Commit**

```bash
git add api/src/ api/index.ts api/tests/setup.ts
git commit -m "feat: add Express app with session middleware and error handler"
```

---

### Task 6: Web Project Scaffold

**Files:**
- Create: `web/package.json`
- Create: `web/tsconfig.json`
- Create: `web/next.config.ts`
- Create: `web/playwright.config.ts`
- Create: `web/.env.local` (gitignored)

**Interfaces:**
- Produces: `npm run dev -w web` starts Next.js on port 3000

- [ ] **Step 1: Create `web/package.json`**

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

- [ ] **Step 2: Create `web/tsconfig.json`**

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

- [ ] **Step 3: Create `web/next.config.ts`**

```typescript
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  transpilePackages: ['@marketplace/core'],
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      { protocol: 'https', hostname: 'placehold.co' },
    ],
  },
}

export default nextConfig
```

> `transpilePackages` is required because `@marketplace/core` exports TypeScript source directly (no build step). Next.js will transpile it as part of its own build.

- [ ] **Step 4: Create `web/playwright.config.ts`**

```typescript
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  retries: 0,
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['iPhone 13'] } },
  ],
  webServer: [
    {
      command: 'npm run dev -w api',
      url: 'http://localhost:3001/products',
      reuseExistingServer: true,
    },
    {
      command: 'npm run dev -w web',
      url: 'http://localhost:3000',
      reuseExistingServer: true,
    },
  ],
})
```

- [ ] **Step 5: Create `web/.env.local`**

```
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_YOUR_KEY_HERE
```

- [ ] **Step 6: Install web dependencies**

```bash
npm install -w web
npx playwright install --with-deps chromium -w web
```

- [ ] **Step 7: Create `web/app/layout.tsx`** (minimal — will be expanded in Task 15)

```typescript
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
```

- [ ] **Step 8: Create `web/app/page.tsx`** (placeholder)

```typescript
export default function HomePage() {
  return <main><h1>Marketplace</h1></main>
}
```

- [ ] **Step 9: Verify Next.js starts**

```bash
npm run dev -w web
```

Expected: `Ready on http://localhost:3000`
Stop with Ctrl+C.

- [ ] **Step 10: Commit**

```bash
git add web/
git commit -m "chore: scaffold Next.js web project with Playwright"
```

---

## Phase 2 — Product API

### Task 7: GET /products Endpoint

**Files:**
- Create: `api/src/routes/products.ts`
- Create: `api/tests/products.test.ts`

**Interfaces:**
- Produces: `GET /products` → `{ results: Product[] }`
- Consumes: `prisma.product` (from Task 3)

- [ ] **Step 1: Write the failing test**

Create `api/tests/products.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import { app } from '../src/app.js'
import { prisma } from '../src/db/prisma.js'

let productId: number

beforeAll(async () => {
  await prisma.orderItem.deleteMany()
  await prisma.order.deleteMany()
  await prisma.cartItem.deleteMany()
  await prisma.cart.deleteMany()
  await prisma.product.deleteMany()

  const product = await prisma.product.create({
    data: {
      name: 'Test T-Shirt',
      description: 'A test product',
      primary_image: 'https://example.com/img.jpg',
      image_urls: ['https://example.com/img.jpg'],
      unit_price: 12.99,
      currency: 'GBP',
    },
  })
  productId = product.id
})

afterAll(async () => {
  await prisma.product.deleteMany()
})

describe('GET /products', () => {
  it('returns a results array with all products', async () => {
    const res = await request(app).get('/products').expect(200)
    expect(res.body.results).toHaveLength(1)
    expect(res.body.results[0]).toMatchObject({
      id: productId,
      name: 'Test T-Shirt',
      unit_price: 12.99,
      currency: 'GBP',
    })
  })

  it('does not include description or image_urls in listing', async () => {
    const res = await request(app).get('/products').expect(200)
    expect(res.body.results[0]).not.toHaveProperty('description')
    expect(res.body.results[0]).not.toHaveProperty('image_urls')
  })
})
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npm run test -w api -- --reporter=verbose
```

Expected: FAIL — `Cannot find module '../src/routes/products.js'`

- [ ] **Step 3: Create `api/src/routes/products.ts`**

```typescript
import { Router } from 'express'
import { prisma } from '../db/prisma.js'

const router = Router()

router.get('/', async (_req, res, next) => {
  try {
    const products = await prisma.product.findMany({
      select: {
        id: true,
        name: true,
        primary_image: true,
        unit_price: true,
        currency: true,
      },
    })

    res.json({
      results: products.map((p) => ({
        ...p,
        unit_price: Number(p.unit_price),
      })),
    })
  } catch (err) {
    next(err)
  }
})

export default router
```

- [ ] **Step 4: Run test to confirm it passes**

```bash
npm run test -w api -- --reporter=verbose
```

Expected: PASS — `GET /products > returns a results array with all products` ✓

- [ ] **Step 5: Commit**

```bash
git add api/src/routes/products.ts api/tests/products.test.ts
git commit -m "feat: add GET /products endpoint"
```

---

### Task 8: GET /products/:id Endpoint

**Files:**
- Modify: `api/src/routes/products.ts`
- Modify: `api/tests/products.test.ts`

**Interfaces:**
- Produces: `GET /products/:id` → full `Product` object including `description` and `image_urls`

- [ ] **Step 1: Write the failing test**

Add to `api/tests/products.test.ts`:

```typescript
describe('GET /products/:id', () => {
  it('returns full product details', async () => {
    const res = await request(app).get(`/products/${productId}`).expect(200)
    expect(res.body).toMatchObject({
      id: productId,
      name: 'Test T-Shirt',
      description: 'A test product',
      primary_image: 'https://example.com/img.jpg',
      image_urls: ['https://example.com/img.jpg'],
      unit_price: 12.99,
      currency: 'GBP',
    })
  })

  it('returns 404 for a non-existent product', async () => {
    const res = await request(app).get('/products/999999').expect(404)
    expect(res.body).toMatchObject({ error: expect.any(String) })
  })
})
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npm run test -w api -- --reporter=verbose
```

Expected: FAIL — `expected 404 to equal 200`

- [ ] **Step 3: Add route to `api/src/routes/products.ts`**

```typescript
router.get('/:id', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10)
    if (isNaN(id)) {
      res.status(404).json({ error: 'Product not found', code: 'NOT_FOUND' })
      return
    }

    const product = await prisma.product.findUnique({ where: { id } })

    if (!product) {
      res.status(404).json({ error: 'Product not found', code: 'NOT_FOUND' })
      return
    }

    res.json({ ...product, unit_price: Number(product.unit_price) })
  } catch (err) {
    next(err)
  }
})
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm run test -w api -- --reporter=verbose
```

Expected: PASS — all product tests ✓

- [ ] **Step 5: Commit**

```bash
git add api/src/routes/products.ts api/tests/products.test.ts
git commit -m "feat: add GET /products/:id endpoint"
```

---

## Phase 3 — Cart API

### Task 9: Cart Routes Setup + GET /cart

**Files:**
- Create: `api/src/routes/cart.ts`
- Create: `api/tests/cart.test.ts`

**Interfaces:**
- Produces: `GET /cart` → `Cart` object (empty cart if no session cart exists)
- Produces: `formatCart(cart)` — internal helper used by all cart routes

```typescript
// Cart response shape
interface CartResponse {
  id: number | null
  items: Array<{
    quantity: number
    price: number      // unit_price * quantity, computed at query time
    currency: string
    product: { id: number; name: string; primary_image: string }
  }>
  total_price: number
  currency: string
}
```

- [ ] **Step 1: Write the failing test**

Create `api/tests/cart.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { agent } from 'supertest'
import { app } from '../src/app.js'
import { prisma } from '../src/db/prisma.js'

beforeEach(async () => {
  await prisma.cartItem.deleteMany()
  await prisma.cart.deleteMany()
})

afterAll(async () => {
  await prisma.cartItem.deleteMany()
  await prisma.cart.deleteMany()
  await prisma.product.deleteMany()
})

describe('GET /cart', () => {
  it('returns an empty cart when no cart exists for the session', async () => {
    const res = await agent(app).get('/cart').expect(200)
    expect(res.body).toEqual({
      id: null,
      items: [],
      total_price: 0,
      currency: 'GBP',
    })
  })
})
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npm run test -w api -- --reporter=verbose
```

Expected: FAIL — `Cannot find module '../src/routes/cart.js'`

- [ ] **Step 3: Create `api/src/routes/cart.ts`**

```typescript
import { Router } from 'express'
import { prisma } from '../db/prisma.js'
import type { Prisma } from '@prisma/client'

const router = Router()

type CartWithItems = Prisma.CartGetPayload<{
  include: { items: { include: { product: true } } }
}>

function formatCart(cart: CartWithItems) {
  const items = cart.items.map((item) => ({
    quantity: item.quantity,
    price: Number(item.product.unit_price) * item.quantity,
    currency: item.product.currency,
    product: {
      id: item.product.id,
      name: item.product.name,
      primary_image: item.product.primary_image,
    },
  }))

  return {
    id: cart.id,
    items,
    total_price: items.reduce((sum, item) => sum + item.price, 0),
    currency: 'GBP',
  }
}

const cartInclude = {
  items: { include: { product: true } },
} satisfies Prisma.CartInclude

router.get('/', async (req, res, next) => {
  try {
    if (!req.session.cartId) {
      res.json({ id: null, items: [], total_price: 0, currency: 'GBP' })
      return
    }

    const cart = await prisma.cart.findUnique({
      where: { id: req.session.cartId },
      include: cartInclude,
    })

    if (!cart) {
      req.session.cartId = undefined
      res.json({ id: null, items: [], total_price: 0, currency: 'GBP' })
      return
    }

    res.json(formatCart(cart))
  } catch (err) {
    next(err)
  }
})

export { formatCart, cartInclude }
export default router
```

- [ ] **Step 4: Run test to confirm it passes**

```bash
npm run test -w api -- --reporter=verbose
```

Expected: PASS ✓

- [ ] **Step 5: Commit**

```bash
git add api/src/routes/cart.ts api/tests/cart.test.ts
git commit -m "feat: add GET /cart endpoint"
```

---

### Task 10: POST /cart/products

**Files:**
- Modify: `api/src/routes/cart.ts`
- Modify: `api/tests/cart.test.ts`

**Interfaces:**
- Produces: `POST /cart/products` with body `{ productId: number, quantity: number }` → `CartResponse`
- Sets `req.session.cartId` on first call (persisting the session and setting the cookie)

- [ ] **Step 1: Write the failing test**

Add to `api/tests/cart.test.ts`, after creating a product in `beforeAll`:

```typescript
let productId: number

// Add to the top of the file, before the describe blocks:
// In beforeEach, also seed one product (reuse across tests)

// Replace the existing beforeEach with:
beforeEach(async () => {
  await prisma.cartItem.deleteMany()
  await prisma.cart.deleteMany()
  await prisma.product.deleteMany()

  const product = await prisma.product.create({
    data: {
      name: 'Test T-Shirt',
      description: 'desc',
      primary_image: 'img.jpg',
      image_urls: [],
      unit_price: 10.00,
      currency: 'GBP',
    },
  })
  productId = product.id
})

describe('POST /cart/products', () => {
  it('creates a cart and adds the product', async () => {
    const ag = agent(app)
    const res = await ag
      .post('/cart/products')
      .send({ productId, quantity: 2 })
      .expect(200)

    expect(res.body.items).toHaveLength(1)
    expect(res.body.items[0]).toMatchObject({
      quantity: 2,
      price: 20,
      currency: 'GBP',
      product: { id: productId, name: 'Test T-Shirt' },
    })
    expect(res.body.total_price).toBe(20)
  })

  it('increments quantity when the same product is added again', async () => {
    const ag = agent(app)
    await ag.post('/cart/products').send({ productId, quantity: 1 })
    const res = await ag
      .post('/cart/products')
      .send({ productId, quantity: 2 })
      .expect(200)

    expect(res.body.items).toHaveLength(1)
    expect(res.body.items[0].quantity).toBe(3)
  })

  it('returns 400 when productId is missing', async () => {
    const res = await agent(app)
      .post('/cart/products')
      .send({ quantity: 1 })
      .expect(400)
    expect(res.body).toMatchObject({ error: expect.any(String) })
  })

  it('returns 404 when product does not exist', async () => {
    const res = await agent(app)
      .post('/cart/products')
      .send({ productId: 999999, quantity: 1 })
      .expect(404)
    expect(res.body).toMatchObject({ error: expect.any(String) })
  })
})
```

- [ ] **Step 2: Run tests to confirm new tests fail**

```bash
npm run test -w api -- --reporter=verbose
```

Expected: FAIL — `POST /cart/products` tests fail with 404

- [ ] **Step 3: Add `POST /cart/products` to `api/src/routes/cart.ts`**

Add the import at the top of the file:
```typescript
import { AddToCartSchema } from '@marketplace/core'
```

Then the route:
```typescript
router.post('/products', async (req, res, next) => {
  try {
    const parsed = AddToCartSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.errors[0].message, code: 'INVALID_INPUT' })
      return
    }
    const { productId, quantity } = parsed.data

    const product = await prisma.product.findUnique({ where: { id: productId } })
    if (!product) {
      res.status(404).json({ error: 'Product not found', code: 'NOT_FOUND' })
      return
    }

    let cart
    if (req.session.cartId) {
      cart = await prisma.cart.findUnique({ where: { id: req.session.cartId } })
    }

    if (!cart) {
      cart = await prisma.cart.create({ data: { session_id: req.session.id } })
      req.session.cartId = cart.id
    }

    await prisma.cartItem.upsert({
      where: { cart_id_product_id: { cart_id: cart.id, product_id: productId } },
      update: { quantity: { increment: quantity } },
      create: { cart_id: cart.id, product_id: productId, quantity },
    })

    const updated = await prisma.cart.findUniqueOrThrow({
      where: { id: cart.id },
      include: cartInclude,
    })

    res.json(formatCart(updated))
  } catch (err) {
    next(err)
  }
})
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm run test -w api -- --reporter=verbose
```

Expected: PASS — all cart tests ✓

- [ ] **Step 5: Commit**

```bash
git add api/src/routes/cart.ts api/tests/cart.test.ts
git commit -m "feat: add POST /cart/products — add item to cart"
```

---

### Task 11: PUT /cart/products/:productId

**Files:**
- Modify: `api/src/routes/cart.ts`
- Modify: `api/tests/cart.test.ts`

**Interfaces:**
- Produces: `PUT /cart/products/:productId` with body `{ quantity: number }` → `CartResponse`
- Setting quantity to 0 removes the item

- [ ] **Step 1: Write the failing test**

Add to `api/tests/cart.test.ts`:

```typescript
describe('PUT /cart/products/:productId', () => {
  it('updates the quantity of an item', async () => {
    const ag = agent(app)
    await ag.post('/cart/products').send({ productId, quantity: 1 })
    const res = await ag
      .put(`/cart/products/${productId}`)
      .send({ quantity: 5 })
      .expect(200)

    expect(res.body.items[0].quantity).toBe(5)
    expect(res.body.total_price).toBe(50)
  })

  it('removes the item when quantity is set to 0', async () => {
    const ag = agent(app)
    await ag.post('/cart/products').send({ productId, quantity: 2 })
    const res = await ag
      .put(`/cart/products/${productId}`)
      .send({ quantity: 0 })
      .expect(200)

    expect(res.body.items).toHaveLength(0)
    expect(res.body.total_price).toBe(0)
  })

  it('returns 404 when no cart exists', async () => {
    await agent(app)
      .put(`/cart/products/${productId}`)
      .send({ quantity: 1 })
      .expect(404)
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm run test -w api -- --reporter=verbose
```

Expected: FAIL

- [ ] **Step 3: Add route to `api/src/routes/cart.ts`**

Add the import at the top of the file (alongside the `AddToCartSchema` import from Task 10):
```typescript
import { AddToCartSchema, UpdateCartItemSchema } from '@marketplace/core'
```

Then the route:
```typescript
router.put('/products/:productId', async (req, res, next) => {
  try {
    const productId = parseInt(req.params.productId, 10)
    const parsed = UpdateCartItemSchema.safeParse(req.body)

    if (isNaN(productId) || !parsed.success) {
      res.status(400).json({ error: parsed.success ? 'Invalid productId' : parsed.error.errors[0].message, code: 'INVALID_INPUT' })
      return
    }
    const { quantity } = parsed.data

    if (!req.session.cartId) {
      res.status(404).json({ error: 'Cart not found', code: 'NOT_FOUND' })
      return
    }

    const cartItem = await prisma.cartItem.findUnique({
      where: { cart_id_product_id: { cart_id: req.session.cartId, product_id: productId } },
    })

    if (!cartItem) {
      res.status(404).json({ error: 'Item not in cart', code: 'NOT_FOUND' })
      return
    }

    if (quantity === 0) {
      await prisma.cartItem.delete({
        where: { cart_id_product_id: { cart_id: req.session.cartId, product_id: productId } },
      })
    } else {
      await prisma.cartItem.update({
        where: { cart_id_product_id: { cart_id: req.session.cartId, product_id: productId } },
        data: { quantity },
      })
    }

    const cart = await prisma.cart.findUniqueOrThrow({
      where: { id: req.session.cartId },
      include: cartInclude,
    })

    res.json(formatCart(cart))
  } catch (err) {
    next(err)
  }
})
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm run test -w api -- --reporter=verbose
```

Expected: PASS ✓

- [ ] **Step 5: Commit**

```bash
git add api/src/routes/cart.ts api/tests/cart.test.ts
git commit -m "feat: add PUT /cart/products/:productId — update item quantity"
```

---

### Task 12: DELETE /cart/products/:productId

**Files:**
- Modify: `api/src/routes/cart.ts`
- Modify: `api/tests/cart.test.ts`

**Interfaces:**
- Produces: `DELETE /cart/products/:productId` → `CartResponse`

- [ ] **Step 1: Write the failing test**

Add to `api/tests/cart.test.ts`:

```typescript
describe('DELETE /cart/products/:productId', () => {
  it('removes the item from the cart', async () => {
    const ag = agent(app)
    await ag.post('/cart/products').send({ productId, quantity: 2 })
    const res = await ag.delete(`/cart/products/${productId}`).expect(200)

    expect(res.body.items).toHaveLength(0)
    expect(res.body.total_price).toBe(0)
  })

  it('returns 404 when no cart exists', async () => {
    await agent(app).delete(`/cart/products/${productId}`).expect(404)
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm run test -w api -- --reporter=verbose
```

Expected: FAIL

- [ ] **Step 3: Add route to `api/src/routes/cart.ts`**

```typescript
router.delete('/products/:productId', async (req, res, next) => {
  try {
    const productId = parseInt(req.params.productId, 10)

    if (isNaN(productId)) {
      res.status(400).json({ error: 'Invalid productId', code: 'INVALID_INPUT' })
      return
    }

    if (!req.session.cartId) {
      res.status(404).json({ error: 'Cart not found', code: 'NOT_FOUND' })
      return
    }

    await prisma.cartItem.deleteMany({
      where: { cart_id: req.session.cartId, product_id: productId },
    })

    const cart = await prisma.cart.findUniqueOrThrow({
      where: { id: req.session.cartId },
      include: cartInclude,
    })

    res.json(formatCart(cart))
  } catch (err) {
    next(err)
  }
})
```

- [ ] **Step 4: Run all tests to confirm they pass**

```bash
npm run test -w api -- --reporter=verbose
```

Expected: PASS — all product and cart tests ✓

- [ ] **Step 5: Commit**

```bash
git add api/src/routes/cart.ts api/tests/cart.test.ts
git commit -m "feat: add DELETE /cart/products/:productId — remove item from cart"
```

---

## Phase 4 — Checkout & Order API

### Task 13: POST /checkout/payment-intent

**Files:**
- Create: `api/src/routes/checkout.ts`
- Create: `api/tests/orders.test.ts` (partial — setup for Tasks 12 & 13)

**Interfaces:**
- Produces: `POST /checkout/payment-intent` with body `{ cartId: number }` → `{ clientSecret: string; amount: number }`
- Consumes: Stripe `sk_test_` key from `process.env.STRIPE_SECRET_KEY`

> This endpoint creates a Stripe PaymentIntent for the cart's total. The client uses the `clientSecret` to confirm payment via Stripe CardElement. Amount is in pence (GBP × 100).

- [ ] **Step 1: Write the failing test**

Create `api/tests/orders.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { agent } from 'supertest'
import { app } from '../src/app.js'
import { prisma } from '../src/db/prisma.js'

let productId: number

beforeEach(async () => {
  await prisma.orderItem.deleteMany()
  await prisma.order.deleteMany()
  await prisma.cartItem.deleteMany()
  await prisma.cart.deleteMany()
  await prisma.product.deleteMany()

  const product = await prisma.product.create({
    data: {
      name: 'Test Product',
      description: 'desc',
      primary_image: 'img.jpg',
      image_urls: [],
      unit_price: 15.00,
      currency: 'GBP',
    },
  })
  productId = product.id
})

afterAll(async () => {
  await prisma.orderItem.deleteMany()
  await prisma.order.deleteMany()
  await prisma.cartItem.deleteMany()
  await prisma.cart.deleteMany()
  await prisma.product.deleteMany()
})

describe('POST /checkout/payment-intent', () => {
  it('creates a Stripe PaymentIntent and returns clientSecret', async () => {
    const ag = agent(app)
    await ag.post('/cart/products').send({ productId, quantity: 2 })
    const cartRes = await ag.get('/cart')
    const cartId = cartRes.body.id

    const res = await ag
      .post('/checkout/payment-intent')
      .send({ cartId })
      .expect(200)

    expect(res.body.clientSecret).toMatch(/^pi_.*_secret_.*/)
    expect(res.body.amount).toBe(30) // 15.00 × 2
  })

  it('returns 404 when cart is empty or does not exist', async () => {
    await agent(app)
      .post('/checkout/payment-intent')
      .send({ cartId: 999999 })
      .expect(404)
  })
})
```

- [ ] **Step 2: Run to confirm failure**

```bash
npm run test -w api -- --reporter=verbose
```

Expected: FAIL

- [ ] **Step 3: Create `api/src/routes/checkout.ts`**

```typescript
import { Router } from 'express'
import Stripe from 'stripe'
import { prisma } from '../db/prisma.js'

const router = Router()

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

router.post('/payment-intent', async (req, res, next) => {
  try {
    const { cartId } = req.body as { cartId?: unknown }

    if (typeof cartId !== 'number') {
      res.status(400).json({ error: 'cartId is required', code: 'INVALID_INPUT' })
      return
    }

    const cart = await prisma.cart.findUnique({
      where: { id: cartId },
      include: { items: { include: { product: true } } },
    })

    if (!cart || cart.items.length === 0) {
      res.status(404).json({ error: 'Cart not found or empty', code: 'NOT_FOUND' })
      return
    }

    const totalPence = Math.round(
      cart.items.reduce(
        (sum, item) => sum + Number(item.product.unit_price) * item.quantity,
        0,
      ) * 100,
    )

    const paymentIntent = await stripe.paymentIntents.create({
      amount: totalPence,
      currency: 'gbp',
      automatic_payment_methods: { enabled: true, allow_redirects: 'never' },
      metadata: { cartId: String(cartId) },
    })

    res.json({
      clientSecret: paymentIntent.client_secret,
      amount: totalPence / 100,
    })
  } catch (err) {
    next(err)
  }
})

export default router
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm run test -w api -- --reporter=verbose
```

Expected: PASS ✓ (this makes a real Stripe test API call — ensure `STRIPE_SECRET_KEY` is set in `.env.test`)

- [ ] **Step 5: Commit**

```bash
git add api/src/routes/checkout.ts api/tests/orders.test.ts
git commit -m "feat: add POST /checkout/payment-intent — create Stripe PaymentIntent"
```

---

### Task 14: POST /order

**Files:**
- Create: `api/src/routes/orders.ts`
- Modify: `api/tests/orders.test.ts`

**Interfaces:**
- Produces: `POST /order` with body `{ cartId, paymentIntentId, address_details }` → `Order`
- Verifies PaymentIntent status with Stripe before creating the order
- Clears `req.session.cartId` after success

```typescript
// Request body
interface PlaceOrderBody {
  cartId: number
  paymentIntentId: string
  address_details: {
    name: string
    street: string
    city: string
    postcode: string
  }
}

// Response
interface OrderResponse {
  id: number
  total_price: number
  currency: string
  status: string
  items: Array<{ quantity: number; price: number; currency: string; product: { id: number; name: string; primary_image: string } }>
  address_details: { name: string; street: string; city: string; postcode: string }
  payment_details: { card_last_four_digits: string }
}
```

- [ ] **Step 1: Write the failing test**

Add to `api/tests/orders.test.ts`:

```typescript
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

async function createConfirmedPaymentIntent(amountGbp: number) {
  const pi = await stripe.paymentIntents.create({
    amount: Math.round(amountGbp * 100),
    currency: 'gbp',
    automatic_payment_methods: { enabled: true, allow_redirects: 'never' },
    payment_method: 'pm_card_visa',
    confirm: true,
  })
  return pi
}

describe('POST /order', () => {
  it('creates an order from a confirmed payment intent', async () => {
    const ag = agent(app)
    await ag.post('/cart/products').send({ productId, quantity: 2 })
    const cartRes = await ag.get('/cart')
    const cartId = cartRes.body.id

    const pi = await createConfirmedPaymentIntent(30)

    const res = await ag
      .post('/order')
      .send({
        cartId,
        paymentIntentId: pi.id,
        address_details: {
          name: 'Jane Smith',
          street: '10 Downing Street',
          city: 'London',
          postcode: 'SW1A 2AA',
        },
      })
      .expect(201)

    expect(res.body).toMatchObject({
      total_price: 30,
      currency: 'GBP',
      status: 'confirmed',
      address_details: { name: 'Jane Smith', city: 'London' },
    })
    expect(res.body.payment_details.card_last_four_digits).toHaveLength(4)
    expect(res.body.items).toHaveLength(1)

    // Cart should be cleared after order
    const cartAfter = await ag.get('/cart')
    expect(cartAfter.body.items).toHaveLength(0)
  })

  it('returns 400 when paymentIntentId does not exist or is not succeeded', async () => {
    const ag = agent(app)
    await ag.post('/cart/products').send({ productId, quantity: 1 })
    const cartRes = await ag.get('/cart')

    const res = await ag
      .post('/order')
      .send({
        cartId: cartRes.body.id,
        paymentIntentId: 'pi_fake_id',
        address_details: { name: 'Jane', street: '1 St', city: 'London', postcode: 'SW1A 1AA' },
      })
      .expect(400)

    expect(res.body).toMatchObject({ error: expect.any(String) })
  })
})
```

- [ ] **Step 2: Run to confirm failure**

```bash
npm run test -w api -- --reporter=verbose
```

Expected: FAIL

- [ ] **Step 3: Create `api/src/routes/orders.ts`**

```typescript
import { Router } from 'express'
import Stripe from 'stripe'
import { PlaceOrderSchema } from '@marketplace/core'
import { prisma } from '../db/prisma.js'

const router = Router()
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

router.post('/', async (req, res, next) => {
  try {
    const parsed = PlaceOrderSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.errors[0].message, code: 'INVALID_INPUT' })
      return
    }
    const { cartId, paymentIntentId, address_details } = parsed.data

    let paymentIntent: Stripe.PaymentIntent
    try {
      paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId, {
        expand: ['payment_method'],
      })
    } catch {
      res.status(400).json({ error: 'Invalid payment intent', code: 'PAYMENT_FAILED' })
      return
    }

    if (paymentIntent.status !== 'succeeded') {
      res.status(400).json({ error: 'Payment not completed', code: 'PAYMENT_FAILED' })
      return
    }

    const cart = await prisma.cart.findUnique({
      where: { id: cartId },
      include: { items: { include: { product: true } } },
    })

    if (!cart || cart.items.length === 0) {
      res.status(404).json({ error: 'Cart not found or empty', code: 'NOT_FOUND' })
      return
    }

    const orderItems = cart.items.map((item) => ({
      product_id: item.product_id,
      quantity: item.quantity,
      price: Number(item.product.unit_price) * item.quantity,
    }))

    const totalPrice = orderItems.reduce((sum, item) => sum + item.price, 0)

    const pm = paymentIntent.payment_method
    const cardLastFour =
      pm && typeof pm === 'object' && pm.type === 'card' && pm.card?.last4
        ? pm.card.last4
        : '0000'

    const order = await prisma.order.create({
      data: {
        total_price: totalPrice,
        stripe_payment_id: paymentIntentId,
        card_last_four: cardLastFour,
        address_name: address_details.name,
        address_street: address_details.street,
        address_city: address_details.city,
        address_postcode: address_details.postcode,
        items: {
          create: orderItems,
        },
      },
      include: { items: { include: { product: true } } },
    })

    await prisma.cart.delete({ where: { id: cartId } })
    req.session.cartId = undefined

    const response = {
      id: order.id,
      total_price: Number(order.total_price),
      currency: order.currency,
      status: order.status,
      items: order.items.map((item) => ({
        quantity: item.quantity,
        price: Number(item.price),
        currency: 'GBP',
        product: {
          id: item.product.id,
          name: item.product.name,
          primary_image: item.product.primary_image,
        },
      })),
      address_details: {
        name: order.address_name,
        street: order.address_street,
        city: order.address_city,
        postcode: order.address_postcode,
      },
      payment_details: {
        card_last_four_digits: order.card_last_four,
      },
    }

    res.status(201).json(response)
  } catch (err) {
    next(err)
  }
})

export default router
```

- [ ] **Step 4: Run all API tests to confirm they pass**

```bash
npm run test -w api -- --reporter=verbose
```

Expected: PASS — all product, cart, and order tests ✓

- [ ] **Step 5: Commit**

```bash
git add api/src/routes/orders.ts api/tests/orders.test.ts
git commit -m "feat: add POST /order — place order via Stripe PaymentIntent"
```

---

## Phase 5 — Frontend Foundation

### Task 15: API Client + Stripe Loader

**Files:**
- Create: `web/lib/api.ts`
- Create: `web/lib/stripe.ts`

**Interfaces:**
- Produces: `fetchProducts()`, `fetchProduct(id)`, `fetchCart()`, `addToCart(productId, quantity)`, `updateCartItem(productId, quantity)`, `removeFromCart(productId)`, `createPaymentIntent(cartId)`, `placeOrder(body)` — all typed, all throw on error with `ApiError`
- Consumes: `Cart`, `Order`, `Product` types from `@marketplace/core` (defined in Task 3)

> Types live in `@marketplace/core`. This task only creates the fetch wrappers and Stripe loader — no type duplication.

- [ ] **Step 1: Create `web/lib/api.ts`**

```typescript
import type { Cart, Order, Product } from '@marketplace/core'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: 'Request failed' }))
    throw Object.assign(new Error(body.error ?? 'Request failed'), { code: body.code, status: res.status })
  }

  return res.json() as Promise<T>
}

export function fetchProducts() {
  return apiFetch<{ results: Omit<Product, 'description' | 'image_urls'>[] }>('/products')
}

export function fetchProduct(id: number) {
  return apiFetch<Product>(`/products/${id}`)
}

export function fetchCart() {
  return apiFetch<Cart>('/cart')
}

export function addToCart(productId: number, quantity: number) {
  return apiFetch<Cart>('/cart/products', {
    method: 'POST',
    body: JSON.stringify({ productId, quantity }),
  })
}

export function updateCartItem(productId: number, quantity: number) {
  return apiFetch<Cart>(`/cart/products/${productId}`, {
    method: 'PUT',
    body: JSON.stringify({ quantity }),
  })
}

export function removeFromCart(productId: number) {
  return apiFetch<Cart>(`/cart/products/${productId}`, { method: 'DELETE' })
}

export function createPaymentIntent(cartId: number) {
  return apiFetch<{ clientSecret: string; amount: number }>('/checkout/payment-intent', {
    method: 'POST',
    body: JSON.stringify({ cartId }),
  })
}

export function placeOrder(body: {
  cartId: number
  paymentIntentId: string
  address_details: { name: string; street: string; city: string; postcode: string }
}) {
  return apiFetch<Order>('/order', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}
```

- [ ] **Step 3: Create `web/lib/stripe.ts`**

```typescript
import { loadStripe } from '@stripe/stripe-js'

export const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!,
)
```

- [ ] **Step 3: Type-check**

```bash
cd web && npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add web/lib/
git commit -m "feat: add typed API client and Stripe loader for web"
```

---

### Task 16: Root Layout + Navigation

**Files:**
- Create: `web/components/nav.tsx`
- Modify: `web/app/layout.tsx`

**Interfaces:**
- Produces: `<Nav>` — server component that fetches cart and displays item count badge
- Consumes: `fetchCart()` from `web/lib/api.ts`

- [ ] **Step 1: Create `web/components/nav.tsx`**

```typescript
import Link from 'next/link'
import { fetchCart } from '@/lib/api'

export async function Nav() {
  let itemCount = 0
  try {
    const cart = await fetchCart()
    itemCount = cart.items.reduce((sum, item) => sum + item.quantity, 0)
  } catch {
    // cart fetch fails gracefully — show 0
  }

  return (
    <header>
      <nav aria-label="Main navigation">
        <Link href="/" aria-label="Marketplace home">
          Marketplace
        </Link>
        <Link href="/cart" aria-label={`Cart, ${itemCount} item${itemCount !== 1 ? 's' : ''}`}>
          Cart
          {itemCount > 0 && (
            <span aria-hidden="true"> ({itemCount})</span>
          )}
        </Link>
      </nav>
    </header>
  )
}
```

- [ ] **Step 2: Update `web/app/layout.tsx`**

```typescript
import type { Metadata } from 'next'
import { Nav } from '@/components/nav'

export const metadata: Metadata = {
  title: { default: 'Marketplace', template: '%s | Marketplace' },
  description: 'Quality clothing and accessories.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Nav />
        <main id="main-content">{children}</main>
      </body>
    </html>
  )
}
```

- [ ] **Step 3: Verify**

Start both servers and visit `http://localhost:3000`. Expected: page renders with "Marketplace" and "Cart" navigation links.

```bash
npm run dev:api &
npm run dev:web
```

- [ ] **Step 4: Commit**

```bash
git add web/components/nav.tsx web/app/layout.tsx
git commit -m "feat: add root layout with navigation and cart badge"
```

---

## Phase 6 — Product Pages

### Task 17: Product Listing Page (PLP)

**Files:**
- Create: `web/components/product-card.tsx`
- Modify: `web/app/page.tsx`

**Interfaces:**
- Consumes: `fetchProducts()` → `{ results: Product[] }`
- Produces: SSR page at `/` displaying a grid of product cards

- [ ] **Step 1: Create `web/components/product-card.tsx`**

```typescript
import Image from 'next/image'
import Link from 'next/link'

interface Props {
  id: number
  name: string
  primary_image: string
  unit_price: number
  currency: string
}

export function ProductCard({ id, name, primary_image, unit_price, currency }: Props) {
  return (
    <article>
      <Link href={`/products/${id}`}>
        <Image
          src={primary_image}
          alt={name}
          width={400}
          height={400}
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          style={{ width: '100%', height: 'auto', aspectRatio: '1 / 1', objectFit: 'cover' }}
        />
        <h2>{name}</h2>
        <p aria-label={`Price: ${currency} ${unit_price.toFixed(2)}`}>
          {currency === 'GBP' ? '£' : currency}{unit_price.toFixed(2)}
        </p>
      </Link>
    </article>
  )
}
```

- [ ] **Step 2: Update `web/app/page.tsx`**

```typescript
import type { Metadata } from 'next'
import { fetchProducts } from '@/lib/api'
import { ProductCard } from '@/components/product-card'

export const metadata: Metadata = {
  title: 'Shop All Products',
  description: 'Browse our full range of clothing and accessories.',
}

export default async function ProductListingPage() {
  const { results } = await fetchProducts()

  return (
    <>
      <h1>All Products</h1>
      {results.length === 0 ? (
        <p>No products available.</p>
      ) : (
        <ul aria-label="Product listing" style={{ display: 'grid', listStyle: 'none', padding: 0 }}>
          {results.map((product) => (
            <li key={product.id}>
              <ProductCard {...product} />
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
```

- [ ] **Step 3: Seed products and verify in browser**

```bash
npm run db:seed -w api
```

Visit `http://localhost:3000`. Expected: grid of 6 product cards with names and prices.

- [ ] **Step 4: Commit**

```bash
git add web/components/product-card.tsx web/app/page.tsx
git commit -m "feat: add Product Listing Page with SSR product grid"
```

---

### Task 18: Product Detail Page (PDP)

**Files:**
- Create: `web/components/product-gallery.tsx`
- Create: `web/components/add-to-cart-button.tsx`
- Create: `web/app/products/[id]/page.tsx`

**Interfaces:**
- Consumes: `fetchProduct(id)` → full `Product`
- Produces: SSR page at `/products/:id` with image gallery, description, price, and add-to-cart button

- [ ] **Step 1: Create `web/components/product-gallery.tsx`**

```typescript
'use client'

import Image from 'next/image'
import { useState } from 'react'

interface Props {
  images: string[]
  productName: string
}

export function ProductGallery({ images, productName }: Props) {
  const [selected, setSelected] = useState(0)

  return (
    <div>
      <Image
        src={images[selected]}
        alt={productName}
        width={800}
        height={800}
        priority
        style={{ width: '100%', height: 'auto', objectFit: 'cover' }}
      />
      {images.length > 1 && (
        <div role="list" aria-label="Product images">
          {images.map((src, i) => (
            <button
              key={src}
              role="listitem"
              onClick={() => setSelected(i)}
              aria-label={`View image ${i + 1}`}
              aria-pressed={selected === i}
            >
              <Image
                src={src}
                alt={`${productName} view ${i + 1}`}
                width={80}
                height={80}
                style={{ objectFit: 'cover' }}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Create `web/components/add-to-cart-button.tsx`**

```typescript
'use client'

import { useState } from 'react'
import { addToCart } from '@/lib/api'
import { useRouter } from 'next/navigation'

interface Props {
  productId: number
}

export function AddToCartButton({ productId }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  async function handleClick() {
    setLoading(true)
    setError(null)
    try {
      await addToCart(productId, 1)
      router.refresh() // re-fetches Nav to update cart badge
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add to cart')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <button onClick={handleClick} disabled={loading} aria-busy={loading}>
        {loading ? 'Adding...' : 'Add to Cart'}
      </button>
      {error && <p role="alert">{error}</p>}
    </div>
  )
}
```

- [ ] **Step 3: Create `web/app/products/[id]/page.tsx`**

```typescript
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { fetchProduct } from '@/lib/api'
import { ProductGallery } from '@/components/product-gallery'
import { AddToCartButton } from '@/components/add-to-cart-button'

interface Props {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const product = await fetchProduct(parseInt(id, 10)).catch(() => null)
  if (!product) return {}
  return {
    title: product.name,
    description: product.description,
    openGraph: {
      title: product.name,
      description: product.description,
      images: [product.primary_image],
    },
  }
}

export default async function ProductDetailPage({ params }: Props) {
  const { id } = await params
  const product = await fetchProduct(parseInt(id, 10)).catch(() => null)

  if (!product) notFound()

  return (
    <article aria-label={product.name}>
      <ProductGallery images={product.image_urls} productName={product.name} />
      <div>
        <h1>{product.name}</h1>
        <p>{product.description}</p>
        <p aria-label={`Price: £${product.unit_price.toFixed(2)}`}>
          £{product.unit_price.toFixed(2)}
        </p>
        <AddToCartButton productId={product.id} />
      </div>
    </article>
  )
}
```

- [ ] **Step 4: Verify in browser**

Visit `http://localhost:3000/products/1`. Expected: product image gallery, name, description, price, "Add to Cart" button. Clicking "Add to Cart" updates the nav badge.

- [ ] **Step 5: Commit**

```bash
git add web/components/product-gallery.tsx web/components/add-to-cart-button.tsx web/app/products/
git commit -m "feat: add Product Detail Page with image gallery and add-to-cart"
```

---

## Phase 7 — Cart Page

### Task 19: Cart Page

**Files:**
- Create: `web/components/cart-item-row.tsx`
- Create: `web/app/cart/page.tsx`

**Interfaces:**
- Consumes: `fetchCart()`, `updateCartItem(productId, quantity)`, `removeFromCart(productId)`
- Produces: SSR cart page at `/cart` showing items with quantity controls and order total

- [ ] **Step 1: Create `web/components/cart-item-row.tsx`**

```typescript
'use client'

import Image from 'next/image'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { updateCartItem, removeFromCart } from '@/lib/api'
import type { CartItem } from '@marketplace/core'

interface Props {
  item: CartItem
}

export function CartItemRow({ item }: Props) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleQuantityChange(newQty: number) {
    setLoading(true)
    try {
      await updateCartItem(item.product.id, newQty)
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  async function handleRemove() {
    setLoading(true)
    try {
      await removeFromCart(item.product.id)
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  return (
    <li aria-label={item.product.name}>
      <Image
        src={item.product.primary_image}
        alt={item.product.name}
        width={80}
        height={80}
        style={{ objectFit: 'cover' }}
      />
      <div>
        <p>{item.product.name}</p>
        <p aria-label={`Item total: £${item.price.toFixed(2)}`}>£{item.price.toFixed(2)}</p>
        <div>
          <button
            onClick={() => handleQuantityChange(item.quantity - 1)}
            disabled={loading || item.quantity <= 1}
            aria-label="Decrease quantity"
          >
            −
          </button>
          <span aria-label={`Quantity: ${item.quantity}`}>{item.quantity}</span>
          <button
            onClick={() => handleQuantityChange(item.quantity + 1)}
            disabled={loading}
            aria-label="Increase quantity"
          >
            +
          </button>
        </div>
        <button onClick={handleRemove} disabled={loading} aria-label={`Remove ${item.product.name}`}>
          Remove
        </button>
      </div>
    </li>
  )
}
```

- [ ] **Step 2: Create `web/app/cart/page.tsx`**

```typescript
import type { Metadata } from 'next'
import Link from 'next/link'
import { fetchCart } from '@/lib/api'
import { CartItemRow } from '@/components/cart-item-row'

export const metadata: Metadata = { title: 'Your Cart' }

export default async function CartPage() {
  const cart = await fetchCart()

  if (cart.items.length === 0) {
    return (
      <>
        <h1>Your Cart</h1>
        <p>Your cart is empty.</p>
        <Link href="/">Continue Shopping</Link>
      </>
    )
  }

  return (
    <>
      <h1>Your Cart</h1>
      <ul aria-label="Cart items">
        {cart.items.map((item) => (
          <CartItemRow key={item.product.id} item={item} />
        ))}
      </ul>
      <div>
        <p aria-label={`Order total: £${cart.total_price.toFixed(2)}`}>
          Total: £{cart.total_price.toFixed(2)}
        </p>
        <Link href="/checkout">
          Proceed to Checkout
        </Link>
      </div>
    </>
  )
}
```

- [ ] **Step 3: Verify in browser**

Add a product to cart via a PDP page. Visit `http://localhost:3000/cart`. Expected: item listed with quantity controls, total, and "Proceed to Checkout" link.

- [ ] **Step 4: Commit**

```bash
git add web/components/cart-item-row.tsx web/app/cart/
git commit -m "feat: add Cart page with quantity controls and remove"
```

---

## Phase 8 — Checkout & Confirmation

### Task 20: Checkout Page

**Files:**
- Create: `web/components/address-form.tsx`
- Create: `web/components/stripe-payment-form.tsx`
- Create: `web/app/checkout/page.tsx`

**Interfaces:**
- Consumes: `fetchCart()`, `createPaymentIntent(cartId)`, `placeOrder(body)`
- Produces: client-side checkout page at `/checkout` with UK address form and Stripe CardElement
- On success: redirects to `/order-confirmation/:id`

> `stripe.confirmCardPayment` is used (not `stripe.confirmPayment`) to avoid redirects. `allow_redirects: 'never'` was set on the PaymentIntent in Task 12.

- [ ] **Step 1: Create `web/components/address-form.tsx`**

```typescript
import type { UseFormRegister, FieldErrors } from 'react-hook-form'
import type { AddressInput } from '@marketplace/core'

interface Props {
  register: UseFormRegister<AddressInput>
  errors: FieldErrors<AddressInput>
}

export function AddressForm({ register, errors }: Props) {
  return (
    <fieldset>
      <legend>Delivery Address</legend>

      <div>
        <label htmlFor="name">Full name</label>
        <input
          id="name"
          type="text"
          autoComplete="name"
          aria-describedby={errors.name ? 'name-error' : undefined}
          aria-invalid={!!errors.name}
          {...register('name')}
        />
        {errors.name && <p id="name-error" role="alert">{errors.name.message}</p>}
      </div>

      <div>
        <label htmlFor="street">Street address</label>
        <input
          id="street"
          type="text"
          autoComplete="address-line1"
          aria-describedby={errors.street ? 'street-error' : undefined}
          aria-invalid={!!errors.street}
          {...register('street')}
        />
        {errors.street && <p id="street-error" role="alert">{errors.street.message}</p>}
      </div>

      <div>
        <label htmlFor="city">City</label>
        <input
          id="city"
          type="text"
          autoComplete="address-level2"
          aria-invalid={!!errors.city}
          {...register('city')}
        />
        {errors.city && <p role="alert">{errors.city.message}</p>}
      </div>

      <div>
        <label htmlFor="postcode">Postcode</label>
        <input
          id="postcode"
          type="text"
          autoComplete="postal-code"
          aria-invalid={!!errors.postcode}
          {...register('postcode')}
        />
        {errors.postcode && <p role="alert">{errors.postcode.message}</p>}
      </div>
    </fieldset>
  )
}
```

- [ ] **Step 2: Create `web/components/stripe-payment-form.tsx`**

```typescript
'use client'

import { CardElement } from '@stripe/react-stripe-js'

export function StripePaymentForm() {
  return (
    <fieldset>
      <legend>Payment Details</legend>
      <div>
        <label htmlFor="card-element">Card details</label>
        <div id="card-element" role="group" aria-label="Credit or debit card">
          <CardElement
            options={{
              style: { base: { fontSize: '16px' } },
              hidePostalCode: true,
            }}
          />
        </div>
        <p>Test card: 4242 4242 4242 4242 · Any future date · Any CVC</p>
      </div>
    </fieldset>
  )
}
```

- [ ] **Step 3: Create `web/app/checkout/page.tsx`**

```typescript
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { AddressSchema, type AddressInput } from '@marketplace/core'
import { Elements, useStripe, useElements, CardElement } from '@stripe/react-stripe-js'
import { stripePromise } from '@/lib/stripe'
import { fetchCart, createPaymentIntent, placeOrder } from '@/lib/api'
import { AddressForm } from '@/components/address-form'
import { StripePaymentForm } from '@/components/stripe-payment-form'
import type { Cart } from '@marketplace/core'

export type CheckoutFormValues = AddressInput

function CheckoutForm({ cart }: { cart: Cart }) {
  const stripe = useStripe()
  const elements = useElements()
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const { register, handleSubmit, formState: { errors } } = useForm<CheckoutFormValues>({
    resolver: zodResolver(AddressSchema),
  })

  async function onSubmit(values: CheckoutFormValues) {
    if (!stripe || !elements || !cart.id) return
    setSubmitting(true)
    setFormError(null)

    try {
      const { clientSecret } = await createPaymentIntent(cart.id)

      const cardElement = elements.getElement(CardElement)
      if (!cardElement) throw new Error('Card element not mounted')

      const { error, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
        payment_method: {
          card: cardElement,
          billing_details: { name: values.name, address: { country: 'GB' } },
        },
      })

      if (error || !paymentIntent) {
        setFormError(error?.message ?? 'Payment failed. Please try again.')
        return
      }

      const order = await placeOrder({
        cartId: cart.id,
        paymentIntentId: paymentIntent.id,
        address_details: values,
      })

      router.push(`/order-confirmation/${order.id}`)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} aria-label="Checkout form" noValidate>
      <h1>Checkout</h1>

      <AddressForm register={register} errors={errors} />
      <StripePaymentForm />

      <div>
        <p aria-label={`Order total: £${cart.total_price.toFixed(2)}`}>
          Total: £{cart.total_price.toFixed(2)}
        </p>
        <button type="submit" disabled={submitting || !stripe} aria-busy={submitting}>
          {submitting ? 'Processing...' : 'Place Order'}
        </button>
      </div>

      {formError && <p role="alert">{formError}</p>}
    </form>
  )
}

export default function CheckoutPage() {
  const [cart, setCart] = useState<Cart | null>(null)
  const router = useRouter()

  useEffect(() => {
    fetchCart().then((c) => {
      if (!c.id || c.items.length === 0) {
        router.push('/cart')
        return
      }
      setCart(c)
    })
  }, [router])

  if (!cart) return <p aria-busy="true">Loading...</p>

  return (
    <Elements stripe={stripePromise}>
      <CheckoutForm cart={cart} />
    </Elements>
  )
}
```

- [ ] **Step 4: Verify in browser**

Add product to cart, go to `/cart`, click "Proceed to Checkout". Expected: form with address fields and Stripe card input. Fill with test card `4242 4242 4242 4242`, any future date, any CVC, any postcode in format `SW1A 2AA`. Submit. Expected: redirect to `/order-confirmation/:id`.

- [ ] **Step 5: Commit**

```bash
git add web/components/address-form.tsx web/components/stripe-payment-form.tsx web/app/checkout/
git commit -m "feat: add Checkout page with address form and Stripe payment"
```

---

### Task 21: Order Confirmation Page

**Files:**
- Create: `web/app/order-confirmation/[id]/page.tsx`

**Interfaces:**
- Consumes: Order ID from URL params; order details are passed via `router.push` state — but since Next.js server components can't read router state, fetch the order from the API.
- Note: A `GET /order/:id` endpoint is needed. Add it to the orders router in the API.

- [ ] **Step 1: Add `GET /order/:id` to the API**

Add to `api/src/routes/orders.ts`:

```typescript
router.get('/:id', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10)
    if (isNaN(id)) {
      res.status(404).json({ error: 'Order not found', code: 'NOT_FOUND' })
      return
    }

    const order = await prisma.order.findUnique({
      where: { id },
      include: { items: { include: { product: true } } },
    })

    if (!order) {
      res.status(404).json({ error: 'Order not found', code: 'NOT_FOUND' })
      return
    }

    res.json({
      id: order.id,
      total_price: Number(order.total_price),
      currency: order.currency,
      status: order.status,
      items: order.items.map((item) => ({
        quantity: item.quantity,
        price: Number(item.price),
        currency: 'GBP',
        product: {
          id: item.product.id,
          name: item.product.name,
          primary_image: item.product.primary_image,
        },
      })),
      address_details: {
        name: order.address_name,
        street: order.address_street,
        city: order.address_city,
        postcode: order.address_postcode,
      },
      payment_details: { card_last_four_digits: order.card_last_four },
    })
  } catch (err) {
    next(err)
  }
})
```

Also add `fetchOrder` to `web/lib/api.ts`:

```typescript
export function fetchOrder(id: number) {
  return apiFetch<Order>(`/order/${id}`)
}
```

- [ ] **Step 2: Create `web/app/order-confirmation/[id]/page.tsx`**

```typescript
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { fetchOrder } from '@/lib/api'

interface Props {
  params: Promise<{ id: string }>
}

export const metadata: Metadata = { title: 'Order Confirmed' }

export default async function OrderConfirmationPage({ params }: Props) {
  const { id } = await params
  const order = await fetchOrder(parseInt(id, 10)).catch(() => null)

  if (!order) notFound()

  return (
    <article aria-label="Order confirmation">
      <h1>Order Confirmed</h1>
      <p>Thank you for your order. Your order number is <strong>#{order.id}</strong>.</p>

      <section aria-label="Order summary">
        <h2>Order Summary</h2>
        <ul>
          {order.items.map((item) => (
            <li key={item.product.id}>
              {item.product.name} × {item.quantity} —{' '}
              £{item.price.toFixed(2)}
            </li>
          ))}
        </ul>
        <p aria-label={`Total: £${order.total_price.toFixed(2)}`}>
          <strong>Total: £{order.total_price.toFixed(2)}</strong>
        </p>
      </section>

      <section aria-label="Delivery details">
        <h2>Delivering to</h2>
        <address>
          {order.address_details.name}<br />
          {order.address_details.street}<br />
          {order.address_details.city}<br />
          {order.address_details.postcode}
        </address>
      </section>

      <section aria-label="Payment details">
        <h2>Payment</h2>
        <p>Card ending in {order.payment_details.card_last_four_digits}</p>
      </section>

      <Link href="/">Continue Shopping</Link>
    </article>
  )
}
```

- [ ] **Step 3: Verify in browser**

Complete a checkout. Expected: redirect to `/order-confirmation/:id` with order ID, item list, address, and last 4 card digits shown.

- [ ] **Step 4: Commit**

```bash
git add web/app/order-confirmation/ api/src/routes/orders.ts web/lib/api.ts
git commit -m "feat: add Order Confirmation page and GET /order/:id endpoint"
```

---

## Phase 9 — SEO & Images

### Task 22: Image Optimization

**Files:**
- Modify: `web/next.config.ts` (add image formats — already done in Task 5)
- Audit: `web/components/product-card.tsx`, `web/components/product-gallery.tsx`, `web/components/cart-item-row.tsx`

> Next.js `<Image>` already handles AVIF/WebP via the `formats` config set in Task 5. This task verifies correct `sizes`, `priority`, and `loading` attributes are set on all images.

- [ ] **Step 1: Audit all `<Image>` usages**

Check each file against these rules:
- PLP (`product-card.tsx`): `sizes` set for responsive grid ✓ (set in Task 16)
- PDP (`product-gallery.tsx`): primary image has `priority` ✓ (set in Task 17)
- Cart (`cart-item-row.tsx`): thumbnail images — add explicit `width/height` and no `priority`

In `web/components/cart-item-row.tsx`, confirm the `<Image>` has:
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

- [ ] **Step 2: Add `sizes` to PDP gallery thumbnails in `web/components/product-gallery.tsx`**

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
git add web/components/product-gallery.tsx
git commit -m "perf: add correct sizes attribute to PDP thumbnail images"
```

---

### Task 23: SEO — Metadata, JSON-LD, and Sitemap

**Files:**
- Modify: `web/app/layout.tsx` (add base OG metadata)
- Modify: `web/app/page.tsx` (already has metadata — add OG)
- Modify: `web/app/products/[id]/page.tsx` (already has metadata + OG — add JSON-LD)
- Create: `web/app/sitemap.ts`

**Interfaces:**
- Produces: `GET /sitemap.xml` — lists PLP and all PDP URLs for crawlers

- [ ] **Step 1: Add base Open Graph metadata to `web/app/layout.tsx`**

Update the `metadata` export:

```typescript
export const metadata: Metadata = {
  title: { default: 'Marketplace', template: '%s | Marketplace' },
  description: 'Quality clothing and accessories, delivered to your door.',
  openGraph: {
    siteName: 'Marketplace',
    locale: 'en_GB',
    type: 'website',
  },
}
```

- [ ] **Step 2: Add JSON-LD structured data to `web/app/products/[id]/page.tsx`**

Add a `<script>` tag inside the returned JSX with Product schema:

```typescript
const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Product',
  name: product.name,
  description: product.description,
  image: product.image_urls,
  offers: {
    '@type': 'Offer',
    priceCurrency: product.currency,
    price: product.unit_price.toFixed(2),
    availability: 'https://schema.org/InStock',
    seller: { '@type': 'Organization', name: 'Marketplace' },
  },
}
```

Add inside the returned JSX (after `<article>`):
```typescript
<script
  type="application/ld+json"
  dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
/>
```

- [ ] **Step 3: Create `web/app/sitemap.ts`**

```typescript
import type { MetadataRoute } from 'next'
import { fetchProducts } from '@/lib/api'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'

  const { results } = await fetchProducts()

  const productUrls: MetadataRoute.Sitemap = results.map((product) => ({
    url: `${BASE_URL}/products/${product.id}`,
    lastModified: new Date(),
    changeFrequency: 'weekly',
    priority: 0.8,
  }))

  return [
    { url: BASE_URL, lastModified: new Date(), changeFrequency: 'daily', priority: 1 },
    ...productUrls,
  ]
}
```

Add `NEXT_PUBLIC_SITE_URL=http://localhost:3000` to `web/.env.local`.

- [ ] **Step 4: Verify**

```bash
curl http://localhost:3000/sitemap.xml
```

Expected: XML with URLs for `/` and `/products/1` through `/products/6`.

- [ ] **Step 5: Commit**

```bash
git add web/app/layout.tsx web/app/page.tsx web/app/products/ web/app/sitemap.ts
git commit -m "feat: add SEO metadata, JSON-LD structured data, and sitemap.xml"
```

---

## Phase 10 — End-to-End Tests

### Task 24: E2E — Browse Products

**Files:**
- Create: `web/tests/e2e/browse.spec.ts`

- [ ] **Step 1: Write the test**

```typescript
import { test, expect } from '@playwright/test'

test.describe('Product browsing', () => {
  test('PLP shows a list of products', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'All Products' })).toBeVisible()
    const products = page.getByRole('listitem')
    await expect(products).toHaveCount(6)
  })

  test('clicking a product navigates to the PDP', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('listitem').first().getByRole('link').click()
    await expect(page).toHaveURL(/\/products\/\d+/)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  })

  test('PDP shows product name, description, price, and add-to-cart button', async ({ page }) => {
    await page.goto('/products/1')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Add to Cart' })).toBeVisible()
  })

  test('PDP has JSON-LD structured data', async ({ page }) => {
    await page.goto('/products/1')
    const jsonLd = await page.$eval(
      'script[type="application/ld+json"]',
      (el) => JSON.parse(el.textContent ?? '{}'),
    )
    expect(jsonLd['@type']).toBe('Product')
    expect(jsonLd.name).toBeTruthy()
  })

  test('sitemap.xml is accessible', async ({ page }) => {
    const res = await page.goto('/sitemap.xml')
    expect(res?.status()).toBe(200)
    expect(res?.headers()['content-type']).toContain('xml')
  })
})
```

- [ ] **Step 2: Run the tests**

Ensure both servers are running, then:

```bash
npm run test:e2e -w web -- browse.spec.ts
```

Expected: PASS — all 5 tests ✓

- [ ] **Step 3: Commit**

```bash
git add web/tests/e2e/browse.spec.ts
git commit -m "test: add E2E tests for product browsing"
```

---

### Task 25: E2E — Cart Flow

**Files:**
- Create: `web/tests/e2e/cart.spec.ts`

- [ ] **Step 1: Write the test**

```typescript
import { test, expect } from '@playwright/test'

test.describe('Cart flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/products/1')
    await page.getByRole('button', { name: 'Add to Cart' }).click()
    await expect(page.getByRole('link', { name: /Cart/ })).toContainText('(')
  })

  test('added item appears in the cart', async ({ page }) => {
    await page.goto('/cart')
    await expect(page.getByRole('list', { name: 'Cart items' })).toBeVisible()
    const items = page.getByRole('listitem')
    await expect(items).toHaveCount(1)
  })

  test('cart shows the correct total', async ({ page }) => {
    await page.goto('/cart')
    const total = page.getByLabel(/Order total/)
    await expect(total).toBeVisible()
    await expect(total).toContainText('£')
  })

  test('increasing quantity updates the total', async ({ page }) => {
    await page.goto('/cart')
    const increaseBtn = page.getByRole('button', { name: 'Increase quantity' })
    await increaseBtn.click()
    await page.waitForLoadState('networkidle')
    const item = page.getByRole('listitem').first()
    await expect(item.getByLabel(/Quantity/)).toContainText('2')
  })

  test('removing an item empties the cart', async ({ page }) => {
    await page.goto('/cart')
    await page.getByRole('button', { name: /Remove/ }).click()
    await page.waitForLoadState('networkidle')
    await expect(page.getByText('Your cart is empty')).toBeVisible()
  })
})
```

- [ ] **Step 2: Run the tests**

```bash
npm run test:e2e -w web -- cart.spec.ts
```

Expected: PASS — all 5 tests ✓

- [ ] **Step 3: Commit**

```bash
git add web/tests/e2e/cart.spec.ts
git commit -m "test: add E2E tests for cart flow"
```

---

### Task 26: E2E — Checkout Flow

**Files:**
- Create: `web/tests/e2e/checkout.spec.ts`

> Uses Stripe test card `4242 4242 4242 4242`. Stripe's CardElement renders inside an iframe — use `page.frameLocator` to interact with it.

- [ ] **Step 1: Write the test**

```typescript
import { test, expect } from '@playwright/test'

test.describe('Checkout flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/products/1')
    await page.getByRole('button', { name: 'Add to Cart' }).click()
    await page.waitForLoadState('networkidle')
  })

  test('redirects to /cart when checkout is visited with empty cart', async ({ page }) => {
    // New context = fresh session = empty cart
    await page.goto('/checkout')
    // Give client-side redirect time to run
    await page.waitForURL(/\/cart/)
    await expect(page).toHaveURL('/cart')
  })

  test('completes a full purchase and lands on order confirmation', async ({ page }) => {
    await page.goto('/checkout')
    await expect(page.getByRole('heading', { name: 'Checkout' })).toBeVisible()

    // Fill address
    await page.getByLabel('Full name').fill('Jane Smith')
    await page.getByLabel('Street address').fill('10 Downing Street')
    await page.getByLabel('City').fill('London')
    await page.getByLabel('Postcode').fill('SW1A 2AA')

    // Fill Stripe card (inside iframe)
    const stripeFrame = page.frameLocator('iframe[name^="__privateStripeFrame"]').first()
    await stripeFrame.getByRole('textbox', { name: 'Card number' }).fill('4242424242424242')
    await stripeFrame.getByRole('textbox', { name: /expiry/i }).fill('12/30')
    await stripeFrame.getByRole('textbox', { name: /CVC/i }).fill('123')

    await page.getByRole('button', { name: 'Place Order' }).click()

    // Wait for redirect to order confirmation (Stripe payment takes a moment)
    await page.waitForURL(/\/order-confirmation\/\d+/, { timeout: 15000 })

    await expect(page.getByRole('heading', { name: 'Order Confirmed' })).toBeVisible()
    await expect(page.getByText(/Jane Smith/)).toBeVisible()
    await expect(page.getByText(/Card ending in/)).toBeVisible()
  })

  test('shows a validation error when address fields are empty', async ({ page }) => {
    await page.goto('/checkout')
    await page.getByRole('button', { name: 'Place Order' }).click()
    await expect(page.getByRole('alert').first()).toBeVisible()
  })
})
```

- [ ] **Step 2: Run the tests**

```bash
npm run test:e2e -w web -- checkout.spec.ts
```

Expected: PASS — all 3 tests ✓

- [ ] **Step 3: Run the full E2E suite**

```bash
npm run test:e2e -w web
```

Expected: all 13 E2E tests pass across chromium and mobile viewports

- [ ] **Step 4: Run the full API test suite**

```bash
npm run test:api
```

Expected: all API tests pass

- [ ] **Step 5: Final commit**

```bash
git add web/tests/e2e/checkout.spec.ts
git commit -m "test: add E2E tests for checkout and order confirmation flow"
```

---

## Summary

| Phase | Tasks | Key Deliverables |
|-------|-------|-----------------|
| 1 — Infrastructure | 1–6 | Docker/PG, API scaffold, `@marketplace/core` (shared types + schemas), Prisma schema+seed, sessions, Next.js scaffold |
| 2 — Product API | 7–8 | `GET /products`, `GET /products/:id` |
| 3 — Cart API | 9–12 | `GET/POST/PUT/DELETE /cart/products` with session-tied carts |
| 4 — Checkout & Order API | 13–14 | Stripe PaymentIntent, `POST /order` |
| 5 — Frontend Foundation | 15–16 | API client, layout, nav with cart badge |
| 6 — Product Pages | 17–18 | PLP grid, PDP with gallery and add-to-cart |
| 7 — Cart Page | 19 | Cart with qty controls and remove |
| 8 — Checkout & Confirmation | 20–21 | Checkout form + Stripe, order confirmation |
| 9 — SEO & Images | 22–23 | AVIF/WebP, metadata, JSON-LD, sitemap.xml |
| 10 — E2E Tests | 24–26 | Browse, cart, and full checkout flows |
