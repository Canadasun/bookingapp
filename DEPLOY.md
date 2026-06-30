# BookingApp — Production Deployment

## Stack
- **Web**: Next.js → Railway
- **API**: NestJS → Railway
- **Database**: PostgreSQL → Railway (managed)
- **Cache/Queue**: Redis → Railway (managed)
- **Storage**: Cloudflare R2 (object storage + CDN)
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

**Auth (required)**
```
JWT_SECRET=<openssl rand -hex 64>
JWT_REFRESH_SECRET=<openssl rand -hex 64>
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
```

**Token signing — use separate secrets from JWT_SECRET (optional but strongly recommended)**
```
APPOINTMENT_TOKEN_SECRET=<openssl rand -hex 32>
PROVIDER_TOKEN_ENCRYPTION_KEY=<openssl rand -hex 32>
OTP_PEPPER=<openssl rand -hex 32>
```
> If omitted, these fall back to `JWT_SECRET`. Set them to isolate key material.

**Stripe (required)**
```
STRIPE_SECRET_KEY=sk_live_...
STRIPE_SECRET_KEY2=sk_live_...   # optional fallback: used automatically if the primary key fails auth (expired/revoked)
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

> `STRIPE_SECRET_KEY2` is an optional second secret key. If a Stripe call fails
> with an authentication error (the primary key was revoked or expired), the API
> transparently retries it against `STRIPE_SECRET_KEY2`. Leave it unset to run
> with a single key.

**Email / Resend (required)**
```
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=noreply@pulseappointments.com
RESEND_VERIFIED_FROM=noreply@pulseappointments.com
RESEND_TEST_REDIRECT=
ADMIN_ALERT_EMAIL=pmayeni1@icloud.com
```

**SMS / Twilio (required for PRO plan SMS notifications)**
```
TWILIO_ACCOUNT_SID=AC...          # Sub-account SID (or main if not using sub-accounts)
TWILIO_MAIN_ACCOUNT_SID=AC...     # Master account SID — required when TWILIO_ACCOUNT_SID is an API Key SID
TWILIO_AUTH_TOKEN=...
TWILIO_FROM_NUMBER=+1...
TWILIO_API_KEY=SK...              # Optional: Twilio API Key SID (if using key auth instead of auth token)
TWILIO_API_CLIENT_SECRET=...      # Optional: Twilio API Key Secret
```

**Object storage / Cloudflare R2 (required — Railway containers are ephemeral)**
```
S3_BUCKET=pulse-uploads
S3_ENDPOINT=https://<ACCOUNT_ID>.r2.cloudflarestorage.com
S3_ACCESS_KEY_ID=<R2 access key>
S3_SECRET_ACCESS_KEY=<R2 secret key>
S3_REGION=auto
S3_PUBLIC_BASE_URL=https://cdn.pulseappointments.com   # CDN / public bucket URL for image redirects
S3_UPLOAD_PREFIX=Uploads
```
> Without R2, uploaded files (logos, avatars, documents) are stored on local disk and lost on every Railway redeploy.

**Networking / CORS (required)**
```
PORT=3001
NODE_ENV=production
API_PUBLIC_URL=https://api.pulseappointments.com
NEXT_PUBLIC_WEB_URL=https://www.pulseappointments.com
CORS_ALLOWED_ORIGINS=https://www.pulseappointments.com
```

**Google Calendar Sync (required for calendar sync feature)**
```
GOOGLE_CLIENT_ID=<OAuth 2.0 client ID>
GOOGLE_CLIENT_SECRET=<OAuth 2.0 client secret>
GOOGLE_REDIRECT_URI=https://api.pulseappointments.com/api/calendar-sync/google/callback
OAUTH_COOKIE_DOMAIN=.pulseappointments.com
```

**Error monitoring (optional)**
```
SENTRY_DSN=https://...@sentry.io/...
```

**Notifications tuning (optional — sensible defaults apply)**
```
NOTIFICATIONS_ENABLED=true
NOTIFICATION_RATE_MAX=10
NOTIFICATION_RATE_DURATION_MS=60000
```

**One-time bootstrap (set once, then REMOVE from Railway variables)**
```
BOOTSTRAP_ADMIN_EMAIL=your@email.com
BOOTSTRAP_ADMIN_SECRET=<strong random string>
```
> After calling `POST /api/auth/bootstrap-admin` to create your first super-admin, remove both variables.

**DO NOT set in production (will cause API startup failure)**
```
# DISABLE_AUTH_LOCKOUT   ← disables brute-force lockout; API refuses to start if set to "true" in production
# UNLOCK_ALL_FEATURES    ← bypasses all plan enforcement; API refuses to start if set in production
```

Railway auto-injects `DATABASE_URL` and `REDIS_URL` from the managed services.

---

## Step 2 — Deploy Web to Railway

### 2a. Create the service
1. Go to [railway.app](https://railway.app) → open the project (or **New Project**)
2. **+ New Service** → Deploy from GitHub repo → select `bookingapp` → set **Root Directory** to `booking-web`
3. The build uses `booking-web/railway.toml` (Dockerfile builder, healthcheck `/api/health`). No extra build config needed.

### 2b. Set environment variables in Railway

**Required**
```
API_INTERNAL_URL=https://api.pulseappointments.com
NEXT_PUBLIC_API_URL=https://api.pulseappointments.com/api
NEXT_PUBLIC_WS_URL=wss://api.pulseappointments.com
NEXT_PUBLIC_WEB_URL=https://www.pulseappointments.com
COOKIE_SIGN_SECRET=<openssl rand -hex 32>
```
> `COOKIE_SIGN_SECRET` is required — the web app throws at startup if missing in production.
> `PORT=3000` and `NODE_ENV=production` are already set in `railway.toml`.

**Optional**
```
NEXT_PUBLIC_CLARITY_ID=<Microsoft Clarity project ID>
NEXT_PUBLIC_SENTRY_DSN=https://...@sentry.io/...
NEXT_PUBLIC_STATUS_PAGE_URL=https://status.pulseappointments.com
```

### 2c. Deploy
The `booking-web` service is connected to the GitHub repo, so Railway auto-deploys on every push to `main`. To deploy from a local working tree instead, run `railway up` from `booking-web/`.

---

## Step 3 — Configure Stripe Webhook

1. Go to [dashboard.stripe.com/webhooks](https://dashboard.stripe.com/webhooks)
2. Add endpoint: `https://api.pulseappointments.com/api/payments/webhook/stripe`
3. Select events:
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `setup_intent.succeeded`
   - `charge.refunded`
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - Stripe Connect: `account.updated`, `account.application.deauthorized`, `capability.updated`, `payout.paid`, `payout.failed`
4. Copy the signing secret (`whsec_...`) → add to Railway `STRIPE_WEBHOOK_SECRET`

---

## Step 4 — Configure Resend Domain

1. Go to [resend.com/domains](https://resend.com/domains)
2. Add `pulseappointments.com`
3. Add the DNS records provided
4. Verify `RESEND_VERIFIED_FROM=noreply@pulseappointments.com` is set

---

## Step 5 — Configure Cloudflare R2

1. Go to Cloudflare dashboard → R2 → Create bucket named `pulse-uploads`
2. Create an R2 API token with **Object Read & Write** on that bucket
3. Copy **Access Key ID** → `S3_ACCESS_KEY_ID`, **Secret Access Key** → `S3_SECRET_ACCESS_KEY`
4. Copy the endpoint URL → `S3_ENDPOINT` (format: `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`)
5. Set `S3_PUBLIC_BASE_URL` to your R2 public URL or custom CDN domain
6. In R2 bucket settings, set the bucket as **Public** or configure a custom domain

---

## Step 6 — Mobile (EAS Build + Store Submission)

### Build
```bash
cd mobile
eas build --platform all --profile production
```

### Submit
```bash
eas submit --platform ios    # submits to App Store Connect (ascAppId: 6774881206)
eas submit --platform android
```

### Before building, verify:
- `eas.json` production profile has `pk_live_...` Stripe key — ✓ already set
- `EXPO_PUBLIC_API_BASE` points to `https://api.pulseappointments.com/api` — ✓ already set
- Android cert pins in `network-security-config.xml` — expire **2027-06-13**, re-pin before May 2027

---

## Step 7 — Post-deploy checklist

- [ ] `GET https://api.pulseappointments.com/api/healthz` → `{"status":"ok"}`
- [ ] `GET https://www.pulseappointments.com` → landing page loads
- [ ] Login with the seeded owner account
- [ ] Book a test appointment → confirm email arrives
- [ ] Check Stripe webhook fires on payment
- [ ] Complete a subscription Checkout and confirm the paid plan is active
- [ ] Confirm Stripe subscription update/cancel events reach the webhook endpoint
- [ ] Update `NEXT_PUBLIC_WEB_URL` to final domain in both API and web env if changed

---

## Quick commands

```bash
# Generate secrets
openssl rand -hex 64   # JWT_SECRET, JWT_REFRESH_SECRET
openssl rand -hex 32   # COOKIE_SIGN_SECRET, APPOINTMENT_TOKEN_SECRET, PROVIDER_TOKEN_ENCRYPTION_KEY, OTP_PEPPER

# Check production API locally
NODE_ENV=production npm run start:prod

# Run migrations manually
npx prisma migrate deploy

# Local-only demo seed. Do not run this against production data.
NODE_ENV=development npm run seed

# Production starter seed — creates the initial owner account.
# Set OWNER_PASSWORD to a strong unique password first.
OWNER_PASSWORD=<strong-password> npm run seed:prod
```

---

## Business IDs

| Business         | ID                              | Plan |
|------------------|---------------------------------|------|
| Demo Salon       | cmpq7n418000011t8swjlihv0       | FREE |
| Idowu Studio     | cmpr97t3d0000pti96ggnrcvm       | PRO  |

Update `NEXT_PUBLIC_BUSINESS_ID` in web env to the business you want as the default booking page.
