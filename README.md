# Precision Mirror Finder

Mobile-friendly Next.js app for collecting vehicle mirror replacement requests and managing quotes from an admin dashboard.

## Run Locally

```bash
npm install
npm run db:migrate
npm run dev
```

Open `http://localhost:3000` for the customer form and `http://localhost:3000/admin` for the admin dashboard.

Local development uses SQLite by default at `data/precision-mirror-finder.sqlite`, so you can keep working on localhost without a hosted database.

## Local Environment

Create or edit `.env.local` in the project root:

```bash
ADMIN_PASSWORD=replace-this-with-your-admin-password
GEMINI_API_KEY=replace-this-with-your-gemini-api-key
EBAY_CLIENT_ID=replace-this-with-your-ebay-client-id
EBAY_CLIENT_SECRET=replace-this-with-your-ebay-client-secret
EBAY_ENVIRONMENT=production
EBAY_MARKETPLACE_ID=EBAY_US
SALES_TAX_RATE=0.06625
AUTH_SECRET=replace-this-with-a-long-random-string
CRON_SECRET=replace-this-with-a-long-random-string
DATABASE_URL=file:./data/precision-mirror-finder.sqlite
```

## Production Database

Production is ready for Vercel Postgres. On Vercel, the app uses `POSTGRES_URL` or a Postgres `DATABASE_URL`. During ordinary `npm run dev` localhost work, it continues to use local SQLite by default even if Vercel has pulled database variables into `.env.local`.

To intentionally test the hosted database from your local machine, run with `USE_POSTGRES=true`.

Run the local SQLite migration:

```bash
npm run db:migrate
```

Run the hosted Postgres migration explicitly:

```bash
node scripts/migrate-database.mjs --postgres
```

## Background Research Queue

Customer submissions enqueue a research job and redirect immediately. The confirmation page calls `/api/research/process` with a signed one-job token, so Gemini research runs in a separate worker request with a longer timeout instead of inside the customer form submission. The admin dashboard also kicks the worker when queued research is visible.

After Gemini identifies likely fitment and part numbers, the worker also checks the official eBay Browse API when `EBAY_CLIENT_ID` and `EBAY_CLIENT_SECRET` are configured. eBay results are merged into supplier cards and sorted by delivered cost, so low-cost used OEM listings can appear ahead of higher retail listings.

For manual or scheduled worker calls, protect that endpoint with:

```bash
CRON_SECRET=<a long random string>
```

On Vercel Hobby, frequent cron schedules are not available. If the project is upgraded later, a cron can be added to call `/api/research/process` as an extra retry path.

## Go Live Checklist

You can print the quick checklist any time:

```bash
npm run deploy:checklist
```

Minimal steps:

1. Create a new empty GitHub repo.
2. Push this project:

```bash
git init
git add .
git commit -m "Prepare Vercel deployment"
git branch -M main
git remote add origin https://github.com/YOUR-USER/precision-mirror-finder.git
git push -u origin main
```

3. In Vercel, import that GitHub repo as a Next.js project.
4. In Vercel, create/connect Postgres from Storage and attach it to the project. Vercel adds `POSTGRES_URL`.
5. In Vercel Project Settings, add:

```bash
ADMIN_PASSWORD=<your admin dashboard password>
GEMINI_API_KEY=<your Gemini API key>
EBAY_CLIENT_ID=<your eBay App ID / Client ID>
EBAY_CLIENT_SECRET=<your eBay Cert ID / Client Secret>
EBAY_ENVIRONMENT=production
EBAY_MARKETPLACE_ID=EBAY_US
AUTH_SECRET=<a long random string>
CRON_SECRET=<a long random string>
SALES_TAX_RATE=0.06625
```

6. Pull production env and migrate once:

```bash
vercel env pull .env.vercel.local
node scripts/migrate-database.mjs --env-file=.env.vercel.local --postgres
```

7. Deploy from Vercel.
