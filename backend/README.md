# Construction Materials Marketplace Backend

The backend includes the Phase 1 authentication foundation, the Phase 2
marketplace foundation, and Phase 3 seller dashboard and advanced product
discovery modules. Product, category, order, and seller business-management
APIs are implemented; RFQs, payments, chat, and notifications remain outside
the current scope.

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
descriptions, and seller shop names.

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

## Product API

| Method | Route | Access |
| --- | --- | --- |
| `POST` | `/api/products` | Seller |
| `GET` | `/api/products` | Public |
| `GET` | `/api/products/:id` | Public |
| `PUT` | `/api/products/:id` | Owning seller |
| `DELETE` | `/api/products/:id` | Owning seller |

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
| `GET` | `/api/orders/me` | Authenticated user |
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
    ]
  }'
```

Product prices are copied to order items when the order is created, and the
order total is calculated from those snapshots. Stock is decremented in the
same transaction as order creation; an order is rejected when any item is
missing or has insufficient stock. A customer cannot order their own product,
and a product may appear only once in an order.

Customers can cancel only `PENDING` orders. Administrators can cancel orders
in any non-cancelled status. Cancelling an order before delivery restores its
reserved stock. Administrators update order status with one of `PENDING`,
`CONFIRMED`, `SHIPPED`, `DELIVERED`, or `CANCELLED`. Cancelled orders cannot
change status. Delivered orders cannot move to another non-cancelled status,
and cancelling a delivered order does not restore stock.

## Seller Dashboard API

All seller dashboard routes require a valid `SELLER` access token. Missing or
invalid tokens return `401`; customer and administrator tokens return `403`.

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/api/seller/dashboard` | Business summary and latest 10 orders |
| `GET` | `/api/seller/products` | Paginated seller-owned products |
| `GET` | `/api/seller/orders` | Paginated orders containing seller products |
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

Use watch mode while developing:

```bash
npm run test:watch
```

The HTTP tests exercise the real Express routes, validation, bcrypt hashing,
JWT handling, cookies, refresh rotation, logout, protected routes, seller
dashboard aggregation, filters, and analytics. They use in-memory repository
implementations so the test suite does not require PostgreSQL.

## Architecture

```text
src/
  config/        Environment, logger, and cookie configuration
  controllers/   HTTP request and response handling
  services/      Authentication, catalog, order, and seller dashboard use cases
  repositories/  Persistence contracts and Prisma implementation
  middleware/    Authentication, roles, validation, errors, and rate limits
  routes/        Express route composition
  validators/    Zod request schemas
  utils/         Passwords, token hashing, async handling, and API errors
  types/         Shared authentication and Express types
  prisma/        Prisma client adapter and generated client
```
