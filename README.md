
# Voucher Shop (CMS-powered Gift Voucher E-commerce)

Voucher Shop is an e-commerce application (Node.js + Express + Prisma + PostgreSQL) for selling **vouchers as products** with **variants/attributes**, dynamic price calculation, and **voucher personalization** (e.g., recipient name, dedication). The project includes an **admin panel** for managing catalog and CMS content.

The frontend started from ready-made HTML/CSS/JS templates and was later integrated with backend logic and database data.

## Key features

- Storefront SSR (EJS): home page, product list, product page, cart, checkout
- Session-based cart (PostgreSQL-backed sessions), supports multiple variants of the same product
- Product variants via attributes + attribute values (with price deltas)
- Dynamic price calculation: base price + variant deltas + VAT
- Voucher personalization per unit (recipient + dedication)
- Orders and user order history
- Admin panel (SSR, AdminLTE):
	- Product CRUD
	- Attribute and attribute value CRUD (including price deltas)
	- CMS pages (with HTML sanitization)
	- Banners
	- Navigation/menu (hierarchy)
- Image upload + normalization (multer + sharp)

## High-level architecture

- **Storefront (server-rendered):** EJS under `/`.
- **Admin panel (server-rendered):** EJS + AdminLTE under `/admin` (requires admin role).
- **API (JSON):** under `/api` (used by frontend JS, e.g., cart operations).
- **DB:** PostgreSQL + Prisma.
- **Session state:** `express-session` + `connect-pg-simple` (sessions stored in PostgreSQL); the cart is stored in `req.session`.

## Notable design decisions

### 1) Project focus: selling and configuring vouchers, not generating them

The project does not generate “final” voucher artifacts (e.g., PDFs, QR/codes, unique redemption numbers, email delivery). The focus is on:

- modeling the voucher-as-a-product,
- configuring variants,
- price calculation,
- personalization and persisting data in the order.

### 2) Variant-aware cart keys

Cart items use a deterministic key:

- Format: `slug--<sorted-attributeValueIds>` (or just `slug` when there are no attributes)
- Attribute value IDs are normalized (unique + sorted), so the same selection always maps to the same item
- This allows multiple variants of the same product to coexist in the cart

### 3) Dynamic pricing (VAT + price deltas)

- The product base price is stored as a net value
- Attribute values have a gross `priceDelta`
- Deltas are converted to net based on the product VAT, and the unit price is calculated at runtime

### 4) Cart price repair (trust the DB, not the session)

If an admin changes prices/attributes, the cart stored in the session may become stale. Before checkout (and on the cart page), prices are recalculated from the current database state.

### 5) Personalization per unit

The cart stores `recipients[]` aligned to `quantity`. During checkout, each unit becomes its own `OrderItem` (quantity=1) to preserve per-voucher recipient details.

### 6) CMS navigation tree from a flat table

In the database, navigation is flat (`parentId`), and a tree is built for rendering in the storefront.

## Project architecture (tree)

```text
ecommerce-project/
├─ app.js          # Express app entry (mounts routes, sessions, error handler)
├─ routes/         # route groups
│  ├─ web/         # SSR storefront (EJS)
│  ├─ admin/       # SSR admin panel (AdminLTE)
│  └─ api/         # JSON endpoints used by frontend JS
├─ middleware/     # auth/guards + request helpers
├─ services/       # business logic (pricing, checkout, image processing)
├─ models/         # data access layer (Prisma-backed)
├─ prisma/         # Prisma schema + migrations + client setup
├─ views/          # EJS templates (store + admin)
├─ public/         # static assets (templates, images, JS, CSS)
├─ scripts/        # utility scripts (seed, user management)
└─ docker/         # Docker build files
```

## Technology stack

| Category | Technology |
|---|---|
| Runtime | Node.js |
| Web framework | Express |
| Templating (SSR) | EJS |
| DB | PostgreSQL |
| ORM | Prisma |
| Sessions | express-session + connect-pg-simple |
| Auth | bcrypt (password hashing) |
| Image upload | multer |
| Image processing | sharp |
| Validation | express-validator |
| CI | GitHub Actions |
| Code quality | Biome |
| Deployment | Docker + Docker Compose |

## Testing strategy

There are currently no automated tests (unit/integration/e2e) in this project. Verification was done manually via:

- user flows (register/login, cart, checkout, order details),
- admin flows (CRUD for products/attributes/banners/pages, image upload),
- checking pricing correctness after DB changes.

Natural next steps would be integration tests for the services layer (pricing/checkout) and endpoint tests for `/api`.

## Running the project

### Local development

Requirements: Node.js 20+ and PostgreSQL.

1) ENV:

- Copy `.env.example` → `.env`
- Set `DATABASE_URL` and `SESSION_SECRET` (optionally `PORT`)

2) Install:

```bash
npm install
```

3) Prisma:

```bash
npx prisma generate
npx prisma migrate dev
```

4) Seed (optional):

```bash
npm run seed
```

5) Start:

```bash
npm run dev
```

By default, the app runs at `http://localhost:3000`.

### Docker

1) ENV:

- Copy `.env.docker.example` → `.env.docker`
- Set `DATABASE_URL`, `SESSION_SECRET`, and `POSTGRES_*`

2) Start:

```bash
docker compose up --build
```

App: `http://localhost:8000`

Note: on container start, `prisma generate`, migrations, and seed are executed.

## Local URLs

- Storefront:
	- `/` (home)
	- `/shop` (list)
	- `/shop/:slug` (product)
	- `/cart`
	- `/checkout` and `/checkout/thankyou`
- Auth:
	- `/auth/register`, `/auth/login`, `/auth/logout`
- User account:
	- `/account`
	- `/addresses` (+ edit)
	- `/orders` and `/orders/:id`
- CMS pages:
	- `/p/:url`
- Admin:
	- `/admin` and modules: `/admin/products`, `/admin/attributes`, `/admin/orders`, `/admin/pages`, `/admin/banners`, `/admin/navigations`

## Scripts

- `npm run dev` – run in dev mode (nodemon)
- `npm start` – run in production mode
- `npm run seed` – seed data (does not overwrite existing records)
- `npm run create-user` – helper script to create a user
- `npm run edit-user` – helper script to edit a user
- `npm run lint` – lint (Biome)
- `npm run format` – format (Biome)
- `npm run format:check` – check/CI-style formatting

Seed creates (if missing): admin + customer users, sample products/attributes/attribute values, basic navigation, and basic pages (e.g., About/Contact).

Default accounts (if created by seed):

- Admin: `admin@example.com`
- Customer: `user@example.com`

Default passwords: `Pass123` (can be overridden via ENV below).

## Environment configuration

Used variables:

- `DATABASE_URL` (required) – PostgreSQL connection string
- `SESSION_SECRET` (required) – secret used to sign sessions
- `PORT` (optional, default 3000; 8000 in Docker)
- `SEED_ADMIN_PASSWORD` (optional) – admin password for seed
- `SEED_CUSTOMER_PASSWORD` (optional) – customer password for seed

Additionally in Docker:

- `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` (must match `DATABASE_URL`)

## Endpoints

### Web (SSR)

- `GET /` – home (banners + latest products)
- `GET /shop`, `GET /shop/:slug`
- `GET /cart`
- `GET /checkout`, `POST /checkout`, `GET /checkout/thankyou`
- `GET/POST /auth/register`, `GET/POST /auth/login`, `POST /auth/logout`
- `GET/POST /account`, `POST /account/password`
- `GET /orders`, `GET /orders/:id`
- `GET/POST /addresses`, `GET/POST /addresses/:id/edit`, `POST /addresses/:id/default`, `POST /addresses/:id/delete`
- `GET /p/:url`

### API (JSON)

- `GET /api/products` – list products
- `GET /api/products/:id` – product details
- `GET /api/cart` – cart (with price repair)
- `GET /api/cart/count` – total item count
- `POST /api/cart/add` – add to cart
- `PUT /api/cart/update/:key` – update quantity and/or personalization
- `DELETE /api/cart/remove/:key` – remove item
- `DELETE /api/cart/clear` – clear cart

### Admin (SSR)

Everything under `/admin/*`, available only to admins (guarded by middleware).

## Code quality (Biome)

- Lint: `npm run lint`
- Format: `npm run format`
- Check (CI): `npm run format:check`

## Frontend templates

Base templates used in this project:

- Storefront: https://themewagon.com/themes/free-bootstrap-4-html5-ecommerece-website-template-shoppers/
- Admin panel: https://github.com/ColorlibHQ/AdminLTE

## License

MIT


