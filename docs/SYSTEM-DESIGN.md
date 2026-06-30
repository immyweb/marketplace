# Marketplace

Design an e-commerce website that allows users to browse products and purchase them (like Amazon).

## Requirements

### Users

- UK users of a wide age range.

### Core User Features

- Browsing products
- Adding products to cart
- Checking out successfully

### Pages

- Product Listing Page (PLP)
  - Product name
  - Product image
  - Price
- Product Detail Page (PDP)
  - Product name
  - Product images (multiple)
  - Product description
  - Price
- Cart Page
- Checkout Page
- Order Confirmation Page
  - Order ID
  - Order summary (items, total)

### Devices

- All possible devices (desktop, tablet, mobile)

### Other requirements

- Each page should load under 2 seconds. Interactions with page elements should respond quickly.
- SEO required
- Full accessibility
- Optimised for Core Web Vitals
- AVIF/WebP image stacks with <picture>
- User can purchase as a guest without being signed in.

## Architecture

### Rendering architecture

- Server-Side Rendering (SSR)
  - Better performance
  - Allows for personalisation
  - Better for SEO
  - Better CLS

### Page architecture

- Most important factor that SSR is used.

### APIs

- Direct API calls
- REST

### Session Management

- Anonymous sessions are created on the user's first request.
- A session cookie is set by the server to identify the session across requests.
- Sessions are stored in PostgreSQL (using the existing database).
- The cart is tied to the session — no login required.

## Data Model

### ProductList

- products (Products[])

### Product

- id (number)
- name (string)
- description (string)
- primary_image (string)
- image_urls (string[])
- unit_price (number)
- currency (string)

### Cart

- id (number)
- items (CartItem[])
- total_price (number)
- currency (string)

### CartItem

- product_id (number)
- quantity (number)
- price (number)
- currency (string)

### AddressDetails

- name (string)
- country (string)
- street (string)
- city (string)

### PaymentDetails

- card_number
- card_expiry
- card_cvv

### Order

- id (number)
- total_price (number)
- currency (string)
- status (string)

Server is source of truth for cart totals and prices.

## APIs

1. Product Information
   - Fetch products listing
   - Fetch a particular product’s detail

2. Cart Modification
   - Add a product to the cart
   - Change quantity of a product in the cart
   - Remove a product from the cart

3. Complete the order

### Fetch Product Listings

GET
`/products`

Sample response:

```json
{
  "results": [
    {
      "id": 123,
      "name": "Cotton T-shirt",
      "primary_image": "https://www.greatcdn.com/img/t-shirt.jpg",
      "unit_price": 12,
      "currency": "GBP"
    }
  ]
}
```

### Fetch Product Details

GET
`/products/{productId}`
Params:

- productId

`/products/123`

Sample response:

```
{
  "id": 123, // Product ID.
  "name": "Cotton T-shirt",
  "primary_image": "https://www.greatcdn.com/img/t-shirt.jpg",
  "image_urls": [
    "https://www.greatcdn.com/img/t-shirt.jpg",
    "https://www.greatcdn.com/img/t-shirt-black.jpg",
    "https://www.greatcdn.com/img/t-shirt-red.jpg"
  ],
  "unit_price": 12,
  "currency": "GBP"
}
```

### Add a product to cart

POST
`/cart/products`
params:

- productId
- quantity

`/cart/products?id=789123&quantity=2`

Sample response:

```
{
  "id": 789, // Cart ID.
  "total_price": 24,
  "currency": "GBP",
  "items": [
    {
      "quantity": 2,
      "price": 24,
      "currency": "GBP",
      "product": {
        "id": 123, // Product ID.
        "name": "Cotton T-shirt",
        "primary_image": "https://www.greatcdn.com/img/t-shirt.jpg"
      }
    }
  ]
}
```

On client side, add-to-cart benefits from optimistic updates.

### Change quantity of a product in the cart

PUT
`/cart/products/{productId}`
Params:

- productId
- quantity

Updated cart object is returned:

```
{
  "id": 789, // Cart ID.
  "total_price": 24,
  "currency": "GBP",
  "items": [
    {
      "quantity": 3,
      "price": 36,
      "currency": "GBP",
      "product": {
        "id": 123, // Product ID.
        "name": "Cotton T-shirt",
        "primary_image": "https://www.greatcdn.com/img/t-shirt.jpg"
      }
    }
  ]
}
```

### Remove a product from the cart

DELETE
`/cart/products/{productId}`
Params:

- productId

### Place order

POST
`/order`
Params:

- cartId
- address_details
- payment_details

Sample response:

```
{
  "id": 456, // Order ID.
  "total_price": 36,
  "currency": "GBP",
  "items": [
    // ... Same items as per the cart.
  ],
  "address_details": {
    "name": "John Doe",
    "country": "US",
    "address": "1600 Market Street",
    "city": "San Francisco"
    // ... Other address fields.
  },
  "payment_details": {
    // Only show the last 4 digits.
    // We shouldn't be storing the credit card number
    // unencrypted anyway.
    "card_last_four_digits": "1234"
  }
}
```

Payment is handled by provider SDK.
On successful payment, a token is received from provider.
The token is sent to POST /order.
On success, the client redirects to the Order Confirmation Page.

## Error Responses

All API errors return a consistent shape:

```json
{
  "error": "Human-readable error message",
  "code": "MACHINE_READABLE_CODE"
}
```

HTTP status codes are used conventionally: `400` for bad input, `404` for not found, `500` for server errors.

## Performance

Performance is critical for e-commerce websites.
Numerous studies have shown how improving performance can led to improved conversions.

- Code split by routes/pages
- Prioritise above-the-fold content while lazy loading below-the-fold content
- Defer loading of non-critical JS (e.g. modals)
- Prefetch JS and needed for next page upon hovering over links/buttons.
  - Prefetch product details when hovering over items in listings
  - Prefetch checkout page while on cart page
- Optimise images with lazy loading and adaptive loading.
- Prefetch top search results

### Core Web Vitals:

LCP (Largest Contentful Paint)

- Optimise performance JS, CSS, images, fonts
  FID (First Input Display)
- Reduce amount of JS executed on page load
  CLS (Cumulative Layout Shift)
- Use size attributes on images.
- Use CSS min-height to minimise layout shifts

## SEO

SEO is extremely important for e-commerce websites as organic search is the primary way people discover products.

- PDP’s have proper title, meta tags for description, keywords, and open graph tags
- Generate sitemap.xml for crawlers
- Use JSON structured data. Product type for e-commerce case.
- Use semantic markup
- Ensure fast loading times helps with website ranking
- Use SSR for better SEO.
- Pre-generate pages for popular searches

## Images

- Use WebP image format
- Images should be hosted on CDN
- Define priority of images (critical and non-critical assets)
- Lazy load below-the-fold images
- Load critical images early.
- Adaptive loading of images (load high quality images on fast networks, and lower quality on slow networks)

## Forms

- Country-specific address forms (for this project use UK)
- Optimise autofilling
- Error messages
- Focus states

## Accessibility

- Use semantic elements when possible.
- Alt tags for images
- Visual order matched DOM order
- Ensure forms are accessible.
  - Labels
  - Aria
  - Obvious focus state

## Security

- Use HTTPS
- For payment details submission, do not use GET. Use POST or PUT.

## Tech Stack

- NextJS App Router (SSR) - Front-end
- Express API - backend
- PostgresSQL - database - docker
- Prisma - ORM
- Typescript
- React Hook Form
- Zod
- Stripe - test mode
- express-session + connect-pg-simple - session management backed by PostgreSQL
- Vitest - unit/integration tests
- Playwright - E2E testing
