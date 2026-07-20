# Project State

Last updated: 2026-07-20

## 1. Project Overview

Construction Materials Marketplace is a TypeScript/Express backend for a
multi-role marketplace. It supports customer purchasing, seller catalog and
business management, verified-purchase product reviews, and administrator
marketplace monitoring and moderation.

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
| Phase 3 | Complete | Seller dashboard/business management, advanced product discovery, and product image management. |
| Phase 4 | Complete, awaiting review | Administrator oversight plus verified-purchase product reviews and ratings. |

## 3. Current Phase

**Phase 4 - Product Reviews & Ratings is complete and awaiting review.**

The most recently completed work is **Phase 4 - Module 1: Product Reviews &
Ratings**.

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
- Product image management with:
  - Public image listing.
  - Owning-seller add, delete, and primary-image selection.
  - An eight-image limit and HTTP/HTTPS URL validation.
  - Exactly one application-managed primary image when images exist.
  - Automatic primary-image replacement after deletion.
  - Backward-compatible synchronization with `Product.imageUrl`.
- Administrator dashboard and moderation with:
  - Marketplace user, customer, seller, product, category, order, and revenue
    totals.
  - Current-month delivered revenue and recent marketplace activity.
  - Paginated user search and role filtering.
  - User activation and disabling with self-disable protection.
  - Paginated seller oversight with product, order, and delivered-revenue
    aggregates.
  - Paginated product moderation with search, category/seller filters, and
    administrative deletion.
  - Immediate rejection of disabled accounts on every protected endpoint,
    including already-issued access tokens.
- Product reviews and ratings with:
  - Public review listing by product.
  - Review creation restricted to authenticated customers with a delivered
    order containing the product.
  - One review per customer and product.
  - Owner-only review updates and deletion.
  - Administrator deletion of any review.
  - Integer ratings from 1 through 5 with database and Zod enforcement.
  - Product-detail `averageRating` and `reviewCount` fields.

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
      admin-dashboard.test.ts
      auth.test.ts
      categories.test.ts
      orders.test.ts
      prisma-admin-dashboard.repository.test.ts
      prisma-review.repository.test.ts
      products.test.ts
      reviews.test.ts
      seller-dashboard.test.ts
    README.md
    package.json
```

## 6. Database Schema

PostgreSQL is accessed through Prisma 7. The current schema contains:

| Model | Purpose |
| --- | --- |
| `User` | Customer, seller, or administrator account; stores active/disabled state and a hashed refresh token. |
| `SellerProfile` | One-to-one seller profile containing shop name, phone, and address. |
| `Category` | Administrator-managed product category. |
| `Product` | Seller listing with category, decimal price, stock quantity, primary-image projection, and timestamps. |
| `ProductImage` | Managed product image URL with primary-image state and creation time. |
| `Order` | Customer order with status and total amount. |
| `OrderItem` | Product/quantity/price snapshot belonging to an order. |
| `Review` | Customer rating and optional comment for a purchased product. |

Relations:

- A `User` may have one `SellerProfile`, many listed products, and many
  customer orders.
- A `Product` belongs to one seller and category, and has many images and
  order items.
- A `ProductImage` belongs to one product and is deleted with that product.
- An `Order` belongs to one customer and has many order items.
- `OrderItem` is unique per `(orderId, productId)`.
- A `Review` belongs to one product and one customer.
- `Review` is unique per `(customerId, productId)`, and its rating is
  constrained to an integer from 1 through 5.

Enums:

- `Role`: `CUSTOMER`, `SELLER`, `ADMIN`
- `OrderStatus`: `PENDING`, `CONFIRMED`, `SHIPPED`, `DELIVERED`, `CANCELLED`

Applied migrations:

1. `20260718110500_init`
2. `20260718121500_phase_2_marketplace_foundation`
3. `20260718170000_align_order_status_values`
4. `20260719120500_advanced_product_discovery_indexes`
5. `20260719121723_product_discovery_trigram_search_indexes`
6. `20260719150000_product_image_management`
7. `20260719170000_admin_dashboard_user_status`
8. `20260720120000_product_reviews`

Product discovery indexes include B-tree indexes for seller, category, price,
quantity, and creation time. PostgreSQL `pg_trgm` GIN indexes accelerate
substring search on product name, description, and seller shop name. Product
images have a product/creation-time index and a PostgreSQL partial unique index
that permits at most one primary image per product. User role and active-state
indexes support administrator filtering and protected-request status checks.
Reviews have customer/product uniqueness, product/creation-time and customer
indexes, and a PostgreSQL rating check constraint.

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
| `POST` | `/api/products/:id/images` | Owning seller |
| `GET` | `/api/products/:id/images` | Public |
| `DELETE` | `/api/products/:id/images/:imageId` | Owning seller |
| `PATCH` | `/api/products/:id/images/:imageId/primary` | Owning seller |
| `GET` | `/api/products/:id/reviews` | Public |
| `POST` | `/api/products/:id/reviews` | Customer with delivered purchase |
| `PUT` | `/api/reviews/:id` | Review owner |
| `DELETE` | `/api/reviews/:id` | Review owner or admin |
| `POST` | `/api/orders` | Customer |
| `GET` | `/api/orders/me` | Authenticated |
| `GET` | `/api/orders/:id` | Order owner or admin |
| `PATCH` | `/api/orders/:id/status` | Admin |
| `DELETE` | `/api/orders/:id` | Order owner or admin |
| `GET` | `/api/seller/dashboard` | Seller |
| `GET` | `/api/seller/products` | Seller |
| `GET` | `/api/seller/orders` | Seller |
| `GET` | `/api/seller/analytics` | Seller |
| `GET` | `/api/admin/dashboard` | Admin |
| `GET` | `/api/admin/users` | Admin |
| `PATCH` | `/api/admin/users/:id/status` | Admin |
| `GET` | `/api/admin/sellers` | Admin |
| `GET` | `/api/admin/products` | Admin |
| `DELETE` | `/api/admin/products/:id` | Admin |

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

No approved implementation work remains within the Product Reviews & Ratings
module.

Features outside the currently implemented scope:

- Request-for-quotation (RFQ) workflows.
- Payment processing and payment status/reconciliation.
- Buyer/seller chat or messaging.
- Notifications.
- A frontend client, deployment/CI configuration, and operational monitoring
  have not been defined in the current scope.

## 10. Next Exact Task To Continue

**Review and approve Phase 4, Module 1: Product Reviews & Ratings.** No
subsequent module has been formally specified, so do not begin RFQs, payments,
chat, notifications, frontend work, or another business module until the next
requirements are provided and approved.

## 11. Important Decisions Made

- Keep the established layering: route -> controller -> service -> repository
  -> Prisma.
- Validate all body, parameter, and query input with strict Zod schemas;
  unknown query parameters are rejected.
- Authentication uses short-lived access tokens and HTTP-only refresh-token
  cookies. Refresh tokens are SHA-256 hashed, rotated on refresh, and reuse of
  a rotated token invalidates the stored session.
- Every protected request resolves the token subject through the user
  repository, rejects missing or disabled accounts, and uses the current
  database role rather than relying only on the JWT role claim.
- Disabling a user clears the stored refresh-token hash, immediately rejects
  login and refresh attempts, and invalidates already-issued access tokens on
  their next protected request. Administrators cannot disable themselves.
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
- Product images are normalized in `ProductImage`; the existing
  `Product.imageUrl` column is retained as the primary-image projection for
  backward compatibility with product and seller-dashboard responses.
- Product media mutations lock the parent product row and run in transactions
  so image limits, primary selection, replacement, and preview synchronization
  remain consistent under concurrent requests.
- Products may have at most eight managed images. A PostgreSQL partial unique
  index enforces at most one primary image per product.
- Administrator total and monthly revenue use delivered orders only. Seller
  oversight revenue includes only delivered line items belonging to that
  seller.
- A completed purchase for review eligibility means a `DELIVERED` order,
  matching the existing order lifecycle and seller revenue semantics.
- Review uniqueness is enforced by the service-facing repository and by a
  PostgreSQL unique index so concurrent duplicate submissions remain safe.
- Review ratings are validated as integer values from 1 through 5 in Zod and
  enforced with a PostgreSQL check constraint.
- Review updates and customer deletions require ownership. Administrators may
  delete any review but cannot edit review content.
- Product detail rating aggregates are calculated from normalized reviews at
  read time; no denormalized rating columns are stored on products.
- Administrative product deletion is blocked when historical order items
  reference the product.
- Category deletion is blocked when products reference that category.

## 12. Known Bugs Or TODOs

No known failing tests or confirmed functional bugs as of 2026-07-20.

Current limitations and deferred work:

- The test suite uses in-memory repositories for routine integration coverage;
  the Prisma administrator and review repositories are covered with focused
  mocked-client tests, but live PostgreSQL HTTP verification is not yet
  automated in CI.
- PostgreSQL `pg_trgm` must be available to apply the discovery search-index
  migration. It is available on the currently verified PostgreSQL 17 setup.
- Offset pagination is sufficient for the current API but may need cursor
  pagination if the catalog grows large or users require highly stable views
  during concurrent catalog updates.
- Public product review lists are currently unpaginated and should gain
  cursor or offset pagination before products accumulate large review volumes.
- Full-text ranking, typo tolerance beyond trigram matching, faceted counts,
  and search-result highlighting are not implemented.
- Product media management stores validated external image URLs only. Binary
  upload, resizing, object storage, and remote-file lifecycle management are
  not implemented.
- RFQs, payments, messaging, notifications, frontend delivery, CI/CD, and
  production observability remain unscoped and unimplemented.

## Verification Baseline

Most recent Phase 4 Product Reviews & Ratings verification completed
successfully:

```text
npm run typecheck     PASS
npm test              PASS (81 tests)
npm run build         PASS
prisma validate       PASS
prisma migrate status PASS (8 migrations applied)
```

Review HTTP tests cover successful and duplicate reviews, delivered-purchase
eligibility, invalid ratings, role enforcement, owner updates and deletion,
administrator deletion, public listing, and product rating aggregates.
Focused Prisma review repository tests cover delivered-order lookup, unique
constraint translation, non-purchaser rejection, mapping, and aggregate
calculation.
