# Mission Control — Frontend

Portail familial Next.js (App Router) + Tailwind. Export statique pour Render Static Site.

## Structure

- `app/page.tsx` — **Page d'accueil = login** (my-mission-control.com)
- `app/change-password/` — forçage au 1er login
- `app/dashboard/` — tableau de bord personnalisé
- `app/admin/` — gestion des membres et accès (ADMIN only)
- `lib/api.ts` — client API public
- `lib/admin-api.ts` — client API admin

## Dev local

```bash
npm install
echo 'NEXT_PUBLIC_API_URL=https://api.my-mission-control.com' > .env.local
npm run dev
```

## Build production (Render Static Site)

- Build command : `npm install && npm run build`
- Publish directory : `out`
- Env var : `NEXT_PUBLIC_API_URL=https://api.my-mission-control.com`
