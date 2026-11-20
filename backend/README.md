# Karta API · Phase 1: the trust core

The server behind Karta's promise: **nobody sells, delivers or pays on Karta until we've verified them.**
Phase 1 builds the foundation and the parts that stop scams.

| Built (Phase 1) | Not yet (see Roadmap) |
|---|---|
| Accounts, sessions, roles (customer, vendor, logistics, admin) | Products, orders, payments, refunds |
| Email + phone verification codes | Returns, support tickets, reviews |
| Password change, forgot/reset, account deletion | Custom requests, drivers' deliveries |
| Staff-created driver accounts (temp password) | Real SMS/email provider, file uploads |
| Vendor applications + admin verification + fraud signals | |
| Append-only audit log | |

## Run it (no `npm install` needed to run)

Requires **Node 22.18 or newer** (it runs TypeScript and SQLite natively, so there are zero runtime dependencies).

```bash
cd backend
cp .env.example .env                     # development defaults are fine
ADMIN_EMAIL=you@karta.example ADMIN_NAME="Your Name" ADMIN_PASSWORD='a-long-unique-password' npm run create-admin
npm run dev                              # http://localhost:3000/api/health
```

Then start the web app with `VITE_API_URL=http://localhost:3000/api` (see the root `.env.example`).
In development, verification codes are printed in the server console (`NOTIFIER=console`).

```bash
npm test          # 85 tests over real HTTP, in about 3 seconds
npm run typecheck # needs `npm install` once (TypeScript + @types/node, dev only)
```

## How it is organised

```
src/
  server.ts            starts the server, runs migrations, shuts down cleanly
  app.ts               wires every module onto the router (one line per module)
  config.ts            reads + VALIDATES settings; refuses unsafe production configs
  platform/            things every module needs: http, db, crypto, validation, rate limit
  modules/
    auth/              register, login, sessions, passwords, profile
    verification/      one-time codes (email/phone/reset)
    vendors/           applications, documents, admin decisions, fraud signals
    admin/             driver accounts, audit-log reader
    audit/             the append-only log
migrations/            numbered .sql files, applied once, in order
tests/                 HTTP tests against a real server + in-memory database
```

**Rule:** business rules live in plain functions (`rules.ts`, `service.ts`). Routes only parse input, call them,
and shape the response. That is what makes moving to NestJS a wrapping job, not a rewrite (see Migration).

## Security model: what protects what (every row is tested)

| Threat | Defence |
|---|---|
| Stolen password database | Passwords hashed with **scrypt** (per-user salt, cost stored in each hash, upgradeable) |
| Guessing passwords | Per-account lockout (5 failures → 15 min), per-IP limits, identical errors for wrong password / unknown email, equal timing |
| Stolen session token | Short-lived (15 min) access token + **rotating** refresh token; reusing an old one **revokes the whole session** |
| Token theft by scripts (XSS) | Tokens live in **httpOnly** cookies, not in JavaScript |
| Forged tokens | HS256 with the algorithm fixed server-side (`alg: none` rejected); signature checked in constant time |
| Fired/deactivated user keeps access | Every request re-checks the account and the session, so deactivation is **instant** |
| Cross-site request forgery | `SameSite=Lax` cookies + mandatory `x-karta-client: web` header + strict CORS allowlist + origin check |
| Self-made admins | `role` accepts only `customer`/`vendor`. Admins come from `create-admin`; drivers only from staff |
| Mass assignment (`{"role":"admin"}`, `"status":"approved"`) | Every body is parsed through a schema; unknown fields are dropped |
| Fake contact details | Codes are sent to the **account's own** email/phone (the client can't choose the target); vendors must submit with verified contacts |
| Code brute-forcing | 6 digits, 10-minute life, 5 wrong tries burn the code, 60 s resend wait, 5 sends/hour, stored hashed, single use |
| Account enumeration | Forgot-password gives the same answer for everyone; lockouts apply to non-existent emails too |
| Approving bad vendors | Server re-validates completeness + verification at approval; state machine rejects illegal moves; reviewers see duplicate-phone / shared-bank / name-mismatch warnings |
| Tampering with history | `audit_log` is **append-only enforced by the database** (UPDATE/DELETE are refused) and is written in the same transaction as the change |
| Unsafe deployment | `loadConfig` refuses production without a strong `JWT_SECRET`, HTTPS origins, and without the dev notifier / dev codes |
| Oversized / malformed input | 100 KB body limit, JSON-only, typed errors; unexpected errors return a generic message plus a request id (details only in logs) |

Not in Phase 1 on purpose: MFA for staff, device management UI, IP reputation. Recommended before launch: staff MFA.

## API reference

Base: `/api`. JSON in, JSON out. Errors: `{ "error": { "code", "message", "details?", "requestId" } }`
(`details.fields` lists problems per field on 422). State-changing calls need the header `x-karta-client: web`.

| Method & path | Who | Purpose |
|---|---|---|
| `GET /health`, `/ready` | anyone | liveness / database check |
| `POST /auth/register` | anyone | `{name,email,phone,password,role?,businessName?}` role: customer or vendor |
| `POST /auth/login` · `refresh` · `logout` | anyone / session | sign in, rotate tokens, sign out |
| `GET /auth/me` | signed in | current user |
| `PATCH /me` · `DELETE /me` | signed in | edit name/phone; delete account (customers, needs password) |
| `POST /auth/password/change` | signed in | needs current password; signs out other devices |
| `POST /auth/password/forgot` · `reset` | anyone | emailed code flow |
| `POST /verification/request` · `confirm` | signed in | `{channel: email\|phone}` / `{channel, code}` |
| `GET·PUT /vendor/application` | vendor | draft (partial updates merge) |
| `POST /vendor/application/documents` · `DELETE …/:id` | vendor | document metadata (upload comes in Phase 2) |
| `POST /vendor/application/submit` | vendor | requires completeness + verified email & phone |
| `GET /admin/vendor-applications[?status&q]` · `/:id` | staff | queue, detail + signals + history |
| `POST /admin/vendor-applications/:id/decision` | staff | `approve · request_changes · reject · suspend · reinstate` |
| `POST /admin/drivers` · `GET /admin/drivers` | staff | create (returns temp password once) / list |
| `POST /admin/drivers/:id/deactivate` · `reactivate` | staff | instant sign-out on deactivate |
| `GET /admin/audit[?entityType&entityId&limit]` | staff | read the audit log |

## Connecting the web app (what replaces which mock)

`src/lib/api.ts` is the client (cookies, CSRF header, safe single-flight refresh). Swap these stores' MOCK actions for calls:

| Web store / page | API |
|---|---|
| `auth.store` login/register/logout/changePassword/updateProfile/deleteOwnAccount | `/auth/*`, `/me` |
| `VerificationPanel`, `ForgotPasswordPage` | `/verification/*`, `/auth/password/*` (adapter `httpVerification` already matches) |
| `vendor.store` onboarding + `AdminVendor*Pages` | `/vendor/application*`, `/admin/vendor-applications*` |
| `AdminStaffPage` | `/admin/drivers*` |

Roles/permissions in the browser stay as UX only; the server is the authority.

## Decisions and limits (honest list)

- **SQLite, one server.** Perfect for development and a single small server. The rate limiter is in memory. For several servers or heavy traffic, move to PostgreSQL + Redis (see Migration).
- **Refreshes must not run in parallel.** A second use of a refresh token looks like theft and ends the session. `src/lib/api.ts` serialises refreshes.
- **Documents are metadata only.** Phase 2 adds signed uploads to private object storage and a virus scan.
- **Codes need a real provider.** Implement `Notifier` (`src/platform/notifier.ts`) with your SMS/email vendor. Production refuses to start with the dev notifier.
- **Email enumeration on sign-up:** "email already exists" is shown (better UX). If that matters more than UX, answer generically and email the owner.
- **Self-deletion** doesn't yet check for open orders (marked `TODO(orders phase)`).

## Migration paths

- **NestJS:** keep `modules/*/service.ts` and `rules.ts`; replace each `routes.ts` with a controller, and `platform/validate.ts` with DTO classes. Guards replace `requireAuth/requireRole`.
- **PostgreSQL:** the SQL is portable. Change types (`TEXT`→`uuid/timestamptz/jsonb`), swap `node:sqlite` in `platform/db.ts` for `pg` keeping `get/all/run/tx`, and replace the audit triggers with `REVOKE UPDATE, DELETE`.

## Roadmap

1. **Phase 2:** catalogue (listings + moderation, storefront visibility rule), file uploads.
2. **Phase 3:** orders + payments (provider adapter, webhooks, idempotency) + vendor order fan-out.
3. **Phase 4:** returns & refunds, reviews, support tickets, custom requests ("first vendor wins" as an atomic transaction).
4. **Phase 5:** driver applications & deliveries, payouts, notifications, staff MFA, observability.

## Orders, payments, requests, chat

All money is in **kobo** (₦1 = 100). Every state-changing call needs the `x-karta-client: web` header, except the Paystack webhook (signature instead).

| Endpoint | Who | What |
| --- | --- | --- |
| `POST /api/orders` | customer (phone verified) | Server prices `{lines:[{listingId,qty}], ship}` |
| `GET /api/orders`, `/api/orders/:id` | owner / staff | |
| `PUT /api/admin/listings/:id` | staff | Publish a listing's server-side price and stock (interim) |
| `POST /api/payments/initialize` | customer | `{orderId, returnUrl}` → `{reference, checkoutUrl}` |
| `GET /api/payments/verify/:reference` | owner / staff | Asks Paystack, settles once |
| `POST /api/payments/webhook/paystack` | Paystack | HMAC-SHA512 signed |
| `POST /api/payments/refund` | staff | Never more than was paid |
| `POST /api/requests`, `GET /api/requests[/:id]` | customer | Custom requests |
| `POST /api/requests/:id/respond` | customer | `{decision:'accept'\|'decline'}`; accept creates a private listing |
| `POST /api/requests/:id/close` | customer | |
| `GET /api/admin/requests` | staff | Includes customer details |
| `POST /api/admin/requests/:id/offer` | staff | Record a vendor's quote and pass it on |
| `POST /api/admin/requests/:id/remove` | staff | |
| `POST /api/conversations`, `GET /api/conversations[/:id]`, `…/messages`, `…/close` | customer **or** vendor | Chat with Karta. Own threads only |
| `GET/POST /api/admin/conversations…` | staff | Inbox (`?role=vendor\|customer&status=…`), reply, internal notes, set status, start a chat |

Customers and vendors never share a conversation, and vendors have no access to requests.

## Products and fulfilment

| Endpoint | Who | What |
| --- | --- | --- |
| `GET/POST /api/vendor/listings`, `GET/PUT/DELETE /api/vendor/listings/:id` | vendor | Draft needs only a name. Images are URLs (max 4) |
| `POST /api/vendor/listings/:id/submit` | approved vendor | Lists every missing field; goes to review |
| `POST /api/vendor/listings/:id/pause` / `resume` | vendor | |
| `GET /api/admin/listings`, `POST /api/admin/listings/:id/review` | staff | `approve` or `send_back` (with a note) |
| `GET /api/catalog`, `GET /api/catalog/:id` | public | Live pieces only. A made-for-you piece is visible to its customer only |
| `GET /api/vendor/orders[/:id]` | vendor | Own items only; customer shown as "Chidinma O." + city |
| `POST /api/vendor/orders/:id/advance` / `decline` | vendor | new → confirmed → packing → ready. Decline reason is for Karta only |
| `GET /api/logistics/orders`, `POST /api/logistics/orders/:id/status` | driver / staff | ready → with_logistics → delivered. The only role that sees address + phone |
| `GET /api/admin/orders` | staff | Every paid order with per-vendor status |

Editing anything but stock on a live listing sends it back to review. Commission (10%) is in `src/modules/marketplace/policy.ts`: confirm it.

## Sending codes
`NOTIFIER=live` sends SMS via Termii and email via Resend (see `.env.example`). Production refuses to start without it.
