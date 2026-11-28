# Karta update: verification, portals, payments, reviews

## Try it (npm run dev)
Sign-in page has dev shortcuts (dev builds only): vendor / admin / logistics.

1. Register a **vendor** (/register?as=vendor) → complete the 5-step application → Submit.
2. Sign in as **admin** → Vendor applications → review → tick the checklist → Verify.
3. Back as the vendor → Products → add a product → Submit for review.
4. Admin → Listing moderation → Approve. It now appears in /shop.
5. As a customer: add it to the cart → Checkout → test gateway → pay.
6. The vendor sees the order. On the order page click "Dev: mark delivered", then review the vendor and delivery.
7. Admin → Reviews → "Load sample reviews" to see recommendations on the homepage.
8. Admin → **Drivers** → add a driver. Copy the one-time password, sign out, sign in as the driver (it forces a new password), then use Logistics below.
9. **Apply as a driver:** sign out, open /apply/logistics, fill the form, submit. Sign in as admin → Driver applications → tick the checklist → Approve. The driver then opens "Open my driver portal" on /apply/logistics (or signs in again).
10. Logistics → "Assign sample deliveries" (codes 4821, 7350, 1096, 5547, 2204).

## Routes added
/vendor/* (overview, onboarding, products, orders, payouts, reviews, insights, settings)
/admin/* (overview, vendors, vendors/:email, listings, reviews)
/logistics/* (today, deliveries, deliveries/:id)
/admin/staff (create and deactivate driver accounts), /account/security (change password), /apply/logistics, /admin/drivers/applications, /account/settings (profile, addresses, notifications, delete account)
/checkout, /checkout/return, /account/orders, /account/orders/:id, /vendors/:id

## Fixed
- HomePage.tsx had been overwritten with the Account page; restored.
- 2 TypeScript errors that broke `npm run build`.
- "Become a vendor" CTA created a *customer* account; now goes to the vendor page.
- Fake hard-coded product ratings replaced by real review data.

## Must be done on the backend (the browser cannot enforce these)
- Vendor approval, roles, listing visibility, admin actions.
- Passwords, OTP/email verification, sessions, rate limiting.
- Payment amounts, provider calls, webhooks, idempotency.
- Review eligibility, order → vendor fan-out, payouts.
See comments marked MOCK in each store; each action maps 1:1 to an API call.

## Decide before launch (search for "CONFIRM")
Commission rate, return window, delivery fees by state, payout weekday,
review/recommendation thresholds, starting trust score.

## Added in this round
- **Verification codes** (email + phone): Settings → Verification. Needed to pay, apply as a vendor, and to be approved as a driver. In dev the code is shown on screen (nothing is really sent).
- **Forgot password**: /forgot-password (email code).
- **Returns & refunds**: delivered order → "Return an item" (7-day window, photos for damage). Vendor approves/declines → customer can appeal → admin receives the item and refunds through the payment provider. Vendor earnings shrink by the refunded items.
- **Support**: /account/support (customer) and Admin → Support (staff replies + internal notes).
- **Custom requests**: /request. A vendor's offer (price + days) claims the request so other vendors no longer see it. Accepting creates a private piece only that customer can buy.
- **Hero**: 7 rotating images every 5 seconds (pause button, pauses on hover, respects reduced motion).
- **Register page**: new "Join Karta" chooser (Customer, Vendor, Logistics partner).

### Quick test of the new flows (npm run dev)
1. Register as a vendor (/register → Vendor), verify email + phone in the application's Review step, submit. Admin approves.
2. Register as a customer, verify your phone in Settings, then open /request and post a request.
3. Sign in as the vendor → Requests → "I can make this" → send price and days. Sign in as the customer → My requests → Accept → "Go to the piece" → pay.
4. After delivery (dev button on the order page): Return an item, or Get help with this order.

## Backend, Phase 1 (this round)
- New `backend/` folder: real API with accounts, sessions, verification codes, password reset, vendor applications + admin verification, driver accounts and an append-only audit log. 85 tests.
- New `src/lib/api.ts` (web client). The HTTP adapters for payments and verification now send the required `x-karta-client` header.
- The web app still runs on its browser mocks until each store is switched to the API (mapping table in `backend/README.md`). Switching them is the next step.

## Karta is the go-between (no direct vendor ↔ customer contact)

- **Custom requests**: vendors no longer see a Requests page. Customers post a request and chat with Karta. Staff
  (Admin → Custom requests) message the customer, message a chosen vendor (no customer identity), then enter the
  vendor's quote as an offer for the customer. `offer`/`withdraw` were removed from the requests store; only
  `adminOffer` exists.
- **Chat**: one support-thread model for both sides. Customers use `/account/support`, vendors use `/vendor/support`
  ("Messages"), staff see everything in Admin → Inbox (each thread is labelled Customer or Vendor). Staff can start
  a thread. Customers and vendors can never read or write each other's threads.
- **Other direct channels removed**: vendors can't reply to reviews (staff only); a vendor's order-decline reason and
  return decision note are visible to Karta only, not the customer.

## Backend: payments (Paystack)

- `backend/migrations/002_payments.sql`: listings, orders, order_lines, payments, payment_events, refunds.
- `POST /api/orders`: the server prices the order from its own catalogue + delivery table; the browser's prices are ignored.
- `POST /api/payments/initialize`: pays the server-computed total; return URL must be one of `CORS_ORIGINS`.
- `GET /api/payments/verify/:reference`: asks Paystack; a redirect alone never marks anything paid.
- `POST /api/payments/webhook/paystack`: HMAC-SHA512 signature over the raw body, then re-verified with Paystack.
- `POST /api/payments/refund`: staff only, never more than was paid.
- Amount and currency must equal what was requested, settlement is idempotent, duplicates/oversells are flagged in the audit log.
- Set `PAYSTACK_SECRET_KEY` on the **server only**, set the webhook URL in the Paystack dashboard to
  `https://YOUR-API/api/payments/webhook/paystack`, and set `VITE_PAYMENT_PROVIDER=paystack` in the web app.
- Interim: product prices/stock must be published to the server with `PUT /api/admin/listings/:id` until vendor
  products move into the API.

## Real sign-in (web app ↔ backend)

- `src/store/auth.api.ts` + `auth.store.ts`: login, register, logout, change password, profile, delete account and
  session restore now go to the API (httpOnly cookies, roles decided by the server). The store's interface is
  unchanged, so no screens changed.
- **Production builds use the API automatically** (needs `VITE_API_URL`). They can never fall back to the browser-only
  demo accounts. Development keeps the demo accounts unless `VITE_AUTH_PROVIDER=api`.
- On startup `bootstrapSession()` checks the session with the server; an expired session signs the person out.
- Still local-only: "forgot password" screens, staff creating driver accounts, and approving drivers.

## Backend: codes, products, fulfilment

- Real SMS (Termii) and email (Resend) for verification and password-reset codes; production requires `NOTIFIER=live`.
  A failed send returns a friendly error and does not burn the person's cooldown.
- Vendor listings with staff review, a public catalogue, and per-vendor order fulfilment (vendor steps, driver steps).
  Paid orders are split into one fulfilment record per vendor, with Karta's 10% commission recorded.
- NOT yet connected to the web screens: the vendor/admin/driver/customer pages still read local data.

## Photos and the live catalogue

- Backend: `POST /api/uploads/sign` gives vendors/customers a short Cloudinary signature; the browser uploads straight
  to Cloudinary and sends only the resulting link. Listings accept ONLY our own Cloudinary photos when it is configured.
  Set `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` on the server.
- Web (production builds): `useCatalog()` now reads the real catalogue from the API. Demo seed products are no longer
  mixed in (they could never be bought). Made-for-you pieces load by id for their own customer only.
- Still local: vendor screens (profile, listings, orders), admin listing review and admin orders. Next step.

## Vendor, admin and customer screens now use the server (production builds)

- **Vendor**: profile/onboarding, products (with Cloudinary photos) and orders. The server is the only copy; nothing about
  vendors is kept in the browser. Detail pages wait for the server instead of redirecting.
- **Admin**: vendor verification (list, review, decisions with history) and listing moderation.
- **Shoppers**: live catalogue and the verified-vendor directory (`GET /api/vendors`).
- **Customers**: order history and per-vendor delivery progress from `GET /api/orders`; only an unpaid checkout stays in the browser.
- `dev-tests/e2e.mjs` runs the site's own code against a REAL backend (sign-up, verify, apply, approve, list, moderate,
  appear in the shop). The command to run it is at the top of the file.
- NOT yet on the server: driver (logistics) screens, returns, reviews, chat, custom requests, payouts, forgot password.

## Search, filters and link fixes

- `src/modules/catalog/search.ts`: synonyms (couch→sofa, closet→wardrobe), plurals, typo tolerance, every word must match
  and is ranked by where it matched, prices in words ("bed under 600k", "table between 200k and 500k"), closest matches and
  "did you mean" when nothing matches exactly. Covered by `dev-tests/test17.mjs`.
- Header search now shows live suggestions (pieces, types, rooms), recent searches and popular searches; arrow keys, Enter, Esc.
- Shop page: filter by room, type, price and stock; sort; removable filter chips; result counts; loading skeletons; a helpful
  empty state. Everything is in the URL, so a filtered view can be shared or reached with the back button.
- Fixed a dead link on the 404 page (`/products`), added `vercel.json` so every page loads when opened directly or refreshed
  on Vercel (Netlify already had `public/_redirects`), and the login page now explains "please sign in to continue".

## Assembly fee, payouts, refunds

- **Assembly**: the server charges ₦15,000 per unit where the maker offers assembly (`POLICY.assemblyFeeKobo`). Asking for it
  where it isn't offered is refused. Karta collects it; it isn't part of the vendor's earnings. Confirm that with the business.
- **Payouts**: earnings are due 7 days after delivery. Admin → Vendor payouts creates a payout from the bank details on file,
  staff send the money, then record the transfer reference. A delivery can never be in two payouts. Refunded orders are held
  for review. Vendors see only completed payouts. Money is never moved automatically.
- **Refunds**: Admin → Orders & refunds lists what needs attention first (vendor declined, sold out, paid twice) and refunds
  through Paystack, never above what was paid.
