# SEO Dashboard

SEO dashboard with Next.js, Tailwind, and DataForSEO. Ready to deploy on Vercel.

## Repo structure

- **`next-app/`** – Main app (Next.js 16, App Router). Includes:
  - Keyword Research with DataForSEO
  - Domain Overview, Site Audit, Backlinks, AI (pages ready to connect more APIs)
  - Fintech-style UI (Tailwind, reusable components)
- **`keyword-dashboard/`** – Keyword research dashboard in Next.js (UI demo with mock data; optional).

## Local development

### Main app (next-app)

```bash
cd next-app
npm install
cp .env.example .env.local   # optional: add DATAFORSEO_API_KEY
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Default route is `/p/default/keywords`.

### DataForSEO

1. Create `next-app/.env.local` and add your API key as Base64:
   ```bash
   # Generate: printf '%s' 'YOUR_LOGIN:YOUR_PASSWORD' | base64
   DATAFORSEO_API_KEY=your_base64_here
   ```
2. In the app, go to **Help → DataForSEO API key** for the full setup guide.

## Deploy (Vercel)

1. Connect this repo to [Vercel](https://vercel.com).
2. Set **Root Directory** to `next-app` (or deploy the `next-app` folder only).
3. Add the `DATAFORSEO_API_KEY` environment variable in the Vercel project.
4. Deploy.

## Stack

- **Next.js 16** (App Router)
- **TypeScript**
- **Tailwind CSS**
- **lucide-react**
- **DataForSEO** (keyword research via API)

## License

See [LICENSE](LICENSE).
