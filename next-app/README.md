# CrawliT (Next.js)

CrawliT SEO Dashboard — Next.js app with project-based keyword research, visibility metrics, and DataForSEO integration. By **Rusben Madrigal** ([www.rusmadrigal.com](https://www.rusmadrigal.com) · [LinkedIn](https://www.linkedin.com/in/rusmadrigal/)). Ready for Vercel deploy.

## Stack

- **Next.js 16** (App Router)
- **TypeScript**
- **Tailwind CSS**
- **lucide-react**

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). You’ll be redirected to `/p/default/keywords`.

## DataForSEO

1. Copy `.env.example` to `.env.local`.
2. Add your Base64-encoded `login:password` as `DATAFORSEO_API_KEY`.
3. See `/help/dataforseo-api-key` in the app for the full setup guide.

## Deploy on Vercel

1. Push this folder (or repo) and connect it to Vercel.
2. In the Vercel project, add the `DATAFORSEO_API_KEY` environment variable.
3. Deploy.

## Project structure

- `src/app/` – App Router routes
- `src/app/p/[projectId]/` – Project-scoped pages (overview, GAP Analysis, backlinks, audit, AI Visibility)
- `src/components/` – Layout (sidebar, top bar, banner) and UI (card, button)
- `src/config/` – Navigation config
- `src/lib/` – Utilities (e.g. `cn`)

## Next steps

- Connect API routes or Server Actions to a database (e.g. Vercel Postgres, Neon) for projects and saved keywords.
- Call DataForSEO from API routes using `DATAFORSEO_API_KEY`.
- Add auth (e.g. NextAuth, Clerk) for production.
