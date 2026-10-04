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
