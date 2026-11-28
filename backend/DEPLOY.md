# Deploying the Karta API

The API is one small Node program (Node 22.18+) with a SQLite file for its database. It needs a host that gives it
**a persistent disk** and **a web address**. These steps use Railway; Render or Fly.io work the same way
(check each host's current pricing: a persistent disk usually costs a few dollars a month).

## 0. You need a domain

Login uses cookies, and browsers only send them when the website and the API share the same main domain:

| Website | API | Works? |
| --- | --- | --- |
| `www.yourdomain.com` | `api.yourdomain.com` | Yes |
| `karta.vercel.app` | `something.up.railway.app` | **No: login won't stay signed in** |

So buy or use a domain (for example `karta.ng`) and plan two names: `www` for the site and `api` for the API.

## 1. Put the API online (Railway)

1. railway.app → sign in with GitHub → **New Project → Deploy from GitHub repo** → pick the Karta repo.
2. Open the service → **Settings**: set **Root Directory** to `backend`. Start command is `npm start` (default).
3. **Volumes → Add volume**, mount path `/data`.
4. **Variables** (see the two lists below).
5. **Settings → Networking → Custom domain**: enter `api.yourdomain.com`. Railway shows a DNS record; add it where you
   bought your domain. Wait until Railway shows the domain as active.
6. Check it: open `https://api.yourdomain.com/api/health`. You should see `{"ok":true}`.

**That address is your "backend link".** Your site's setting is `VITE_API_URL=https://api.yourdomain.com/api`.

## 2. Variables

### Rehearsal with test money (STAGING). Start here.

```
NODE_ENV=production
STAGING=true
NOTIFIER=console
JWT_SECRET=<run:  openssl rand -hex 32   and paste the result>
CORS_ORIGINS=https://www.yourdomain.com
DATABASE_PATH=/data/karta.db
TRUST_PROXY=true
PAYSTACK_SECRET_KEY=sk_test_...        (the key from Paystack → Settings → API Keys, test mode)
BOOTSTRAP_ADMIN_EMAIL=you@yourdomain.com
BOOTSTRAP_ADMIN_NAME=Your Name
BOOTSTRAP_ADMIN_PASSWORD=<a long, unique passphrase>
```

In staging, SMS/email codes are **printed in the Railway log** (Deployments → View logs) instead of being sent.
After the first successful sign-in, **delete the three BOOTSTRAP_ADMIN_* variables**.

### Real launch

Remove `STAGING`, then set:

```
NOTIFIER=live
TERMII_API_KEY=...   TERMII_SENDER_ID=...   TERMII_CHANNEL=dnd
RESEND_API_KEY=...   EMAIL_FROM=Karta <hello@yourdomain.com>
PAYSTACK_SECRET_KEY=sk_live_...
CLOUDINARY_CLOUD_NAME=...  CLOUDINARY_API_KEY=...  CLOUDINARY_API_SECRET=...
```

The API refuses to start in production with unsafe settings and prints what to fix.

## 3. The website (Vercel/Netlify) settings

```
VITE_API_URL=https://api.yourdomain.com/api
VITE_PAYMENT_PROVIDER=paystack
```

Redeploy the site after changing them (these are baked in at build time).

## 4. Paystack

Dashboard → **Settings → API Keys & Webhooks** → Test Webhook URL:
`https://api.yourdomain.com/api/payments/webhook/paystack`. Use Paystack's test cards to pay.

## 5. Check it works

Sign in as the admin → add a vendor and approve → list a product → buy it with a test card → the vendor sees the order.
Never put keys in GitHub: set them only in the host's Variables screen.

## 6. Verification codes (SMS and email)

Customers and vendors must verify their phone and email. The API already knows how to send them; it needs two accounts.
Both take a little time to approve, so start them early. (Screens change, so follow each provider's own instructions.)

**SMS: Termii (termii.com).** Create an account, complete their business verification, register a **Sender ID**
(for example `Karta`; approval can take a few days) and copy your **API key**. Set `TERMII_API_KEY`, `TERMII_SENDER_ID`,
and `TERMII_CHANNEL=dnd` (the route that also reaches numbers on Nigeria's Do-Not-Disturb list).

**Email: Resend (resend.com).** Create an account, **add your domain** and add the DNS records they show (this proves
you own it), then create an **API key**. Set `RESEND_API_KEY` and `EMAIL_FROM=Karta <hello@yourdomain.com>` (the address
must be on the domain you verified).

Then set `NOTIFIER=live` and remove `STAGING`. Until then, in staging, codes appear in the host's log.

## 7. Paying vendors

Admin → **Vendor payouts**. Earnings become payable 7 days after delivery. Click **Create payout**, send the money from
your bank (or Paystack dashboard) to the account shown, then paste the transfer reference and press **I've sent the
money**. The vendor then sees it as paid. The system never moves money by itself.

## 8. Refunds

Admin → **Orders & refunds**. Orders that need you (a vendor declined, an item sold out, a customer paid twice) are listed
first. Pick **Refund…**, confirm the amount and give a reason. The money goes back to the customer's card through Paystack.
