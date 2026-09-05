# Project State

Last updated: 2026-09-05

## 1. Project Overview

Construction Materials Marketplace is a TypeScript/Express backend for a
multi-role marketplace. It supports customer purchasing, manual proof-based
order payments, seller catalog and business management, seller inventory and
fulfilment, customer wishlists, verified-purchase product reviews, RFQs and
supplier quotations, professional identity (profiles, portfolios, projects, and
a public directory), and administrator marketplace monitoring and moderation.

A React/TypeScript frontend client consumes this API and is deployed alongside
it; see section 8 for both stacks.

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
| Phase 4 | Complete and stabilized | Administrator oversight, verified-purchase product reviews and ratings, customer product wishlists, and RFQ and supplier quotations. |
| M1 | Complete | Professional Identity: PROFESSIONAL as a real backend role, professional profiles, portfolio items, professional projects, public professional directory, public project discovery, professional registration, and full buyer capabilities for professional accounts. |
| M1.5 | Complete | Professional Avatar Management: a profile-image URL field with live preview on professional profile create and edit, empty input clearing the stored avatar, and the professional dashboard rendering the stored avatar with an initials fallback. |
| Post-M1 increment | Complete, uncommitted | Presentation and procurement visibility: a light/dark theme with a toggle in every shell, one product-image component across all product surfaces, and the owning professional's project shown on RFQ and order detail. |

## 3. Current Phase

**Milestone M1 — Professional Identity is complete and verified.**

The most recently completed work is the **post-M1 presentation and
procurement-visibility increment**, which is verified but not yet committed; it
follows **M1.5 Professional Avatar Management**. Both are described at the end of
this section.

M1 introduces `PROFESSIONAL` as a first-class backend role. Professional
accounts register publicly, manage exactly one professional profile with
specialties and credentials, maintain portfolio items and professional
projects, and appear in the public professional directory and project
discovery. Professionals keep the full customer buying capability set (orders,
payments, reviews, wishlists, RFQs). M1 itself added no payment, messaging,
notification, or delivery-charge functionality; the manual payment flow it
reuses predates M1.

**Included in M1: project procurement links.**

A professional can attach their own RFQs and orders to one of their own
projects, read an owner-private procurement view of everything attached to a
project, and detach a single link. Attached procurement gates the project
lifecycle: a project cannot be completed while unexpired OPEN RFQs or unsettled
orders remain attached, and cannot be deleted while any link remains. The
backend is complete, typechecked, and verified against live PostgreSQL. The
frontend reaches all three capabilities: an optional project selector on RFQ
creation and checkout, and a procurement section with detach actions on the
owner's project detail page. Both attachment controls are professional-only, so
customer flows are unchanged.

**Follow-on increment M1.5: professional avatar management.**

`ProfessionalProfile.avatarUrl` has existed since the M1 profile
migration, and the public profile, public directory, and project surfaces
already rendered it, but nothing in the UI could set it and the owner's
own dashboard ignored it. M1.5 closes that gap on the frontend only: the
profile form has a validated profile-image URL field with a live preview
on both create and edit, an empty value is sent as `null` to clear the
stored avatar, and the professional dashboard renders the shared
`ProfessionalAvatar` with initials as the fallback. No schema, migration,
endpoint, validator, service, or role change was required.

**Post-M1 increment: presentation and procurement visibility.**

Three workstreams sit in the working tree, verified but not yet committed.

*Theme.* `frontend/src/styles/index.css` adds a semantic token layer
(`canvas`/`surface`/`sunken`/`raised`/`line`, `ink` roles, brand roles, status
roles) and a `:root.dark` block that re-points the `zinc`, `stone`, `white`, and
chromatic ramps the app already uses, so existing utilities such as `bg-white`
and `text-zinc-600` re-theme without a single component edit. An inline script
in `index.html` reads `localStorage["cmm.theme"]` and sets the `dark` class
before first paint, so there is no flash, and dual `theme-color` metas match the
browser chrome. `ThemeToggle` (Light / Dark / System) is now reachable from every
shell: the public header, the admin sidebar, and the seller and professional
sidebars through the shared `WorkspaceAccountFooter`. The four layouts are router
siblings, so a workspace shell cannot inherit the public header's control and
carries its own.

*Product imagery.* `ProductImage` plus `products/lib/product-image.ts` replace
the removed `product-images.ts` and are the only way a product picture is
rendered. A product shows a photograph belonging to that product, or a
placeholder that is labelled as one — there is no category stock photo and no
brand-matching step, because filling the slot with something plausible would
misrepresent what the seller is offering. `productImageSrc` accepts absolute
`http(s)` URLs and root-relative paths verbatim and refuses every other scheme,
so a stray stored value falls back to the placeholder instead of reaching
`<img src>`. Every product surface reads it, including the seller inventory
table, which held the last raw `<img>` on a product.

*Procurement visibility.* `attachProcurementProject`, in the
`ProcurementProjectLinker` port, attaches an `{ id, title, status }` project
summary to RFQ and order detail reads. `ProjectService.findProcurementProjectSummary`
returns `null` for any actor that is not the owning professional, so the field is
owner-only by construction and the frontend needs no role check of its own;
`AttachedProjectLink` renders it on both detail pages. A seller reading an RFQ
they may quote now also receives `projectId: null`, so the buyer's internal
project grouping is not exposed through the seller view.

## 4. Completed Modules

- Authentication and role-based access control.
- Category management.
- Seller product CRUD.
- Customer order creation, ownership access, cancellation, and admin status
  updates.
- Transactional stock reservation/restoration and order-price snapshots.
- Manual, proof-based order payments with:
  - Checkout payment options resolved from the seller's configured manual
    payment destinations, restricted to single-seller carts.
  - Multipart payment-proof upload capped at 5 MB, validated by MIME type and
    by image magic-byte signature, with at most one payment per order and
    storage rollback when the database write fails.
  - Payment proofs stored as objects (Supabase Storage in deployment) and
    served only through an authenticated endpoint that rejects path traversal
    and non-participants.
  - Seller verification or rejection, allowed only while the order is
    `PENDING_PAYMENT_VERIFICATION` and its payment is `PENDING_VERIFICATION`.
  - Buyer-visible payment detail per order.
  - No automated gateway, webhook, refund, or payout handling.
- Seller inventory offers with per-seller, per-product price, quantity, city,
  region, and delivery availability; seller-only CRUD and uniqueness per
  `(sellerId, productId)`.
- Order fulfilment with seller order detail, seller status transitions,
  buyer-initiated completion of a `DELIVERED` order (idempotent when already
  `COMPLETED`), and append-only inventory transactions for shipments and
  cancellations.
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
- Customer product wishlists with:
  - Customer-only authenticated access.
  - Add, list, and remove operations by product ID.
  - Customer-scoped data isolation.
  - One wishlist entry per customer and product.
  - Newest-first deterministic listing with complete product, seller, and
    category summaries.
  - Automatic cleanup when a customer or product is deleted.
- RFQs and supplier quotations with:
  - Customer-owned RFQ creation, listing, conditional updates, cancellation,
    category filtering, status filtering, pagination, and automatic expiry.
  - One to twenty requested material lines with category and optional product
    references, quantity/unit requirements, specifications, and snapshots.
  - Seller eligibility based on covering every requested category.
  - One complete quotation per seller and RFQ with seller-owned,
    category-matching catalog products and server-calculated totals.
  - Seller-only quotation updates and withdrawal, customer-only rejection and
    acceptance, and competing-quotation confidentiality.
  - Atomic quotation acceptance that revalidates catalog state, reserves stock,
    creates a quoted-price order, awards one quote, and rejects competitors.
  - Read-only administrator oversight and database constraints for workflow
    consistency, positive values, and one accepted quote per RFQ.
  - HTTP `413` handling for requests above the 128kb JSON limit while retaining
    support for the largest schema-valid RFQ.
  - Acceptance-time supplier active-state validation and database-scoped
    competing-quotation confidentiality.
  - Live PostgreSQL verification of acceptance, rollback, concurrent awards,
    row locking, uniqueness, and cross-table workflow constraints.
- Professional identity (M1) with:
  - `PROFESSIONAL` as a real backend role accepted by public registration and
    every role-based access control path.
  - Professional registration through the standard public registration flow
    (`PROFESSIONAL` selectable alongside `CUSTOMER` and `SELLER`).
  - Exactly one professional profile per account with specialties and
    credentials, created and mutated only by the owning professional.
  - Portfolio item management (add, update, delete, list) restricted to the
    owning professional's profile.
  - Professional project management (create, update, reorder, delete) scoped
    to the owning professional.
  - Public professional directory with search, filtering, and pagination.
  - Public project discovery across professional profiles.
  - Full buyer capabilities for professional accounts: `authorizeRoles(
    "CUSTOMER", "PROFESSIONAL")` on order, payment, review, wishlist, and RFQ
    routes, and `isBuyerRole` as the frontend single source of truth.
  - Administrator dashboard buyer totals counting both `CUSTOMER` and
    `PROFESSIONAL` accounts.
- Professional avatar management (M1.5) with:
  - The optional `avatarUrl` on a professional profile settable from the
    profile form on both create and edit, sent as `null` when the input is
    empty so an existing avatar is cleared rather than left untouched.
  - A live preview beside the field that renders only a syntactically
    valid URL, so a half-typed value never requests a broken image.
  - The professional dashboard rendering the stored avatar through the
    shared `ProfessionalAvatar` component with an initials fallback; the
    public profile, directory, and project surfaces already did.
  - Backend behavior unchanged: the existing `VarChar(500)` column, strict
    URL validator, and owner-only create/update endpoints already accepted
    the field. Coverage was extended instead — create, PATCH, clear,
    replace, round-trip on every read, length bounds, and no-clobber when
    specialties or credentials change.
- Project procurement links (backend and frontend) with:
  - Optional `projectId` on RFQ creation, RFQ update, and checkout, resolved
    against the authenticated professional's own projects before any write
    begins. RFQ update is a full replacement, so omitting the field detaches.
  - Owner-private procurement view listing the RFQs and orders attached to one
    project, newest first, with item, quote, and total summaries.
  - Explicit detach endpoints for one linked RFQ or one linked order, scoped by
    project and link identifier together.
  - Project completion blocked while OPEN (unexpired) RFQs or unsettled orders
    remain attached, and project deletion blocked while any link remains.
  - Live PostgreSQL verification that the `ON DELETE RESTRICT` violation
    surfaces as a `409`, that detaching is project-scoped, and that the
    procurement summaries and lifecycle counts match the real queries.
  - Frontend attachment on both entry points: an optional "Attach to project"
    selector on RFQ creation and on checkout, rendered only for `PROFESSIONAL`
    accounts. `CUSTOMER` requests are unchanged — the control is absent and no
    `projectId` is sent.
  - Frontend procurement section on the owner's project detail page listing the
    attached RFQs and orders with loading, empty, and error states, plus
    per-row detach actions with confirmation and per-row error reporting.
  - No completion or deletion guard is reimplemented in the frontend. The
    backend stays the only authority; its `409` messages are surfaced verbatim
    by the existing lifecycle and delete controls.

## 5. Folder Structure

```text
CMM/
  PROJECT_STATE.md
  render.yaml               Render deployment definition (backend + frontend)
  backend/
    prisma/
      schema.prisma
      migrations/
    src/
      app.ts                 Express application composition
      server.ts              HTTP startup and graceful shutdown
      config/                Environment, logging, security configuration
      controllers/           HTTP request/response handling
      middleware/            Auth, roles, validation, rate limits, uploads, errors
      prisma/                Prisma client and generated client
      repositories/          Contracts and Prisma implementations
      routes/                Route composition
      services/              Application use cases
      types/                 Shared TypeScript/Express types
      utils/                 Passwords, token hashing, API errors, async helper
      validators/            Zod input/query schemas
    tests/                   35 Vitest files; HTTP suites use Supertest
      helpers/               In-memory repository test doubles
    README.md
    package.json
  frontend/
    src/
      main.tsx               React entry point
      app/
        App.tsx              Application shell
        api/                 Axios auth wiring
        providers/           Provider composition and React Query client
        router/              Route table and role guards
      features/              admin, auth, cart, checkout, marketplace, orders,
                             payments, products, professional-profile,
                             projects, rfq, seller
      pages/                 Cross-feature pages (auth, catalog, cart, wishlist)
      shared/
        api/                 HTTP client, error mapping, asset URL resolution
        config/              Vite environment access
        forms/               Shared React Hook Form configuration
        layouts/             Public, root, and dashboard layouts
        ui/                  Shared status/presentation components
      styles/                Tailwind entry stylesheet
    scripts/                 Node smoke and capture scripts
    package.json
```

Feature folders draw from a consistent set of subfolders, using only the ones
they need: `api/` for the typed endpoint client, `model/` for request/response
types, `lib/` for query keys and display helpers, `components/` for reusable
pieces, and `pages/` for routed screens.

## 6. Database Schema

PostgreSQL is accessed through Prisma 7. The current schema contains:

| Model | Purpose |
| --- | --- |
| `User` | Customer, professional, seller, or administrator account; stores active/disabled state and a hashed refresh token. |
| `SellerProfile` | One-to-one seller profile containing shop name, phone, address, and the optional manual payment destinations (Telebirr, CBE Birr, bank accounts, e-Birr) offered at checkout. |
| `Brand` | Optional product brand with a unique name, description, and image. |
| `Category` | Administrator-managed product category. |
| `Product` | Seller listing with category, decimal price, stock quantity, primary-image projection, and timestamps. |
| `ProductImage` | Managed product image URL with primary-image state and creation time. |
| `SellerInventory` | Per-seller, per-product offer with price, quantity, city/region, and delivery availability; unique per `(sellerId, productId)`. |
| `Order` | Customer order with status, payment method, and total amount. |
| `Payment` | One manual payment per order: method, provider name, stored proof reference, verification status, and verification time. |
| `OrderItem` | Product/quantity/price snapshot belonging to an order. |
| `InventoryTransaction` | Append-only stock movement for an order shipment or cancellation, unique per `(orderId, productId, type)`. |
| `Review` | Customer rating and optional comment for a purchased product. |
| `WishlistItem` | Customer-saved product with creation time for ordered retrieval. |
| `RequestForQuote` | Customer request containing procurement context, lifecycle status, expiry, and an awarded quotation reference. |
| `RfqItem` | Requested material/category/quantity snapshot belonging to an RFQ. |
| `SupplierQuote` | Seller response with validity, terms, total amount, lifecycle status, and an optional generated order. |
| `SupplierQuoteItem` | Seller product, offered quantity, and quoted-price snapshot for an RFQ item. |
| `ProfessionalProfile` | One-to-one professional identity with headline, bio, optional avatar URL (`VarChar(500)`), specialties, and credentials; mutations are professional-only. |
| `ProfessionalSpecialty` | Named specialty on a professional profile, unique per `(profileId, name)`. |
| `ProfessionalCredential` | Education, certification, training, award, or other credential on a professional profile. |
| `PortfolioItem` | Portfolio entry belonging to a professional profile; managed only by the owning professional. |
| `Project` | Professional project belonging to a professional profile with ordering support; managed only by the owning professional. Optionally acts as a procurement container for the owner's RFQs and orders. |

Relations:

- A `User` may have one `SellerProfile`, many listed products, and many
  customer orders.
- A `User` may have at most one `ProfessionalProfile`; a professional profile
  owns many portfolio items and projects.
- A `ProfessionalProfile` is unique per user, and its write endpoints are
  restricted to the owning professional account.
- A `Product` belongs to one seller and category, and has many images and
  order items.
- A `ProductImage` belongs to one product and is deleted with that product.
- An `Order` belongs to one customer and has many order items.
- An `Order` has at most one `Payment` (`orderId` is unique) and many inventory
  transactions; both are cascade-deleted with the order.
- A `SellerInventory` row belongs to one seller and one product and is unique
  per `(sellerId, productId)`.
- `OrderItem` is unique per `(orderId, productId)`.
- A `Review` belongs to one product and one customer.
- `Review` is unique per `(customerId, productId)`, and its rating is
  constrained to an integer from 1 through 5.
- A `WishlistItem` belongs to one customer and one product.
- `WishlistItem` is unique per `(customerId, productId)` and is cascade-deleted
  with either related record.
- A `RequestForQuote` belongs to one customer and has many requested items and
  supplier quotations.
- A `SupplierQuote` is unique per `(rfqId, sellerId)` and has exactly one line
  per quoted RFQ item.
- Catalog references on RFQ and quote items may become null while their names,
  quantities, units, and prices remain preserved as historical snapshots.
- An accepted supplier quote links to one generated order, and database
  constraints permit at most one accepted quote per RFQ.
- A `RequestForQuote` and an `Order` may each belong to at most one `Project`
  (`projectId`, nullable). Both foreign keys are `ON DELETE RESTRICT`, so a
  project that still has procurement history cannot be deleted until its links
  are explicitly detached. Detaching clears only the link; the RFQ or order
  itself is preserved.

Enums:

- `Role`: `CUSTOMER`, `SELLER`, `PROFESSIONAL`, `ADMIN`
- `OrderStatus`: `PENDING_PAYMENT`, `PENDING_PAYMENT_VERIFICATION`,
  `PAYMENT_VERIFIED`, `PAYMENT_REJECTED`, `PENDING_CONFIRMATION`, `PROCESSING`,
  `READY_FOR_DELIVERY`, `OUT_FOR_DELIVERY`, `REJECTED`, `PENDING`, `CONFIRMED`,
  `SHIPPED`, `DELIVERED`, `COMPLETED`, `CANCELLED`. `PENDING`, `CONFIRMED`,
  `SHIPPED`, and `DELIVERED` are retained for backward compatibility with
  pre-checkout orders and the RFQ acceptance path.
- `PaymentMethod`: `CASH_ON_DELIVERY`, `TELEBIRR`, `CBE_BIRR`, `AWASH_BIRR`,
  `BANK_TRANSFER`, `CBE_BANK`, `AWASH_BANK`, `DASHEN_BANK`, `E_BIRR`
- `PaymentStatus`: `PENDING_VERIFICATION`, `VERIFIED`, `REJECTED`
- `RfqStatus`: `OPEN`, `AWARDED`, `CANCELLED`, `EXPIRED`
- `SupplierQuoteStatus`: `SUBMITTED`, `ACCEPTED`, `REJECTED`, `WITHDRAWN`,
  `CLOSED`
- `RfqUnit`: `BAG`, `KG`, `TONNE`, `LITRE`, `METRE`, `SQUARE_METRE`,
  `CUBIC_METRE`, `PIECE`, `ROLL`, `PALLET`, `LOAD`, `OTHER`
- `ProductApprovalStatus`: `PENDING`, `APPROVED`, `REJECTED`
- `ProductImageType`: `OFFICIAL`, `DEFAULT`, `SELLER_UPLOAD`
- `InventoryTransactionType`: `ORDER_SHIPMENT`, `ORDER_CANCELLATION`
- `ProfileVisibility`: `PUBLIC`, `PRIVATE`
- `CredentialType`: `EDUCATION`, `CERTIFICATION`, `TRAINING`, `AWARD`, `OTHER`
- `ProjectStatus`: `DRAFT`, `PUBLISHED`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`

The project lifecycle guard treats `COMPLETED`, `CANCELLED`, `REJECTED`, and
`PAYMENT_REJECTED` as settled order statuses (`SETTLED_ORDER_STATUSES` in
`backend/src/repositories/project.repository.ts`); every other status counts as
active procurement.

Applied migrations:

1. `20260718110500_init`
2. `20260718121500_phase_2_marketplace_foundation`
3. `20260718170000_align_order_status_values`
4. `20260719120500_advanced_product_discovery_indexes`
5. `20260719121723_product_discovery_trigram_search_indexes`
6. `20260719150000_product_image_management`
7. `20260719170000_admin_dashboard_user_status`
8. `20260720120000_product_reviews`
9. `20260720150000_product_wishlist`
10. `20260720230538_phase_4_module_3_rfq_supplier_quotations`
11. `20260720231500_rfq_database_constraints`
12. `20260721150000_phase_4_module_3_stabilization`
13. `20260721170000_phase_4_module_3_constraint_closure`
14. `20260802130708_product_catalog_inventory`
15. `20260804190000_complete_checkout_orders`
16. `20260804193000_preserve_legacy_order_default`
17. `20260804220000_bank_transfer_payments`
18. `20260804223000_ethiopian_payment_agents`
19. `20260805113000_seller_manual_payment_profiles`
20. `20260805143000_seller_order_fulfillment`
21. `20260805230000_shipment_inventory_transactions`
22. `20260808150000_order_completion`
23. `20260810204353_seller_inventory_transaction_fields`
24. `20260820160217_professional_profiles`
25. `20260826000000_professional_portfolio_items`
26. `20260827000000_professional_projects`
27. `20260829120000_professional_role`
28. `20260829130000_professional_role_backfill`
29. `20260901000000_project_procurement_links`

Product discovery indexes include B-tree indexes for seller, category, price,
quantity, and creation time. PostgreSQL `pg_trgm` GIN indexes accelerate
substring search on product name, description, and seller shop name. Product
images have a product/creation-time index and a PostgreSQL partial unique index
that permits at most one primary image per product. User role and active-state
indexes support administrator filtering and protected-request status checks.
Reviews have customer/product uniqueness, product/creation-time and customer
indexes, and a PostgreSQL rating check constraint. Wishlist items have
customer/product uniqueness plus customer/creation-time and product indexes.
RFQs and supplier quotes have customer/seller/status/expiry/category indexes,
seller/RFQ uniqueness, positive quantity and monetary checks, request/quote
state consistency checks, and a partial unique index for one accepted quote
per RFQ. Stabilization adds a composite seller/category product index plus
database-enforced quotation-line RFQ ownership, quote-total consistency, and
accepted-quote/awarded-RFQ agreement. Constraint closure validates both source
and destination totals when lines move and prevents either side of an accepted
award from changing independently. Project procurement links add
`(projectId, createdAt)` composite indexes to `request_for_quotes` and
`orders`, which serve both the newest-first procurement read path and the
project lifecycle guard's active-procurement counts.

## 7. API Endpoints Created

The application serves 99 endpoints: 98 registered across the 14 routers under
`backend/src/routes/` plus the unmounted `/health` probe. All of them are listed
below.

In the access column, "Customer" means the buyer role set — `CUSTOMER` and
`PROFESSIONAL` — because professional accounts keep full buyer capability
(`authorizeRoles("CUSTOMER", "PROFESSIONAL")`).

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
| `GET` | `/api/products/marketplace/cities` | Public |
| `GET` | `/api/products/marketplace/sellers` | Public |
| `GET` | `/api/products/stores/:sellerId` | Public |
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
| `GET` | `/api/wishlist` | Customer |
| `POST` | `/api/wishlist/:productId` | Customer |
| `DELETE` | `/api/wishlist/:productId` | Customer |
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
| `POST` | `/api/orders` | Customer |
| `GET` | `/api/orders` | Authenticated; alias of `/api/orders/me` |
| `GET` | `/api/orders/me` | Authenticated |
| `GET` | `/api/orders/:id` | Order owner or admin |
| `PATCH` | `/api/orders/:id/status` | Admin |
| `POST` | `/api/orders/:id/complete` | Order owner |
| `DELETE` | `/api/orders/:id` | Order owner or admin |
| `POST` | `/api/payments/options` | Customer |
| `POST` | `/api/payments/manual` | Customer; multipart proof upload |
| `GET` | `/api/payments/proof/:filename` | Authenticated; order participant or admin |
| `GET` | `/api/payments/:orderId` | Order owner |
| `GET` | `/api/seller/dashboard` | Seller |
| `GET` | `/api/seller/products` | Seller |
| `GET` | `/api/seller/orders` | Seller |
| `GET` | `/api/seller/orders/:orderId` | Seller |
| `PATCH` | `/api/seller/orders/:orderId/payment` | Seller; verifies or rejects a manual payment |
| `PATCH` | `/api/seller/orders/:orderId/status` | Seller |
| `GET` | `/api/seller/analytics` | Seller |
| `GET` | `/api/seller/inventory` | Seller |
| `POST` | `/api/seller/inventory` | Seller |
| `PATCH` | `/api/seller/inventory/:id` | Seller |
| `DELETE` | `/api/seller/inventory/:id` | Seller |
| `GET` | `/api/seller/profile` | Seller |
| `PUT` | `/api/seller/profile` | Seller |
| `PATCH` | `/api/seller/profile` | Seller |
| `GET` | `/api/admin/dashboard` | Admin |
| `GET` | `/api/admin/orders` | Admin |
| `GET` | `/api/admin/users` | Admin |
| `PATCH` | `/api/admin/users/:id/status` | Admin |
| `GET` | `/api/admin/sellers` | Admin |
| `GET` | `/api/admin/products` | Admin |
| `DELETE` | `/api/admin/products/:id` | Admin |
| `GET` | `/api/professional-profiles` | Public directory of public profiles |
| `POST` | `/api/professional-profiles` | Professional |
| `GET` | `/api/professional-profiles/me` | Professional |
| `GET` | `/api/professional-profiles/:profileId` | Public when profile is public; otherwise owner |
| `PATCH` | `/api/professional-profiles/:profileId` | Owning professional |
| `DELETE` | `/api/professional-profiles/:profileId` | Owning professional |
| `PUT` | `/api/professional-profiles/:profileId/specialties` | Owning professional |
| `POST` | `/api/professional-profiles/:profileId/credentials` | Owning professional |
| `PATCH` | `/api/professional-profiles/:profileId/credentials/:credentialId` | Owning professional |
| `DELETE` | `/api/professional-profiles/:profileId/credentials/:credentialId` | Owning professional |
| `GET` | `/api/professional-profiles/:profileId/portfolio` | Public when profile is public; otherwise owner |
| `POST` | `/api/professional-profiles/:profileId/portfolio` | Owning professional |
| `PATCH` | `/api/professional-profiles/:profileId/portfolio/:itemId` | Owning professional |
| `DELETE` | `/api/professional-profiles/:profileId/portfolio/:itemId` | Owning professional |
| `GET` | `/api/projects` | Public discovery of published projects |
| `POST` | `/api/projects` | Professional |
| `GET` | `/api/projects/me` | Professional |
| `PUT` | `/api/projects/me/reorder` | Professional |
| `GET` | `/api/projects/:projectId` | Public when published; owner in any status |
| `PATCH` | `/api/projects/:projectId` | Owning professional |
| `PATCH` | `/api/projects/:projectId/status` | Owning professional |
| `GET` | `/api/projects/:projectId/procurement` | Owning professional |
| `DELETE` | `/api/projects/:projectId/procurement/rfqs/:rfqId` | Owning professional |
| `DELETE` | `/api/projects/:projectId/procurement/orders/:orderId` | Owning professional |
| `DELETE` | `/api/projects/:projectId` | Owning professional |

`GET /api/products` query parameters:

```text
page, limit, search, categoryId, sellerId, minPrice, maxPrice,
stock, sortBy, sortOrder
```

## 8. Technologies Used

Backend:

- Node.js 24+ and npm 11+
- TypeScript with ESM modules
- Express 5
- PostgreSQL 17
- Prisma 7 with `@prisma/adapter-pg` and `pg`
- Zod 4 request validation
- JSON Web Tokens and bcrypt
- cookie-parser, CORS, Helmet, express-rate-limit
- Pino structured logging
- Multer 2 for payment-proof uploads and `@supabase/storage-js` for
  proof object storage
- Vitest and Supertest for HTTP integration tests
- tsx for development-time TypeScript execution

Frontend:

- React 19 with TypeScript, built by Vite 7
- React Router 7 for routing and role-guarded routes
- TanStack React Query 5 for server-state fetching, caching, and mutations
- Axios for the HTTP client layer
- React Hook Form 7 with `@hookform/resolvers` and Zod 4 schemas for forms
- Zustand 5 for local auth/session state
- Tailwind CSS 4 via `@tailwindcss/vite`
- lucide-react icons
- ESLint 9 with `typescript-eslint` (`--max-warnings 0`)
- No frontend unit-test runner is configured. Frontend verification is
  typecheck, lint, production build, and the Node marketplace smoke script
  (`frontend/scripts/smoke-marketplace.mjs`).

Deployment and configuration:

- Supabase-hosted PostgreSQL, accessed through the connection pooler with
  `DATABASE_URL` plus `DIRECT_URL` for migrations
- Render deployment described by `render.yaml`, which injects
  `VITE_API_BASE_URL` into the frontend build (`sync: false`)
- Local development uses `backend/.env` (`PORT=3055`) and `frontend/.env`
  (`VITE_API_BASE_URL=http://localhost:3055/api`); both files are gitignored
- CI pipelines and production observability are still not configured.

## 9. Remaining Tasks

The post-M1 presentation and procurement-visibility increment described in
section 3 is implemented and verified. It is not yet committed; that is the only
step it has left.

The project procurement links increment is complete on the backend and the
frontend. What remains for it is deferred rather than unfinished:

- The procurement view is unpaginated; see section 12.
- There is no RFQ edit screen. RFQ detail and order detail now show the owning
  professional which project a record belongs to, but detaching is still only
  possible from the project procurement section. The backend update endpoint
  treats an omitted `projectId` as a detach, and no UI reaches it.

Features outside the currently implemented scope:

- Automated payment-gateway capture, provider webhooks, refunds, and seller
  payouts or settlement. Manual proof-based payment submission, seller
  verification/rejection, and payment status tracking are implemented — see
  section 4 — so only the automated side of payments remains unscoped.
- Buyer/seller chat or messaging.
- Notifications.
- Delivery charges.
- CI pipelines and production observability. The frontend client and the
  Render/Supabase deployment configuration are implemented and in use; see
  section 8.

## 10. Next Exact Task To Continue

**M1 Professional Identity is complete and committed, including the project
procurement links increment on both the backend and the frontend, and the
M1.5 professional avatar management increment.** The backend typechecks and
passes the full suite against live PostgreSQL; the frontend typechecks,
lints, and builds.

**The next step is reviewing and committing the post-M1 presentation and
procurement-visibility increment** in section 3. It is implemented and verified —
frontend typecheck, lint, production build, ink-contrast guard, the four backend
contract suites, backend typecheck, and the marketplace runtime smoke test all
pass; see the Verification Baseline — but it is still uncommitted in the working
tree. No code work is outstanding on it.

One item needs confirmation rather than implementation: M1.5 was never
written down as a specification. Its scope was reconstructed from the
implemented state — the avatar was the only professional-identity field the
backend accepted but no UI could set. If "M1.5" was intended to cover more
than avatar management, those requirements still need to be provided.

Beyond committing that increment, no approved implementation work remains. Do
not begin payments, messaging, notifications, or another business module until
the next requirements are provided and approved.

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
- Public registration permits `CUSTOMER`, `SELLER`, and `PROFESSIONAL`;
  `BUYER` is accepted as a legacy alias for `CUSTOMER`. `ADMIN` cannot be
  self-registered.
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
- Wishlist access is restricted to customers at both the route and service
  layers. Entries are always scoped by the authenticated customer ID.
- Wishlist uniqueness is enforced by the service-facing repository and by a
  PostgreSQL unique index so concurrent duplicate additions remain safe.
- Wishlist lists are ordered by newest creation time with the item ID as a
  deterministic tie-breaker and include the standard product, seller, and
  category summaries.
- Wishlist foreign keys cascade on customer or product deletion so saved-item
  records cannot become orphaned.
- RFQs use `OPEN`, `AWARDED`, `CANCELLED`, and `EXPIRED` terminal workflows.
  Expiration is applied lazily on RFQ reads and mutations without requiring a
  scheduler.
- A seller is eligible for an open RFQ only when their catalog covers every
  requested category. Sellers can see only their own quotation details.
- Each seller may submit one quotation per RFQ. Quotations must cover every
  RFQ item exactly once with seller-owned products in matching categories.
- Quote submission does not reserve stock. Acceptance uses a serializable
  transaction and conditional stock updates to prevent duplicate awards and
  overselling.
- Acceptance revalidates that the quoted supplier account remains active.
- RFQ expiration changes the RFQ row before closing submitted quotations so
  transaction lock ordering remains RFQ-first across mutation workflows.
- Seller RFQ reads filter quotation relations in PostgreSQL before application
  mapping, so competing quotation data is not hydrated unnecessarily.
- JSON request bodies are limited to 128kb and oversized requests return HTTP
  `413`.
- Accepted quotations create normal `PENDING` orders with quoted-price
  snapshots, so existing order status, seller analytics, and delivered-order
  review eligibility continue to apply.
- Requested quantities may use construction units and decimal precision;
  sellers provide integer offered product units that map safely to inventory.
- RFQ and quote catalog references use snapshots and nullable foreign keys so
  historical procurement records survive product or category changes.
- Administrative product deletion is blocked when historical order items
  reference the product.
- Category deletion is blocked when products reference that category.
- Project procurement links are `ON DELETE RESTRICT` with an explicit detach
  endpoint per link type, rather than `SET NULL` on project deletion. Silently
  unlinking procurement history would let one delete rewrite records the owner
  never looked at; RESTRICT forces the owner to see and clear each link.
- Detach queries put the project identifier and the link identifier in the same
  predicate (`updateMany({ where: { id, projectId } })`), so proving ownership
  of one project can never rewrite another project's links.
- A missing project and another owner's project are reported identically
  (`404`) on every procurement path, so the endpoints cannot be used to probe
  which project identifiers exist.
- Project resolution happens before the repository's write transaction opens,
  so an invalid or foreign project identifier never costs a stock-reserving
  write.
- `ProjectService` satisfies a narrow `ProcurementProjectLinker` port that the
  RFQ and order services depend on, so those services can resolve a project
  without gaining access to project CRUD.
- The completion guard counts unexpired OPEN RFQs and unsettled orders only.
  An OPEN RFQ past its expiry is domain-expired and is excluded, so a stale row
  nobody has read cannot block project completion forever. `CANCELLED` projects
  are deliberately not guarded; only completion is.
- The list of settled order statuses is a single shared constant used by both
  the PostgreSQL and in-memory project repositories, so the guard cannot drift
  between them.
- The procurement view is owner-private and is never merged into public project
  detail, so publishing a project does not publish its purchasing history.
- An order created by accepting a quote inherits the RFQ's project, so awarded
  procurement stays attached to the project the request was raised for.

## 12. Known Bugs Or TODOs

No known failing tests or confirmed functional bugs as of 2026-09-05. The
product-discovery batch transaction now sets an explicit transaction-start
budget (`maxWait`) after live smoke verification surfaced Prisma `P2028`
"unable to start a transaction" failures under Supabase latency.

Current limitations and deferred work:

- Routine HTTP tests continue to use in-memory repositories. RFQ persistence
  acceptance, rollback, concurrency, row locking, uniqueness, and strengthened
  constraints now run against the configured live PostgreSQL database. Broader
  end-to-end HTTP verification with PostgreSQL is not yet automated in CI.
- PostgreSQL `pg_trgm` must be available to apply the discovery search-index
  migration. It is available on the currently verified PostgreSQL 17 setup.
- Offset pagination is sufficient for the current API but may need cursor
  pagination if the catalog grows large or users require highly stable views
  during concurrent catalog updates.
- Public product review lists are currently unpaginated and should gain
  cursor or offset pagination before products accumulate large review volumes.
- Customer wishlist lists are currently unpaginated and should gain cursor or
  offset pagination before customers accumulate large saved-product sets.
- Full-text ranking, typo tolerance beyond trigram matching, faceted counts,
  and search-result highlighting are not implemented.
- Product media management stores validated external image URLs only. Binary
  upload, resizing, object storage, and remote-file lifecycle management are
  not implemented.
- Professional avatars are external image URLs only, on the same basis as
  product media: no upload, cropping, resizing, or object storage. A URL that
  fails to load falls back to initials at render time, and reachability is
  never validated on save.
- RFQ expiration is applied lazily when RFQ endpoints are accessed; there is
  no background scheduler that updates untouched expired rows immediately.
- The owner-private project procurement view
  (`GET /api/projects/:projectId/procurement`) returns every attached RFQ and
  order in one unpaginated response. It is bounded in practice by how much
  procurement one professional attaches to a single project, but it should gain
  pagination before that count can grow large.
- RFQ detail and order detail now show the attached project to the owning
  professional, but there is still no RFQ edit screen, so detaching a link is
  only possible from the project procurement section.
- The project procurement section lists every attached RFQ and order because the
  endpoint behind it is unpaginated; it inherits that limit.
- RFQ seller eligibility uses relational category coverage and may need
  denormalized targeting or specialized indexes at very large catalog scale.
- Payments are manual and proof-based only. Automated gateway capture, provider
  webhooks, refunds, and seller payouts/settlement are not implemented.
- Messaging, notifications, delivery charges, CI pipelines, and production
  observability remain unscoped and unimplemented.
- The dark theme works by re-pointing the `zinc`, `stone`, `white`, and
  chromatic ramps under `:root.dark`, not by migrating components to semantic
  tokens. New UI must keep using those ramps or the semantic tokens for the
  inversion to hold; a hard-coded hex or an unmapped colour will not re-theme.
  The `.dark` block is deliberately unlayered so it outranks `@layer theme`'s
  `:root`.
- The seller inventory row has no category on its entry, so a product without a
  photograph falls back to the neutral placeholder icon rather than a
  trade-specific one. At that thumbnail size no placeholder caption renders
  either way.
- The live database still holds integration-test fixture products ("Inventory
  test product", "Order Integration Product", and their UUID-suffixed
  categories), and they appear in the public catalog: five of the first twelve
  cards on `/products` are fixtures. This predates the presentation increment
  and is test-data hygiene, not application code. Cleaning it requires deleting
  live rows and has not been done.

## Verification Baseline

Re-verified for the post-M1 presentation and procurement-visibility increment
(2026-09-05). Every gate below was actually executed in this repository:

```text
frontend typecheck           PASS (tsc -b)
frontend lint                PASS (eslint . --max-warnings 0)
frontend build               PASS (vite build, 1931 modules transformed)
frontend ink-contrast guard  PASS (no white ink found near a warm fill)
backend typecheck            PASS (tsc --noEmit)
backend contract suites      PASS (204 tests, 4 files, 8.43s)
frontend marketplace smoke   PASS (5 layouts, no overflow, no browser errors)
```

The contract suites are the same four files as before — `project-procurement`,
`rfqs`, `orders`, `projects` — now 204 tests rather than 195. Unlike the earlier
frontend-only procurement increment, this one does change backend files
(`rfq.service.ts`, `order.service.ts`, `project.service.ts`,
`procurement-project.port.ts`), which is why those suites are the gate that
matters. They use in-memory repositories and need no database. The full 890-test
live-PostgreSQL suite was not re-run for this increment; the 2026-09-03 result
below stands as that baseline.

The marketplace smoke test *was* re-run for this increment, and passes, because
product imagery is public: `/products`, `/stores`, and the store page are exactly
the surfaces `ProductImage` now renders. It needs both local services running
(`npm run dev` in `backend`, then in `frontend`) and the command issued from the
repository root. Two lines in a passing run are expected and are not defects: six
`401` responses on `/api/auth/refresh`, which is what an anonymous visitor with no
refresh cookie gets and which the script's own critical-response filter excludes,
and an Edge `fallback_task_provider.cc` line on stderr, which is browser noise.
`vite build` also warns that the main chunk exceeds 500 kB; that warning predates
this increment and does not fail the build.

Backend re-verified end to end for the M1.5 professional avatar increment
(2026-09-03):

```text
backend typecheck            PASS
backend test suite           PASS (890 tests, 35 files, 574.64s, live PostgreSQL)
prisma migrate status        PASS (29 migrations applied, schema up to date)
professional profile suite   PASS (115/115, 13 avatar tests, inside the full suite)
RFQ integration suite        PASS (10/10, inside the full suite)
project procurement suite    PASS (10/10 live PostgreSQL, inside the full suite)
```

Frontend re-verified for the M1.5 professional avatar increment (2026-09-03):

```text
frontend typecheck           PASS
frontend lint                PASS (eslint . --max-warnings 0)
frontend build               PASS (tsc -b && vite build, 1930 modules)
```

The procurement frontend increment changed no backend file. The four HTTP
suites that define the contract it consumes were re-run standalone to confirm
that (these use in-memory repositories, so they need no database). This is that
increment's historical result; the current count for the same four files is the
204 in the 2026-09-05 block above:

```text
project-procurement.test.ts  ┐
rfqs.test.ts                 ├ PASS (195 tests, 4 files, 8.77s)
orders.test.ts               │
projects.test.ts             ┘
```

The marketplace smoke test was not re-run for the procurement increment or for
M1.5: it drives the public marketplace, while every screen those two changed (RFQ
creation, checkout, project detail, and for M1.5 the profile form and the
professional dashboard) is behind buyer or professional authentication, so it
would have exercised none of them. Their frontend baseline was therefore carried
forward from the M1 Professional Identity baseline (2026-09-01, re-verified end
to end after the local frontend API base URL was corrected):

```text
frontend marketplace smoke   PASS (5 layouts, no overflow, no browser errors)
```

That reasoning does not apply to the presentation increment, whose changed
surfaces are public; its smoke result is the 2026-09-05 line above and was
produced by an actual run.

The full backend suite also covers the rate-limit and admin dashboard tests and
the order and inventory-synchronization integration suites; those are not
tracked as separate baseline lines. The two suites called out in the backend
block above are the live-PostgreSQL integration files
(`prisma-rfq.integration.test.ts`, `prisma-project-procurement.integration.test.ts`);
they are the slowest and most environment-sensitive part of the run and are
reported inside the full suite rather than run on their own.

The frontend marketplace smoke test (`node frontend/scripts/smoke-marketplace.mjs`,
run from the repository root) now passes against the local backend on port 3055.
Its earlier failures had two causes, both resolved: the product-discovery
transaction-start failure documented above (fixed by the explicit `maxWait`), and
a local `frontend/.env` that pointed `VITE_API_BASE_URL` at the deployed Render
backend instead of `http://localhost:3055/api`.

Local development requires `frontend/.env` to set
`VITE_API_BASE_URL=http://localhost:3055/api` so it matches `PORT=3055` in
`backend/.env`. That file is gitignored; the production value is injected by
Render (`render.yaml`, `VITE_API_BASE_URL`, `sync: false`).

The live RFQ integration tests are latency-sensitive against the Supabase
pooler in `eu-west-1`. An intermediate run failed 5/10 with Prisma `P2028`
transaction-expiry and dropped-connection errors purely from network latency;
the same file passes when latency is normal. Treat isolated failures of that
file as environmental until reproduced twice.

A broad failure can be environmental too. A first full-suite attempt on
2026-09-03 failed 46 tests across 5 files with `Can't reach database server at
aws-1-eu-west-1.pooler.supabase.com`, including the `rate-limit.test.ts` tests,
which drive `/health` and see `503` whenever its database probe fails. Nothing
was changed: `prisma migrate status` confirmed the database was reachable again
and the immediate re-run passed 890/890. Confirm connectivity before treating a
database-wide failure as a regression.

RFQ HTTP tests cover customer and seller lifecycles, authentication, role and
ownership enforcement, customer and quotation isolation, strict validation,
seller eligibility, quote rejection and withdrawal, expiration, atomic quote
acceptance, order creation, quoted-price snapshots, stock rollback, deleted
products, inactive suppliers, payload-size handling, and simultaneous
acceptance attempts. Focused Prisma RFQ repository tests cover snapshots,
decimal totals, seller-scoped quote loading, lock ordering, duplicate-quote
translation, acceptance transactions, order creation, and insufficient-stock
handling. Live PostgreSQL tests cover acceptance commits, transaction rollback,
competing concurrent acceptance, row locking, uniqueness, quote-line movement,
award-state transitions, and strengthened cross-table constraints. Professional
identity is covered by profile, portfolio, project, directory, discovery, and
registration tests, including professional-only mutation enforcement and
professional buyer-capability tests across orders and RFQs. Avatar handling is
covered by 13 tests spanning create, PATCH, explicit clear, replacement,
round-trip on `/me`, the public profile and the directory, both length bounds,
malformed input on both write paths, and no-clobber when specialties or
credentials change.
