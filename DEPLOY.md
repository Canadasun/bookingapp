# BookingApp — Production Deployment

## Stack
- **Web**: Next.js → Vercel
- **API**: NestJS → Railway
- **Database**: PostgreSQL → Railway (managed)
- **Cache/Queue**: Redis → Railway (managed)
- **Email**: Resend
- **SMS**: Twilio (PRO plan only)
- **Payments**: Stripe

---

## Step 1 — Deploy API to Railway

### 1a. Create Railway project
1. Go to [railway.app](https://railway.app) → New Project
2. Deploy from GitHub repo → select `bookingapp` → set **Root Directory** to `booking-api`

### 1b. Add services in Railway
From your project dashboard, click **+ New Service**:
- **PostgreSQL** — Railway managed (auto-sets `DATABASE_URL`)
- **Redis** — Railway managed (auto-sets `REDIS_URL`)

### 1c. Set environment variables in Railway
In the `booking-api` service → Variables, add:

```
JWT_SECRET=<run: openssl rand -hex 64>
JWT_REFRESH_SECRET=<run: openssl rand -hex 64>
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=noreply@yourdomain.com
RESEND_VERIFIED_FROM=noreply@yourdomain.com
RESEND_TEST_REDIRECT=
ADMIN_ALERT_EMAIL=idowu@icloud.com

TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_FROM_NUMBER=+1...
TWILIO_API_KEY=

PORT=3001
NODE_ENV=production
NEXT_PUBLIC_WEB_URL=https://your-web-domain.vercel.app
API_INTERNAL_URL=https://your-api-domain.com
CORS_ALLOWED_ORIGINS=https://your-web-domain.vercel.app
```

Railway auto-injects `DATABASE_URL` and `REDIS_URL` from the managed services.

### 1d. Get your API URL
After deploy: `https://booking-api-production-xxxx.up.railway.app`

---

## Step 2 — Deploy Web to Vercel

### 2a. Import project
1. Go to [vercel.com](https://vercel.com) → New Project
2. Import from GitHub → select `bookingapp` → set **Root Directory** to `booking-web`

### 2b. Set environment variables in Vercel
In project Settings → Environment Variables:

```
API_INTERNAL_URL=https://booking-api-production-xxxx.up.railway.app
NEXT_PUBLIC_BUSINESS_ID=cmpr97t3d0000pti96ggnrcvm   # your business ID
NEXT_PUBLIC_BUSINESS_SLUG=idowu-salon
NEXT_PUBLIC_WEB_URL=https://your-app.vercel.app
```

### 2c. Deploy
Vercel auto-deploys on every push to `main`.

---

## Step 3 — Configure Stripe Webhook

1. Go to [dashboard.stripe.com/webhooks](https://dashboard.stripe.com/webhooks)
2. Add endpoint: `https://booking-api-xxxx.railway.app/api/payments/webhook/stripe`
3. Select events: `payment_intent.succeeded`, `payment_intent.payment_failed`
4. Copy the signing secret (`whsec_...`) → add to Railway `STRIPE_WEBHOOK_SECRET`

---

## Step 4 — Configure Resend Domain (for production emails)

1. Go to [resend.com/domains](https://resend.com/domains)
2. Add your domain (e.g. `bookingapp.com`)
3. Add the DNS records they provide
4. Update `RESEND_FROM_EMAIL` to `noreply@yourdomain.com`

Until your domain is verified, use `onboarding@resend.dev` (limited to 100 emails/day).

---

## Step 5 — Post-deploy checklist

- [ ] Visit `https://your-api.railway.app/api/healthz` → `{"status":"ok"}`
- [ ] Visit `https://your-app.vercel.app` → landing page loads
- [ ] Login with the seeded owner account (password set via `OWNER_PASSWORD` at seed time)
- [ ] Book a test appointment → confirm email arrives
- [ ] Check Stripe webhook fires on payment
- [ ] Update `NEXT_PUBLIC_WEB_URL` to your final domain in both API and web env

---

## Quick commands

```bash
# Generate secrets
openssl rand -hex 64   # for JWT_SECRET
openssl rand -hex 64   # for JWT_REFRESH_SECRET

# Check production API locally
NODE_ENV=production npm run start:prod

# Run migrations manually
npx prisma migrate deploy

# Local-only demo seed. Do not run this against production data.
NODE_ENV=development npm run seed

# Production starter seed, only when intentionally creating an initial owner.
# Set OWNER_PASSWORD to a strong unique password first.
OWNER_PASSWORD=<strong-password> npm run seed:prod
```

---

## Business IDs

| Business         | ID                              | Plan |
|------------------|---------------------------------|------|
| Demo Salon       | cmpq7n418000011t8swjlihv0       | FREE |
| Idowu Studio     | cmpr97t3d0000pti96ggnrcvm       | PRO  |

Update `NEXT_PUBLIC_BUSINESS_ID` in web `.env` to the business you want as the default booking page.
