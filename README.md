# QuickMed

A full-stack pharmacy delivery platform built with **Next.js 16 App Router** and **Supabase**. Customers browse and order medicines online, admins manage the back-office, and riders fulfill deliveries with AI-verified proof of delivery.

---

## Features

### Storefront (Customer)
- **Product catalog** — Browse medicines with brand name, generic name, price, and category filters
- **Product detail page** — Full product info, add-to-cart with quantity selector
- **Guest cart** — Persistent cart via `localStorage`, no login required to browse
- **Checkout** — Delivery address with an interactive map pin, distance-based delivery fee calculated via Haversine formula, 12% VAT, and 20% Senior/PWD discount
- **Order tracking** — View all past orders and their real-time status (pending → out for delivery → delivered)
- **Cash on Delivery** — All orders are COD; total shown to rider at drop-off

### Admin Panel (`/admin`)
- **Dashboard** — Live stats: pending orders, active products, active riders, total revenue
- **Orders** — Full order list with status filters, assign riders, set delivery date and schedule
- **Products** — Create, edit, activate/deactivate products with image upload to Supabase Storage
- **Riders** — Register and manage rider profiles with photo upload
- **Team** — Invite admins or riders by email via Supabase magic-link; role-based access control
- **Settings** — Four configuration tabs:
  - **Branding** — Company name, logo upload, primary/secondary/tertiary color pickers with live preview
  - **Location** — Interactive map to pin the pharmacy's base coordinates (used for delivery fee calc)
  - **BIR / Invoice** — TIN, BIR accreditation number, permit number, invoice serial start
  - **Delivery** — Configurable fee per km (₱/km)

### Rider App (`/rider`)
- **Delivery queue** — Today's assigned orders listed by sequence number
- **Drag-and-drop resequencing** — Reorder the delivery queue by dragging cards or using up/down arrows (powered by `@dnd-kit`)
- **Delivery view** — Per-order page showing customer info, items, COD amount, and an embedded map from pharmacy to drop-off
- **Proof of Delivery (POD)** — Camera capture flow:
  1. Rider taps **Capture Proof of Delivery** and photographs the signed invoice
  2. Image is uploaded to Supabase Storage
  3. **Google Gemini AI** (`gemini-2.5-flash`) verifies that the invoice number and recipient in the photo match the order
  4. On match → order marked **delivered**; on mismatch → flagged as **needs manual review** for admin inspection
- **Live map** — Full-screen map view of all today's delivery stops

### Auth & Security
- Supabase email/password auth with magic-link invite flow
- Role-based route protection (storefront / admin / rider) via Next.js proxy
- Service-role API routes for server-side operations (invite, create rider)
- Row-Level Security (RLS) on all Supabase tables

### Branding / White-labeling
- All brand colors injected as CSS custom properties (`--brand-primary/secondary/tertiary`) server-side in the root layout — the entire UI theme updates instantly when settings are saved

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 App Router (TypeScript) |
| Styling | Tailwind CSS v4 + hand-written Radix UI components |
| Backend / DB | Supabase (PostgreSQL + Auth + Storage) |
| AI | Google Gemini 2.5 Flash (POD verification) |
| Maps | react-leaflet + OpenStreetMap (no API key required) |
| Drag & Drop | @dnd-kit/core + @dnd-kit/sortable |
| Forms | react-hook-form + Zod |
| Notifications | Sonner toasts |

---

## Project Structure

```
src/
├── app/
│   ├── (storefront)/        # Customer-facing pages
│   ├── (auth)/              # Login & signup
│   ├── admin/               # Admin panel
│   ├── rider/               # Rider app
│   ├── accept-invite/       # Magic-link password setup
│   └── api/                 # Server-side API routes
│       ├── admin/invite/
│       ├── admin/create-rider/
│       └── pod/verify/
├── components/
│   ├── ui/                  # Reusable UI primitives (Button, Input, Dialog, etc.)
│   ├── storefront/          # Storefront-specific components
│   ├── admin/               # Admin-specific components
│   └── rider/               # Rider-specific components
├── contexts/
│   ├── BrandingContext.tsx  # CSS variable injection
│   └── CartContext.tsx      # Guest cart state
├── lib/
│   ├── supabase/            # Browser + server + admin clients
│   ├── gemini.ts            # POD AI verification
│   ├── haversine.ts         # Distance, delivery fee, VAT helpers
│   └── cart.ts              # localStorage cart utilities
├── types/index.ts           # Shared TypeScript types
└── proxy.ts                 # Route protection (Next.js 16 middleware)
supabase/
└── migrations/              # 3 migration files: schema, storage, helpers
```

---

## Getting Started

### Prerequisites
- Node.js 20+
- [Supabase CLI](https://supabase.com/docs/guides/cli)
- A Google Gemini API key

### 1. Install dependencies

```bash
npm install
```

### 2. Start Supabase locally

```bash
supabase start
```

### 3. Apply database migrations

```bash
supabase db push
```

### 4. Configure environment variables

Create `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-local-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<your-local-service-role-key>
GEMINI_API_KEY=<your-gemini-api-key>
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

### 5. Run the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Database Schema

| Table | Purpose |
|---|---|
| `profiles` | Extended user info (full_name, phone, role, address) |
| `settings` | Singleton row (id=1) — branding, location, BIR, delivery config |
| `products` | Medicine catalog |
| `carts` | One cart per user/session |
| `cart_items` | Line items in a cart |
| `orders` | Orders with status, invoice number, delivery coords, POD data |
| `order_items` | Line items in an order |
| `riders` | Rider profiles with vehicle info and photo |

Invoice numbers are generated atomically via the `get_next_invoice_no()` PostgreSQL function.

---

## Deployment

The app is configured for deployment on Vercel with a Supabase cloud project.

1. Push migrations to the remote project: `supabase db push --linked`
2. Set all environment variables in the Vercel dashboard
3. Update `NEXT_PUBLIC_SITE_URL` to your production domain
4. Deploy: `vercel --prod`
