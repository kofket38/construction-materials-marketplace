# Construction Materials Marketplace Backend

The backend includes the Phase 1 authentication foundation, the Phase 2
marketplace foundation, and Phase 3 seller dashboard and advanced product
discovery and product media modules, plus the administrator dashboard and
marketplace moderation module, verified-purchase product reviews, and customer
product wishlists, RFQs, and supplier quotations. Product, category, order,
media, review, wishlist, RFQ, seller business-management, and administrator
oversight APIs are implemented. Checkout supports cash on delivery and
seller-configured Telebirr, CBE Birr, bank, and E-birr manual payments with
receipt verification. Chat and notifications remain outside the current
scope.

## Requirements

- Node.js 24 LTS or newer
- npm 11 or newer
- PostgreSQL

## Installation

```bash
cd backend
npm ci
```

Create the local environment file:

```powershell
Copy-Item .env.example .env
```

Generate two different secrets with at least 32 characters:

```bash
node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"
```

Put one value in `JWT_ACCESS_SECRET` and the other in
`JWT_REFRESH_SECRET`.

## Environment Variables

| Variable | Purpose | Example |
| --- | --- | --- |
| `DATABASE_URL` | PostgreSQL connection URL | `postgresql://postgres:postgres@localhost:5432/cmm` |
| `PORT` | HTTP server port | `3000` |
| `JWT_ACCESS_SECRET` | Access-token signing secret, at least 32 characters | Random secret |
| `JWT_REFRESH_SECRET` | Refresh-token signing secret, at least 32 characters | Different random secret |
| `ACCESS_TOKEN_EXPIRES` | JWT access-token lifetime | `15m` |
| `REFRESH_TOKEN_EXPIRES` | JWT refresh-token lifetime | `7d` |
| `CLIENT_URL` | Allowed browser origin for CORS | `http://localhost:5173` |
| `PAYMENT_PROOF_UPLOAD_DIR` | Local directory for uploaded payment receipts | `uploads/payment-proofs` |
| `NODE_ENV` | `development`, `test`, or `production` | `development` |

The server validates all required environment variables at startup and exits
when configuration is invalid.

## Database and Prisma

Create the database named in `DATABASE_URL`, then apply the checked-in
migrations:

```bash
npm run prisma:generate
npm run prisma:deploy
```

For local schema development, create and apply a new migration with:

```bash
npm run prisma:migrate -- --name describe_the_change
```

Open Prisma Studio with:

```bash
npm run prisma:studio
```

The initial migration creates the `Role` enum and the `users` table. Refresh
tokens are stored as SHA-256 hashes, not as reusable plaintext tokens.
Product discovery migrations enable PostgreSQL's `pg_trgm` extension and add
GIN indexes for case-insensitive substring searches across product names,
descriptions, and seller shop names. The administrator status migration adds
indexed active/disabled state to users. The product review migration adds
normalized reviews, customer/product uniqueness, rating constraints, and
review lookup indexes.
The product wishlist migration adds normalized customer/product saved items,
customer/product uniqueness, cascade cleanup, and ordered lookup indexes.
The RFQ migrations add normalized request and quotation lines, status and unit
enums, catalog snapshots, supplier uniqueness, positive quantity and price
constraints, one accepted quotation per RFQ, and accepted-quote order links.
The RFQ stabilization migration adds seller/category lookup indexing and
database-enforced quote-line ownership, quote-total consistency, and final
accepted-quote/awarded-RFQ agreement. A follow-up constraint migration validates
both quotations when lines move and prevents either side of an accepted award
from changing independently.

## Running Locally

Start the development server with file watching:

```bash
npm run dev
```

Build and run the compiled production output:

```bash
npm run build
npm start
```

The default API base URL is `http://localhost:3000`. The health endpoint is:

```text
GET /health
```

## Production Deployment

### Required environment variables

Set every variable in the production environment before starting the server.
Do not use the `.env.example` values as-is in production.

| Variable | Production requirement |
| --- | --- |
| `NODE_ENV` | Must be `production` |
| `DATABASE_URL` | Full PostgreSQL connection URL to the production database |
| `JWT_ACCESS_SECRET` | Random secret, **at least 32 characters**, unique to this deployment |
| `JWT_REFRESH_SECRET` | A **different** random secret, at least 32 characters |
| `ACCESS_TOKEN_EXPIRES` | `15m` recommended; adjust to suit your session policy |
| `REFRESH_TOKEN_EXPIRES` | `7d` recommended; adjust to suit your session policy |
| `CLIENT_URL` | The exact origin of the production frontend, e.g. `https://app.example.com` — controls CORS |
| `PORT` | The port the server will listen on |
| `PAYMENT_PROOF_UPLOAD_DIR` | Absolute path to a **persistent** directory for uploaded payment receipts (see note below) |

Generate strong secrets:

```bash
node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"
```

Run the command twice and use one value for `JWT_ACCESS_SECRET` and a
different value for `JWT_REFRESH_SECRET`. The server refuses to start if
they are identical or shorter than 32 characters.

### Payment proof storage

`PAYMENT_PROOF_UPLOAD_DIR` must point to a directory that survives process
restarts and deployments. In a containerised or horizontally scaled
environment this must be a mounted persistent volume shared across all
instances — local container storage is not sufficient. Proof images uploaded
to one instance must be readable by every other instance serving the
`GET /api/payments/proof/:filename` endpoint.

### HTTPS requirement

The production server must be served over HTTPS. The refresh-token cookie
has its `Secure` flag enabled when `NODE_ENV=production`, which means it
will not be sent over plain HTTP connections. Unenforced HTTP in production
will break the authentication refresh flow.

### Deployment sequence

```bash
# 1. Install production dependencies
npm ci --omit=dev

# 2. Apply pending database migrations (non-destructive, safe to re-run)
npm run prisma:deploy

# 3. Compile TypeScript to JavaScript
npm run build

# 4. Start the server
npm start
```

Verify the server is healthy:

```bash
curl https://your-api-domain/health
# Expected: {"success":true,"data":{"status":"ok"}}
```

### Development seed data

> **WARNING: Do NOT run `npm run seed` in production.**
>
> The seed command (`npm run seed`) creates development seller accounts with
> the known default password `DevSeller123!`. It is intended for local
> development and staging environments only. Running it against a production
> database will create insecure accounts with a publicly known password.

## Authentication API

| Method | Route | Authentication |
| --- | --- | --- |
| `POST` | `/api/auth/register` | Public |
| `POST` | `/api/auth/login` | Public |
| `POST` | `/api/auth/refresh` | Refresh-token cookie |
| `POST` | `/api/auth/logout` | Refresh-token cookie when available |
| `GET` | `/api/auth/me` | `Authorization: Bearer <access-token>` |

Registration accepts `CUSTOMER` or `SELLER`. The legacy `BUYER` value is
accepted as an alias for `CUSTOMER`. `ADMIN` exists as a database role
but cannot be selected through public registration.

Example registration body:

```json
{
  "name": "Amina Kamau",
  "email": "amina@example.com",
  "password": "StrongPass1",
  "phone": "+254712345678",
  "company": "Kamau Builders",
  "role": "CUSTOMER"
}
```

Existing clients may continue sending `firstName` and `lastName` instead of
`name`. When both formats are sent, they must represent the same full name.

Successful login and registration responses return the access token in JSON.
The refresh token is sent only as an HTTP-only, same-site cookie. Its `Secure`
flag is enabled in production, where the API must be served over HTTPS.
Browser clients must send requests with credentials enabled.

Refresh tokens are rotated on every successful refresh. Reuse of a rotated
token invalidates the stored session. The current schema supports one active
refresh-token session per user.

Every protected request loads the token subject from the user repository.
Missing or disabled users receive `401`, and authorization uses the user's
current database role. Disabling an account clears its refresh token, blocks
login and refresh, and causes already-issued access tokens to be rejected on
their next protected request.

## Product API

### Development sample data

Populate a development database with idempotent marketplace sample data:

```bash
npm run seed
```

The seed creates or updates three development sellers, construction-material
categories and brands, five named cement products, and ten products across
steel, masonry, flooring, roofing, aggregates, paint, electrical, and plumbing.
Running it repeatedly reuses products by case-insensitive name and does not
create duplicates. Development seller accounts use password
`DevSeller123!`.

| Method | Route | Access |
| --- | --- | --- |
| `POST` | `/api/products` | Seller |
| `GET` | `/api/products` | Public |
| `GET` | `/api/products/:id` | Public |
| `PUT` | `/api/products/:id` | Owning seller |
| `DELETE` | `/api/products/:id` | Owning seller |
| `POST` | `/api/products/:id/images` | Owning seller |
| `GET` | `/api/products/:id/images` | Public |
| `DELETE` | `/api/products/:id/images/:imageId` | Owning seller |
| `PATCH` | `/api/products/:id/images/:imageId/primary` | Owning seller |
| `GET` | `/api/products/:id/reviews` | Public |
| `POST` | `/api/products/:id/reviews` | Customer with delivered purchase |

Create a product with a seller access token:

```bash
curl -X POST http://localhost:3000/api/products \
  -H "Authorization: Bearer <seller-access-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Portland Cement 42.5N",
    "description": "High-strength cement supplied in 50 kg bags.",
    "price": "850.00",
    "quantity": 120,
    "categoryId": "00000000-0000-4000-8000-000000000000",
    "imageUrl": "https://example.com/cement.jpg"
  }'
```

Update a product owned by the authenticated seller:

```bash
curl -X PUT http://localhost:3000/api/products/<product-id> \
  -H "Authorization: Bearer <seller-access-token>" \
  -H "Content-Type: application/json" \
  -d '{"price":"900.00","quantity":75}'
```

Browse products without authentication:

```bash
curl "http://localhost:3000/api/products?page=1&limit=20&search=cement&categoryId=<category-id>&sellerId=<seller-id>&minPrice=100&maxPrice=1000&stock=in_stock&sortBy=price&sortOrder=asc"
curl http://localhost:3000/api/products/<product-id>
```

Product discovery query options:

- `page`: positive integer, default `1`
- `limit`: positive integer up to `100`, default `20`
- `search`: case-insensitive product name, description, or seller shop name
- `categoryId`: category UUID
- `sellerId`: seller user UUID
- `minPrice` and `maxPrice`: inclusive decimal price range
- `stock`: `in_stock` or `out_of_stock`
- `sortBy`: `newest`, `oldest`, `price`, `name`, or `popularity`
- `sortOrder`: `asc` or `desc` for price, name, and popularity

`newest` and `oldest` use fixed creation-time directions. Popularity uses the
number of historical order-item references for each product and defaults to
descending order.

The list response contains:

```json
{
  "success": true,
  "data": {
    "products": [],
    "totalItems": 0,
    "totalPages": 0,
    "currentPage": 1,
    "pageSize": 20,
    "hasNextPage": false,
    "hasPreviousPage": false
  }
}
```

Product prices are returned as fixed two-decimal strings so API consumers do
not lose monetary precision. Product creation requires an existing category.
Product detail responses also include `averageRating` as a number or `null`
when no reviews exist, plus integer `reviewCount`.

### Product Images

Products support up to eight managed HTTP or HTTPS image URLs. Add an image
with:

```bash
curl -X POST http://localhost:3000/api/products/<product-id>/images \
  -H "Authorization: Bearer <seller-access-token>" \
  -H "Content-Type: application/json" \
  -d '{"imageUrl":"https://example.com/cement-front.jpg"}'
```

Only the owning seller can add, delete, or select primary images. Image lists
are public. The first image becomes primary automatically:

```bash
curl http://localhost:3000/api/products/<product-id>/images

curl -X PATCH \
  http://localhost:3000/api/products/<product-id>/images/<image-id>/primary \
  -H "Authorization: Bearer <seller-access-token>" \
  -H "Content-Type: application/json" \
  -d '{}'

curl -X DELETE \
  http://localhost:3000/api/products/<product-id>/images/<image-id> \
  -H "Authorization: Bearer <seller-access-token>" \
  -H "Content-Type: application/json" \
  -d '{}'
```

Only one image can be primary. Deleting it promotes the oldest remaining
image; deleting the last image clears the primary image. The existing
`Product.imageUrl` field remains synchronized with the primary image for
backward compatibility.

## Review API

| Method | Route | Access |
| --- | --- | --- |
| `GET` | `/api/products/:id/reviews` | Public |
| `POST` | `/api/products/:id/reviews` | Customer with delivered purchase |
| `PUT` | `/api/reviews/:id` | Review owner |
| `DELETE` | `/api/reviews/:id` | Review owner or admin |

Create a review with a customer access token:

```bash
curl -X POST http://localhost:3000/api/products/<product-id>/reviews \
  -H "Authorization: Bearer <customer-access-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "rating": 5,
    "comment": "Consistent quality and good curing performance."
  }'
```

Ratings must be integers from `1` through `5`. Comments are optional, trimmed,
and limited to 5,000 characters. A customer can review a product only when one
of their `DELIVERED` orders contains it. Each customer may submit only one
review per product.

Review lists are public and include aggregate fields:

```bash
curl http://localhost:3000/api/products/<product-id>/reviews
```

```json
{
  "success": true,
  "data": {
    "reviews": [],
    "averageRating": null,
    "reviewCount": 0
  }
}
```

Update or delete an owned review:

```bash
curl -X PUT http://localhost:3000/api/reviews/<review-id> \
  -H "Authorization: Bearer <customer-access-token>" \
  -H "Content-Type: application/json" \
  -d '{"rating":4,"comment":"Updated after the full curing period."}'

curl -X DELETE http://localhost:3000/api/reviews/<review-id> \
  -H "Authorization: Bearer <customer-access-token>" \
  -H "Content-Type: application/json" \
  -d '{}'
```

Customers can update or delete only their own reviews. Administrators may
delete any review but cannot edit reviews.

## Wishlist API

All wishlist routes require an active `CUSTOMER` access token.

| Method | Route | Access |
| --- | --- | --- |
| `GET` | `/api/wishlist` | Customer |
| `POST` | `/api/wishlist/:productId` | Customer |
| `DELETE` | `/api/wishlist/:productId` | Customer |

Add an existing product to the authenticated customer's wishlist:

```bash
curl -X POST http://localhost:3000/api/wishlist/<product-id> \
  -H "Authorization: Bearer <customer-access-token>" \
  -H "Content-Type: application/json" \
  -d '{}'
```

Each product may appear only once in a customer's wishlist. Duplicate
additions return `409`, and unknown product IDs return `404`.

List saved products in newest-first order:

```bash
curl http://localhost:3000/api/wishlist \
  -H "Authorization: Bearer <customer-access-token>"
```

Each item includes the standard product representation with seller and
category summaries. Results are scoped to the authenticated customer.

Remove a saved product:

```bash
curl -X DELETE http://localhost:3000/api/wishlist/<product-id> \
  -H "Authorization: Bearer <customer-access-token>" \
  -H "Content-Type: application/json" \
  -d '{}'
```

Removing a product that is not in the authenticated customer's wishlist
returns `404`. Wishlist entries are automatically deleted when their customer
or product is deleted.

## RFQ and Supplier Quotation API

RFQ routes require authentication. Customers manage their own requests and
quotation decisions, sellers access eligible requests and their own quotes,
and administrators have read-only marketplace oversight.

| Method | Route | Access |
| --- | --- | --- |
| `POST` | `/api/rfqs` | Customer |
| `GET` | `/api/rfqs/me` | Customer |
| `GET` | `/api/rfqs/:id` | Owner, eligible/participating seller, or admin |
| `PUT` | `/api/rfqs/:id` | Owning customer before any quote |
| `PATCH` | `/api/rfqs/:id/cancel` | Owning customer |
| `GET` | `/api/seller/rfqs` | Seller |
| `POST` | `/api/rfqs/:id/quotes` | Eligible seller |
| `PUT` | `/api/quotes/:id` | Owning seller |
| `PATCH` | `/api/quotes/:id/withdraw` | Owning seller |
| `POST` | `/api/quotes/:id/reject` | RFQ owner |
| `POST` | `/api/quotes/:id/accept` | RFQ owner |
| `GET` | `/api/admin/rfqs` | Admin |

Create an RFQ with one to twenty requested material lines:

```bash
curl -X POST http://localhost:3000/api/rfqs \
  -H "Authorization: Bearer <customer-access-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Bulk structural materials",
    "deliveryLocation": "Industrial Area, Nairobi",
    "expiresAt": "2026-07-27T12:00:00.000Z",
    "items": [
      {
        "categoryId": "<cement-category-id>",
        "materialName": "General purpose cement",
        "specifications": "50 kg bags",
        "requestedQuantity": "2.500",
        "requestedUnit": "TONNE"
      }
    ]
  }'
```

RFQs expire between 24 hours and 90 days after creation. Supported requested
units are `BAG`, `KG`, `TONNE`, `LITRE`, `METRE`, `SQUARE_METRE`,
`CUBIC_METRE`, `PIECE`, `ROLL`, `PALLET`, `LOAD`, and `OTHER`. `OTHER`
requires `customUnit`. JSON request bodies are limited to 128kb so the largest
schema-valid RFQ remains supported; larger bodies return HTTP `413`.

An eligible seller owns at least one product in every requested category.
Submit a complete quotation by mapping every RFQ item to a seller-owned
product in the same category:

```bash
curl -X POST http://localhost:3000/api/rfqs/<rfq-id>/quotes \
  -H "Authorization: Bearer <seller-access-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "validUntil": "2026-07-25T12:00:00.000Z",
    "leadTimeDays": 5,
    "terms": "Material pricing only.",
    "items": [
      {
        "rfqItemId": "<rfq-item-id>",
        "productId": "<seller-product-id>",
        "offeredQuantity": 50,
        "unitPrice": "825.00"
      }
    ]
  }'
```

Only one quote per seller and RFQ is permitted. Sellers cannot see competing
quote details. Quote submission does not reserve stock.

Accept a submitted, unexpired quotation:

```bash
curl -X POST http://localhost:3000/api/quotes/<quote-id>/accept \
  -H "Authorization: Bearer <customer-access-token>" \
  -H "Content-Type: application/json" \
  -d '{}'
```

Acceptance runs in a serializable transaction. It revalidates product
ownership, category, and the supplier's current active status, conditionally
reserves stock, creates a normal `PENDING` order at the quoted prices, marks
the selected quote `ACCEPTED`, rejects competing submitted quotes, and marks
the RFQ `AWARDED`. Payments, messaging, notifications, and delivery charges
are not part of this workflow.

## Category API

| Method | Route | Access |
| --- | --- | --- |
| `GET` | `/api/categories` | Public |
| `GET` | `/api/categories/:id` | Public |
| `POST` | `/api/categories` | Admin |
| `PUT` | `/api/categories/:id` | Admin |
| `DELETE` | `/api/categories/:id` | Admin |

Create a category with an administrator access token:

```bash
curl -X POST http://localhost:3000/api/categories \
  -H "Authorization: Bearer <admin-access-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Cement",
    "description": "Bagged and bulk cement products"
  }'
```

Update or clear a category description:

```bash
curl -X PUT http://localhost:3000/api/categories/<category-id> \
  -H "Authorization: Bearer <admin-access-token>" \
  -H "Content-Type: application/json" \
  -d '{"name":"Cement and Binders","description":null}'
```

Category names are unique regardless of letter casing. Categories referenced
by products cannot be deleted.

## Order API

| Method | Route | Access |
| --- | --- | --- |
| `POST` | `/api/orders` | Customer |
| `GET` | `/api/orders` | Customer |
| `GET` | `/api/orders/me` | Customer; legacy alias |
| `GET` | `/api/orders/:id` | Order owner or admin |
| `PATCH` | `/api/orders/:id/status` | Admin |
| `DELETE` | `/api/orders/:id` | Order owner or admin |

Create an order with a customer access token:

```bash
curl -X POST http://localhost:3000/api/orders \
  -H "Authorization: Bearer <customer-access-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "items": [
      {"productId": "00000000-0000-4000-8000-000000000000", "quantity": 2}
    ],
    "paymentMethod": "CASH_ON_DELIVERY",
    "shipping": {
      "fullName": "Amina Tesfaye",
      "phone": "+251911000000",
      "city": "Addis Ababa",
      "address": "Bole, near the construction site",
      "notes": "Call before delivery"
    }
  }'
```

Product prices are copied to order items when the order is created, and the
order total is calculated from those snapshots. Stock is decremented in the
same transaction as order creation; an order is rejected when any item is
missing or has insufficient stock. A customer cannot order their own product,
and a product may appear only once in an order.

Customers can cancel orders before seller processing or shipment.
Cancellation restores reserved stock exactly once. Delivered orders do not
restore stock when cancelled by an administrator.

## Payment API

Manual payment routes require a customer access token.

| Method | Route | Purpose |
| --- | --- | --- |
| `POST` | `/api/payments/options` | Resolve payment destinations for a single-seller cart |
| `POST` | `/api/payments/manual` | Upload a JPEG, PNG, or WebP receipt up to 5 MB |
| `GET` | `/api/payments/:orderId` | Read the customer's payment and destination details |
| `GET` | `/api/payments/proof/:filename` | Stream an uploaded payment proof image |

Digital payment is limited to single-seller carts. Cash on delivery remains
available for mixed-seller carts. Uploaded receipts are stored beneath
`PAYMENT_PROOF_UPLOAD_DIR` and served through the authenticated
`GET /api/payments/proof/:filename` endpoint. This endpoint requires a valid
`CUSTOMER`, `SELLER`, or `ADMIN` access token and enforces ownership
verification: customers may only access proofs belonging to their own orders,
sellers may only access proofs for orders that contain their products, and
administrators may access any proof. Unauthenticated requests return `401`;
requests from an authenticated user without the required ownership return
`403`. The upload directory is never exposed through a public static route.

## Seller Dashboard API

All seller dashboard routes require a valid `SELLER` access token. Missing or
invalid tokens return `401`; customer and administrator tokens return `403`.

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/api/seller/dashboard` | Business summary and latest 10 orders |
| `GET` | `/api/seller/products` | Paginated seller-owned products |
| `GET` | `/api/seller/orders` | Paginated orders containing seller products |
| `GET` | `/api/seller/orders/:orderId` | Seller-scoped order details |
| `PATCH` | `/api/seller/orders/:orderId/payment` | Approve or reject a pending receipt |
| `PATCH` | `/api/seller/orders/:orderId/status` | Advance seller fulfillment |
| `GET` | `/api/seller/analytics` | Sales, revenue, status, and category analytics |

Get the dashboard summary:

```bash
curl http://localhost:3000/api/seller/dashboard \
  -H "Authorization: Bearer <seller-access-token>"
```

An active product has stock greater than zero. Completed orders and revenue use
`DELIVERED` orders only. Revenue and order details include only the
authenticated seller's line items when an order contains products from
multiple sellers. Monthly revenue uses the order creation month in UTC.

Filter and paginate seller products:

```bash
curl "http://localhost:3000/api/seller/products?page=1&limit=20&search=cement&sortBy=createdAt&sortOrder=desc&categoryId=<category-id>&stock=low_stock" \
  -H "Authorization: Bearer <seller-access-token>"
```

Product query options:

- `page`: positive integer, default `1`
- `limit`: positive integer up to `100`, default `20`
- `search`: product name, description, or category name
- `sortBy`: `createdAt`, `name`, `price`, or `quantity`
- `sortOrder`: `asc` or `desc`
- `categoryId`: category UUID
- `stock`: `in_stock`, `low_stock` (1-10), or `out_of_stock`

Filter and paginate seller orders:

```bash
curl "http://localhost:3000/api/seller/orders?page=1&limit=20&status=DELIVERED&dateFrom=2026-07-01&dateTo=2026-07-31&customerSearch=amina" \
  -H "Authorization: Bearer <seller-access-token>"
```

Order dates use inclusive `YYYY-MM-DD` values and filter by order creation
date. `customerSearch` matches customer name or email. The analytics endpoint
returns the top 10 products and categories from delivered sales, order counts
by status, and monthly sales and revenue for the current UTC month plus the
preceding 11 months.

## Admin Dashboard API

All administrator dashboard routes require an active `ADMIN` account.
Unauthenticated or disabled accounts receive `401`; active non-admin accounts
receive `403`.

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/api/admin/dashboard` | Marketplace totals, revenue, and recent activity |
| `GET` | `/api/admin/users` | Paginated user search and role filtering |
| `PATCH` | `/api/admin/users/:id/status` | Activate or disable a user |
| `GET` | `/api/admin/sellers` | Seller profiles and business aggregates |
| `GET` | `/api/admin/products` | Paginated product moderation listing |
| `DELETE` | `/api/admin/products/:id` | Remove an unreferenced product |

The dashboard returns total users, customers, sellers, products, categories,
orders, delivered revenue, current UTC-month delivered revenue, and the latest
10 user, product, or order activities.

User query options:

- `page`: positive integer, default `1`
- `limit`: positive integer up to `100`, default `20`
- `search`: user name, email, or company
- `role`: `CUSTOMER`, `SELLER`, or `ADMIN`

Update user status with:

```bash
curl -X PATCH http://localhost:3000/api/admin/users/<user-id>/status \
  -H "Authorization: Bearer <admin-access-token>" \
  -H "Content-Type: application/json" \
  -d '{"status":"DISABLED"}'
```

The allowed values are `ACTIVE` and `DISABLED`. Administrators cannot disable
their own account. Disabling another account clears its refresh token and is
enforced immediately for existing access tokens.

Seller query options are `page`, `limit`, and `search`. Seller results include
profile details, product count, distinct order count, and delivered line-item
revenue.

Product query options are `page`, `limit`, `search`, `categoryId`, and
`sellerId`. Search covers product text, category, seller identity, and shop
name. Products referenced by historical order items cannot be deleted and
return `409`.

## Response Format

Success:

```json
{
  "success": true,
  "data": {}
}
```

Error:

```json
{
  "success": false,
  "message": "Request validation failed.",
  "errors": [
    {
      "field": "body.email",
      "message": "Invalid email address"
    }
  ]
}
```

## Development and Testing

Run the strict TypeScript check:

```bash
npm run typecheck
```

Run the API integration tests:

```bash
npm test
```

`npm test` uses the migrated PostgreSQL database configured by `DATABASE_URL`
for the RFQ persistence integration suite. The suite creates isolated fixtures
and removes them after each test.

Use watch mode while developing:

```bash
npm run test:watch
```

The HTTP tests exercise the real Express routes, validation, bcrypt hashing,
JWT handling, cookies, refresh rotation, logout, protected routes, seller
dashboard aggregation, administrator monitoring and moderation, disabled-user
enforcement, filters, analytics, product media ownership and primary-image
behavior, and review eligibility, ownership, validation, public listing, and
rating aggregates, plus wishlist customer isolation, ordering, validation, and
removal, plus RFQ ownership, seller eligibility, quote isolation, validation,
award transactions, stock rollback, order creation, and concurrent acceptance.
They use in-memory repository implementations so routine HTTP tests do not
require PostgreSQL. Focused tests also exercise the Prisma administrator,
review, wishlist, and RFQ repositories' mappings, aggregates, persistence
rules, transaction behavior, and error translation. The RFQ suite additionally
uses live PostgreSQL to verify acceptance commits, rollback, concurrent
acceptance, row locking, uniqueness, quote-line moves, award transitions, and
cross-table constraints.

## Architecture

```text
src/
  config/        Environment, logger, and cookie configuration
  controllers/   HTTP request and response handling
  services/      Authentication, catalog, order, review, wishlist, RFQ, seller, and admin use cases
  repositories/  Persistence contracts and Prisma implementation
  middleware/    Authentication, roles, validation, errors, and rate limits
  routes/        Express route composition
  validators/    Zod request schemas
  utils/         Passwords, token hashing, async handling, and API errors
  types/         Shared authentication and Express types
  prisma/        Prisma client adapter and generated client
```
