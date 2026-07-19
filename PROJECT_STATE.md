# Project State

Last updated: 2026-07-19

## 1. Project Overview

Construction Materials Marketplace is a TypeScript/Express backend for a
multi-role marketplace. It supports customer purchasing, seller catalog and
business management, and administrator category/order management.

The API uses a layered architecture:

```text
Routes -> Controllers -> Services -> Repositories -> Prisma/PostgreSQL
                         ^
                    Zod validators
```

All API responses use a consistent envelope:

```json
{ "success": true, "data": {} }
```

Errors use `success: false`, a message, and structured validation errors where
applicable.

## 2. Completed Phases

| Phase | Status | Scope |
| --- | --- | --- |
| Phase 1 | Complete | Authentication, JWT access/refresh tokens, role authorization, refresh-token rotation, security middleware, and API error handling. |
| Phase 2 | Complete | Marketplace foundation: categories, products, orders, stock management, and seller profiles. |
| Phase 3 | Complete, awaiting review | Seller dashboard/business management and advanced product search, filtering, sorting, and pagination. |

## 3. Current Phase

**Phase 3 is complete and awaiting review.**

The most recently completed work is **Phase 3 - Module 2: Advanced Search,
Filtering & Pagination** for `GET /api/products`.

## 4. Completed Modules

- Authentication and role-based access control.
- Category management.
- Seller product CRUD.
- Customer order creation, ownership access, cancellation, and admin status
  updates.
- Transactional stock reservation/restoration and order-price snapshots.
- Seller dashboard summary, seller-product management, seller-order views, and
  analytics.
- Public product discovery with:
  - Pagination metadata.
  - Case-insensitive name, description, and seller shop-name search.
  - Category, seller, inclusive price-range, and stock filters.
  - Newest, oldest, price, name, and popularity sorting.
  - PostgreSQL indexes for discovery filters/sorts and trigram search.

## 5. Folder Structure

```text
CMM/
  PROJECT_STATE.md
  backend/
    prisma/
      schema.prisma
      migrations/
    src/
      app.ts                 Express application composition
      server.ts              HTTP startup and graceful shutdown
      config/                Environment, logging, security configuration
      controllers/           HTTP request/response handling
      middleware/            Auth, roles, validation, rate limits, errors
      prisma/                Prisma client and generated client
      repositories/          Contracts and Prisma implementations
      routes/                Route composition
      services/              Application use cases
      types/                 Shared TypeScript/Express types
      utils/                 Passwords, token hashing, API errors, async helper
      validators/            Zod input/query schemas
    tests/
      helpers/               In-memory repository test doubles
      auth.test.ts
      categories.test.ts
      orders.test.ts
      products.test.ts
      seller-dashboard.test.ts
    README.md
    package.json
```

## 6. Database Schema

PostgreSQL is accessed through Prisma 7. The current schema contains:

| Model | Purpose |
| --- | --- |
| `User` | Customer, seller, or administrator account; stores a hashed refresh token. |
| `SellerProfile` | One-to-one seller profile containing shop name, phone, and address. |
| `Category` | Administrator-managed product category. |
| `Product` | Seller listing with category, decimal price, stock quantity, optional image, and timestamps. |
| `Order` | Customer order with status and total amount. |
| `OrderItem` | Product/quantity/price snapshot belonging to an order. |

Relations:

- A `User` may have one `SellerProfile`, many listed products, and many
  customer orders.
- A `Product` belongs to one seller and category, and has many order items.
- An `Order` belongs to one customer and has many order items.
- `OrderItem` is unique per `(orderId, productId)`.

Enums:

- `Role`: `CUSTOMER`, `SELLER`, `ADMIN`
- `OrderStatus`: `PENDING`, `CONFIRMED`, `SHIPPED`, `DELIVERED`, `CANCELLED`

Applied migrations:

1. `20260718110500_init`
2. `20260718121500_phase_2_marketplace_foundation`
3. `20260718170000_align_order_status_values`
4. `20260719120500_advanced_product_discovery_indexes`
5. `20260719121723_product_discovery_trigram_search_indexes`

Product discovery indexes include B-tree indexes for seller, category, price,
quantity, and creation time. PostgreSQL `pg_trgm` GIN indexes accelerate
substring search on product name, description, and seller shop name.

## 7. API Endpoints Created

| Method | Endpoint | Access |
| --- | --- | --- |
| `GET` | `/health` | Public |
| `POST` | `/api/auth/register` | Public |
| `POST` | `/api/auth/login` | Public |
| `POST` | `/api/auth/refresh` | Refresh-token cookie |
| `POST` | `/api/auth/logout` | Public; cookie used when present |
| `GET` | `/api/auth/me` | Authenticated |
| `GET` | `/api/categories` | Public |
| `GET` | `/api/categories/:id` | Public |
| `POST` | `/api/categories` | Admin |
| `PUT` | `/api/categories/:id` | Admin |
| `DELETE` | `/api/categories/:id` | Admin |
| `POST` | `/api/products` | Seller |
| `GET` | `/api/products` | Public product discovery |
| `GET` | `/api/products/:id` | Public |
| `PUT` | `/api/products/:id` | Owning seller |
| `DELETE` | `/api/products/:id` | Owning seller |
| `POST` | `/api/orders` | Customer |
| `GET` | `/api/orders/me` | Authenticated |
| `GET` | `/api/orders/:id` | Order owner or admin |
| `PATCH` | `/api/orders/:id/status` | Admin |
| `DELETE` | `/api/orders/:id` | Order owner or admin |
| `GET` | `/api/seller/dashboard` | Seller |
| `GET` | `/api/seller/products` | Seller |
| `GET` | `/api/seller/orders` | Seller |
| `GET` | `/api/seller/analytics` | Seller |

`GET /api/products` query parameters:

```text
page, limit, search, categoryId, sellerId, minPrice, maxPrice,
stock, sortBy, sortOrder
```

## 8. Technologies Used

- Node.js 24+ and npm 11+
- TypeScript with ESM modules
- Express 5
- PostgreSQL 17
- Prisma 7 with `@prisma/adapter-pg` and `pg`
- Zod 4 request validation
- JSON Web Tokens and bcrypt
- cookie-parser, CORS, Helmet, express-rate-limit
- Pino structured logging
- Vitest and Supertest for HTTP integration tests
- tsx for development-time TypeScript execution

## 9. Remaining Tasks

No approved implementation work remains within Phase 3.

Features outside the currently implemented scope:

- Request-for-quotation (RFQ) workflows.
- Payment processing and payment status/reconciliation.
- Buyer/seller chat or messaging.
- Notifications.
- A frontend client, deployment/CI configuration, and operational monitoring
  have not been defined in the current scope.

## 10. Next Exact Task To Continue

**Review and approve Phase 3, Module 2: Advanced Search, Filtering &
Pagination.** No subsequent module has been formally specified, so do not
begin RFQs, payments, chat, notifications, or frontend work until the next
requirements are provided and approved.

## 11. Important Decisions Made

- Keep the established layering: route -> controller -> service -> repository
  -> Prisma.
- Validate all body, parameter, and query input with strict Zod schemas;
  unknown query parameters are rejected.
- Authentication uses short-lived access tokens and HTTP-only refresh-token
  cookies. Refresh tokens are SHA-256 hashed, rotated on refresh, and reuse of
  a rotated token invalidates the stored session.
- Public registration permits only `CUSTOMER` and `SELLER`; `BUYER` is
  accepted as a legacy alias. `ADMIN` cannot be self-registered.
- Monetary values are stored as PostgreSQL decimals and returned as fixed
  two-decimal strings to avoid API precision loss.
- Order creation snapshots item prices and changes stock in a single database
  transaction. Cancellation restores stock except for delivered orders.
- Product discovery performs count and page retrieval in one Prisma
  transaction, includes seller/category summaries to avoid N+1 queries, and
  uses stable tie-breakers for deterministic pagination.
- Product discovery search is case-insensitive substring matching over product
  name, description, and seller profile shop name.
- `popularity` sorts by historical `OrderItem` count. It defaults to descending
  order; ascending is accepted when explicitly requested.
- PostgreSQL `pg_trgm` GIN indexes were added because B-tree indexes do not
  efficiently support the `%search%` substring pattern generated by Prisma
  `contains` queries.
- Category deletion is blocked when products reference that category.

## 12. Known Bugs Or TODOs

No known failing tests or confirmed functional bugs as of 2026-07-19.

Current limitations and deferred work:

- The test suite uses in-memory repositories for routine integration coverage;
  live PostgreSQL HTTP verification was performed manually for product
  discovery but is not yet automated in CI.
- PostgreSQL `pg_trgm` must be available to apply the discovery search-index
  migration. It is available on the currently verified PostgreSQL 17 setup.
- Offset pagination is sufficient for the current API but may need cursor
  pagination if the catalog grows large or users require highly stable views
  during concurrent catalog updates.
- Full-text ranking, typo tolerance beyond trigram matching, faceted counts,
  and search-result highlighting are not implemented.
- RFQs, payments, messaging, notifications, frontend delivery, CI/CD, and
  production observability remain unscoped and unimplemented.

## Verification Baseline

Most recent Phase 3 Module 2 verification completed successfully:

```text
npm run typecheck     PASS
npm test              PASS (49 tests)
npm run build         PASS
prisma validate       PASS
prisma migrate status PASS (5 migrations applied)
```

Live HTTP checks also passed against an isolated migrated PostgreSQL database
for pagination, all three search fields, filters, sorts including popularity,
invalid query validation, and discovery index presence.
