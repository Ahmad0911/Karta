# Karta Web

Curated furniture & home-living marketplace (Hamd Tech Ltd). Vite · React 18 · TypeScript · Tailwind 3 · React Router 6 · Zustand.

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # typecheck + production build
```

## Routes
| Path | Access | Status |
|---|---|---|
| `/`, `/shop`, `/product/:id`, `/cart`, `/vendors/:id` | Public | Built |
| `/login`, `/register` | Public | Built (mock auth, see Notes) |
| `/apply/logistics` | Public | Built (driver application, verified by an admin) |
| `/checkout`, `/checkout/return` | Signed in | Built (payment provider adapter, mock gateway in dev) |
| `/account`, `/account/orders`, `/account/orders/:id` | Signed in | Built (reviews after delivery) |
| `/account/settings` | Signed in | Built (edit name/phone, saved addresses, notification preferences, delete account) |
| `/account/security` | Signed in | Built (change password; forced for staff-created accounts) |
| `/account/returns`, `/account/returns/new`, `/account/returns/:id` | Signed in | Built (returns within 7 days, photos, appeals, refunds) |
| `/account/support`, `/account/support/new`, `/account/support/:id` | Signed in | Built (tickets with staff replies) |
| `/request`, `/account/requests`, `/account/requests/:id` | Signed in | Built (ask for a custom piece; accept a vendor's offer) |
| `/forgot-password` | Public | Built (email code reset) |
| `/vendor/*` | vendor | Built: application, products, orders, payouts, returns, customer requests, reviews, insights, settings |
| `/admin/*` | admin | Built: vendor verification, listing moderation, review moderation, returns & refunds, support inbox, custom requests, driver applications, driver accounts |
| `/logistics/*` | logistics | Built: assigned deliveries, proof of delivery, failed attempts |

Browsing is open. Sign-in is requested at checkout and account pages, then returns the user to where they were.
See `UPDATE_NOTES.md` for a step-by-step walkthrough of the whole flow.

## Structure
```
public/            static assets. Put images here (see below)
src/app/           App + routes
src/layouts/       PublicLayout, AuthLayout, PortalLayout (shared by vendor, admin, logistics)
src/pages/         thin route screens
src/modules/       one folder per BRD module: catalog, vendors, logistics, admin, orders, payments, reviews, marketing
                   (still to add: returns, support, analytics)
src/components/    ui/, layout/, brand/
src/store/         auth + cart (Zustand, persisted)
src/data/          SAMPLE data. Replace with API calls
src/types/         Role, Product, TrustCategory (BRD §8, §11)
```

## Adding images (all optional; gradients show until they exist)
- `public/images/hero/hero-1.jpg`: landing hero (portrait, about 1400×1800)
- `public/images/rooms/<id>.jpg`: living, dining, bedroom, office, outdoor, lighting, rugs, decor (4:5)
- `public/images/products/…`: then set `image: '/images/products/p1.jpg'` on each product in `src/data/products.ts`
- `public/brand/`: logo variants (transparent dark + light) and the original file. Replace with SVGs when available.

## Config
`.env`: copy `.env.example`. `VITE_WHATSAPP_NUMBER` shows the WhatsApp button; `VITE_PAYMENT_PROVIDER` selects the payment provider (see `src/modules/payments`).

## Brand tokens (`tailwind.config.ts`)
`ink #101E21` · `paper #FAF9F3` · `brass #BC8E63` (use `brass-700` for text). Display: Cormorant Garamond. Body: Inter.

## Notes
- Auth, vendor approval, payments and reviews are **mocks** stored in the browser. Real auth, RBAC, vendor verification and payment verification must be enforced server-side (BRD §20.3). Each store action marked `MOCK` maps to one API call.
- Logic tests: `npm run test:logic` (see `dev-tests/`) (see its README). `test6` also guards against unstable zustand selectors (an infinite render loop).
- The BRD specifies Next.js for web. This scaffold stays on Vite; the module layout maps cleanly if you migrate.
